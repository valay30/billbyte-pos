const express = require('express');
const router = express.Router();
const { getTenantDb, saveTenantDb, dbQuery } = require('../database/db');
const { auth } = require('../middleware/auth');



function generateOrderNumber() {
  const now = new Date();
  const datePart = now.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${datePart}-${rand}`;
}

function generateKotNumber() {
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `KOT-${Date.now()}-${rand}`;
}

// GST calculation
function calculateGST(subtotal, taxCategory) {
  const rates = { gst5: 5, gst12: 12, gst18: 18, exempt: 0 };
  const rate = rates[taxCategory] || 5;
  const cgst = (subtotal * (rate / 2)) / 100;
  const sgst = (subtotal * (rate / 2)) / 100;
  return { cgst, sgst, igst: 0, total_tax: cgst + sgst };
}

// Get all orders
router.get('/', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const { status, date, table_id } = req.query;
    let sql = `
      SELECT o.*, t.name as table_name, u.name as waiter_name, c.name as customer_name, c.phone as customer_phone, c.loyalty_points as customer_loyalty_points
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.waiter_id = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { sql += ' AND o.status = ?'; params.push(status); }
    if (date) { sql += ' AND o.created_at::date = ?'; params.push(date); }
    if (table_id) { sql += ' AND o.table_id = ?'; params.push(table_id); }
    sql += ' ORDER BY o.created_at DESC LIMIT 200';
    res.json(await dbQuery(db, sql, params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get order with items
router.get('/:id', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const orders = await dbQuery(db, `
      SELECT o.*, t.name as table_name, u.name as waiter_name, c.name as customer_name, c.phone as customer_phone, c.loyalty_points
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.waiter_id = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?`, [req.params.id]);
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];
    order.items = await dbQuery(db, 'SELECT oi.*, STRING_AGG(oim.modifier_name, \',\') as modifiers FROM order_items oi LEFT JOIN order_item_modifiers oim ON oim.order_item_id = oi.id WHERE oi.order_id = ? GROUP BY oi.id', [order.id]);
    order.payments = await dbQuery(db, 'SELECT * FROM payments WHERE order_id = ?', [order.id]);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new order
router.post('/', auth, async (req, res) => {
  try {
    const { table_id, customer_id, order_type, items, notes, source } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    const orderNumber = generateOrderNumber();

    // Calculate totals
    let subtotal = 0;
    let cgst = 0, sgst = 0;
    items.forEach(item => {
      const itemTotal = item.unit_price * item.quantity + (item.modifier_price || 0);
      subtotal += itemTotal;
      const tax = calculateGST(itemTotal, item.tax_category || 'gst5');
      cgst += tax.cgst;
      sgst += tax.sgst;
    });
    const total = subtotal + cgst + sgst;

    const orderId = await db.insert(
      `INSERT INTO orders (order_number, table_id, customer_id, order_type, waiter_id, subtotal, cgst, sgst, total, notes, source, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [orderNumber, table_id || null, customer_id || null, order_type || 'dine_in', req.user.id, subtotal, cgst, sgst, total, notes || null, source || 'pos']
    );

    // Insert items
    for (const item of items) {
      await db.run(
        'INSERT INTO order_items (order_id, item_id, item_name, quantity, unit_price, total_price, notes, station) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [orderId, item.item_id, item.item_name, item.quantity, item.unit_price, item.unit_price * item.quantity, item.notes || null, item.station || 'kitchen']
      );
    }

    // Update table status
    if (table_id) {
      await db.run("UPDATE tables SET status='occupied' WHERE id=?", [table_id]);
    }

    // Auto-generate KOT
    const kotNumber = generateKotNumber();
    const kotId = await db.insert(
      'INSERT INTO kot_tickets (kot_number, order_id, table_id, station) VALUES (?, ?, ?, ?)',
      [kotNumber, orderId, table_id || null, 'kitchen']
    );

    const orderItems = await dbQuery(db, 'SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    for (const oi of orderItems) {
      await db.run('INSERT INTO kot_items (kot_id, order_item_id, item_name, quantity, notes) VALUES (?, ?, ?, ?, ?)', [kotId, oi.id, oi.item_name, oi.quantity, oi.notes || null]);
      await db.run('UPDATE order_items SET kot_printed=1 WHERE id=?', [oi.id]);
    }

    const fullOrder = await dbQuery(db, `
      SELECT o.*, t.name as table_name, u.name as waiter_name, c.name as customer_name, c.phone as customer_phone, c.loyalty_points as customer_loyalty_points
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.waiter_id = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?`, [orderId]);
    const fullItems = await dbQuery(db, 'SELECT * FROM order_items WHERE order_id = ?', [orderId]);

    if (req.app.get('io')) {
      req.app.get('io').to('tenant_' + req.tenantSlug).emit('new_order', { order: { ...fullOrder[0], items: fullItems }, kot_number: kotNumber });
      req.app.get('io').to('tenant_' + req.tenantSlug).emit('table_updated');
    }

    res.json({ ...fullOrder[0], items: fullItems, kot_number: kotNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Add items to existing order
router.post('/:id/items', auth, async (req, res) => {
  try {
    const { items } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    const orderId = req.params.id;

    for (const item of items) {
      const itemTotal = item.unit_price * item.quantity;
      await db.run(
        'INSERT INTO order_items (order_id, item_id, item_name, quantity, unit_price, total_price, notes, station) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [orderId, item.item_id, item.item_name, item.quantity, item.unit_price, itemTotal, item.notes || null, item.station || 'kitchen']
      );
    }

    // Recalculate order total
    const allItems = await dbQuery(db, 'SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    let subtotal = allItems.reduce((sum, i) => sum + parseFloat(i.total_price), 0);
    const tax = calculateGST(subtotal, 'gst5');
    await db.run(
      `UPDATE orders SET subtotal=?, cgst=?, sgst=?, total=?, updated_at=NOW() WHERE id=?`,
      [subtotal, tax.cgst, tax.sgst, subtotal + tax.cgst + tax.sgst, orderId]
    );

    // New KOT for added items
    const kotNumber = generateKotNumber();
    const kotId = await db.insert(
      'INSERT INTO kot_tickets (kot_number, order_id, table_id, station) VALUES (?, (SELECT table_id FROM orders WHERE id=?), (SELECT table_id FROM orders WHERE id=?), ?)',
      [kotNumber, orderId, orderId, 'kitchen']
    );

    const newOrderItems = await dbQuery(db, 'SELECT * FROM order_items WHERE order_id = ? AND kot_printed = 0', [orderId]);
    for (const oi of newOrderItems) {
      await db.run('INSERT INTO kot_items (kot_id, order_item_id, item_name, quantity, notes) VALUES (?, ?, ?, ?, ?)', [kotId, oi.id, oi.item_name, oi.quantity, oi.notes]);
      await db.run('UPDATE order_items SET kot_printed=1 WHERE id=?', [oi.id]);
    }

    if (req.app.get('io')) {
      req.app.get('io').to('tenant_' + req.tenantSlug).emit('order_updated', { order_id: orderId, kot_number: kotNumber });
      req.app.get('io').to('tenant_' + req.tenantSlug).emit('table_updated');
    }

    res.json({ success: true, kot_number: kotNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update order status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    await db.run("UPDATE orders SET status=?, updated_at=NOW() WHERE id=?", [status, req.params.id]);

    if (status === 'paid' || status === 'cancelled' || status === 'served' || status === 'ready') {
      const orders = await dbQuery(db, 'SELECT table_id FROM orders WHERE id=?', [req.params.id]);
      if (status === 'paid' || status === 'cancelled') {
        if (orders[0]?.table_id) {
          await db.run("UPDATE tables SET status='available' WHERE id=?", [orders[0].table_id]);
        }
      }
      await db.run("UPDATE kot_items SET status='ready' WHERE kot_id IN (SELECT id FROM kot_tickets WHERE order_id=?)", [req.params.id]);
      await db.run("UPDATE kot_tickets SET status='completed', completed_at=NOW() WHERE order_id=?", [req.params.id]);
    }

    if (req.app.get('io')) {
      req.app.get('io').to('tenant_' + req.tenantSlug).emit('order_status_changed', { order_id: req.params.id, status });
      req.app.get('io').to('tenant_' + req.tenantSlug).emit('table_updated');
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Apply discount / coupon
router.patch('/:id/discount', auth, async (req, res) => {
  try {
    const { discount_type, discount_value, coupon_code } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    const orders = await dbQuery(db, 'SELECT * FROM orders WHERE id=?', [req.params.id]);
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    let discountAmount = 0;
    if (discount_type === 'percentage') {
      discountAmount = (order.subtotal * discount_value) / 100;
    } else if (discount_type === 'flat') {
      discountAmount = discount_value;
    }

    const newTotal = parseFloat(order.subtotal) - discountAmount + parseFloat(order.cgst) + parseFloat(order.sgst);
    await db.run(
      'UPDATE orders SET discount_amount=?, discount_type=?, coupon_code=?, total=? WHERE id=?',
      [discountAmount, discount_type, coupon_code, Math.max(0, newTotal), req.params.id]
    );

    if (coupon_code) {
      await db.run('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?', [coupon_code]);
    }
    res.json({ success: true, discount_amount: discountAmount, new_total: Math.max(0, newTotal) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Link/update customer on existing order
router.patch('/:id/customer', auth, async (req, res) => {
  try {
    const { customer_id } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    await db.run("UPDATE orders SET customer_id=?, updated_at=NOW() WHERE id=?", [customer_id || null, req.params.id]);
    res.json({ success: true, customer_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Process payment
router.post('/:id/pay', auth, async (req, res) => {
  try {
    const { payments, loyalty_points_used, customer_id } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    const orderId = req.params.id;

    const orders = await dbQuery(db, 'SELECT * FROM orders WHERE id=?', [orderId]);
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    // Insert payment records
    for (const p of payments) {
      await db.run('INSERT INTO payments (order_id, payment_method, amount, reference) VALUES (?, ?, ?, ?)', [orderId, p.method, p.amount, p.reference]);
    }

    // Loyalty points redemption
    if (loyalty_points_used && customer_id) {
      const settingRowsRatio = await dbQuery(db, "SELECT value FROM settings WHERE key='loyalty_redemption_ratio'");
      const ratio = parseFloat(settingRowsRatio[0]?.value || '100');
      const pointsValue = (loyalty_points_used / 100) * ratio;
      const newTotal = Math.max(0, parseFloat(order.total) - pointsValue);
      const newDiscount = parseFloat(order.discount_amount || 0) + pointsValue;
      await db.run('UPDATE orders SET total = ?, discount_amount = ? WHERE id = ?', [newTotal, newDiscount, orderId]);
      order.total = newTotal;
      order.discount_amount = newDiscount;
      await db.run('UPDATE customers SET loyalty_points = loyalty_points - ? WHERE id = ?', [loyalty_points_used, customer_id]);
      await db.run('INSERT INTO loyalty_transactions (customer_id, order_id, type, points, description) VALUES (?, ?, ?, ?, ?)', [customer_id, orderId, 'redeem', -loyalty_points_used, `Redeemed for Order ${order.order_number}`]);
    }

    // Award loyalty points
    const custId = customer_id || order.customer_id;
    if (custId) {
      const settingRows = await dbQuery(db, "SELECT value FROM settings WHERE key='loyalty_points_per_rupee'");
      const ptsPerRupee = parseFloat(settingRows[0]?.value || '0.1');
      const pointsEarned = Math.floor(parseFloat(order.total) * ptsPerRupee);
      await db.run(
        `UPDATE customers SET loyalty_points = loyalty_points + ?, total_visits = total_visits + 1, total_spent = total_spent + ?, updated_at = NOW() WHERE id=?`,
        [pointsEarned, order.total, custId]
      );
      await db.run('INSERT INTO loyalty_transactions (customer_id, order_id, type, points, description) VALUES (?, ?, ?, ?, ?)', [custId, orderId, 'earn', pointsEarned, `Earned for Order ${order.order_number}`]);

      // Update tier
      const customers = await dbQuery(db, 'SELECT total_spent FROM customers WHERE id=?', [custId]);
      if (customers.length) {
        const spent = parseFloat(customers[0].total_spent);
        let tier = 'bronze';
        if (spent >= 25000) tier = 'platinum';
        else if (spent >= 10000) tier = 'gold';
        else if (spent >= 3000) tier = 'silver';
        await db.run('UPDATE customers SET loyalty_tier=? WHERE id=?', [tier, custId]);
      }
    }

    // Mark order as paid
    await db.run("UPDATE orders SET status='paid', customer_id=?, updated_at=NOW() WHERE id=?", [custId || order.customer_id, orderId]);
    const tableRes = await dbQuery(db, 'SELECT table_id FROM orders WHERE id=?', [orderId]);
    if (tableRes[0]?.table_id) {
      await db.run("UPDATE tables SET status='available' WHERE id=?", [tableRes[0].table_id]);
    }

    await db.run("UPDATE kot_items SET status='ready' WHERE kot_id IN (SELECT id FROM kot_tickets WHERE order_id=?)", [orderId]);
    await db.run("UPDATE kot_tickets SET status='completed', completed_at=NOW() WHERE order_id=?", [orderId]);

    if (req.app.get('io')) {
      req.app.get('io').to('tenant_' + req.tenantSlug).emit('order_paid', { order_id: orderId });
      req.app.get('io').to('tenant_' + req.tenantSlug).emit('table_updated');
    }

    res.json({ success: true, message: 'Payment processed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Validate coupon
router.post('/validate-coupon', auth, async (req, res) => {
  try {
    const { code, order_total } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    const coupons = await dbQuery(db, `
      SELECT * FROM coupons WHERE code = ? AND is_active = 1
      AND (valid_from IS NULL OR valid_from::date <= CURRENT_DATE)
      AND (valid_until IS NULL OR valid_until::date >= CURRENT_DATE)
      AND (usage_limit IS NULL OR used_count < usage_limit)
    `, [code]);

    if (!coupons.length) return res.status(400).json({ error: 'Invalid or expired coupon' });
    const coupon = coupons[0];
    if (order_total < coupon.min_order_amount) {
      return res.status(400).json({ error: `Minimum order amount ₹${coupon.min_order_amount} required` });
    }

    let discount = coupon.discount_type === 'percentage'
      ? (order_total * coupon.discount_value) / 100
      : coupon.discount_value;
    if (coupon.max_discount) discount = Math.min(discount, coupon.max_discount);

    res.json({ valid: true, coupon, discount_amount: discount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Split bill
router.post('/:id/split', auth, async (req, res) => {
  try {
    const { split_type, parts, amounts } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    const orders = await dbQuery(db, 'SELECT * FROM orders WHERE id=?', [req.params.id]);
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    let splitAmounts = [];
    if (split_type === 'equal') {
      const each = parseFloat(order.total) / parts;
      splitAmounts = Array(parts).fill(parseFloat(each.toFixed(2)));
    } else if (split_type === 'custom') {
      splitAmounts = amounts;
    }

    res.json({ split_amounts: splitAmounts, total: order.total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get KOT tickets
router.get('/kot/all', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const { station, status } = req.query;
    let sql = `SELECT k.*, o.order_number, t.name as table_name FROM kot_tickets k
      LEFT JOIN orders o ON k.order_id = o.id LEFT JOIN tables t ON k.table_id = t.id WHERE 1=1`;
    const params = [];
    if (station) { sql += ' AND k.station = ?'; params.push(station); }
    if (status) { sql += ' AND k.status = ?'; params.push(status); }
    sql += ' ORDER BY k.created_at DESC LIMIT 50';
    const kots = await dbQuery(db, sql, params);
    const result = [];
    for (const k of kots) {
      result.push({ ...k, items: await dbQuery(db, 'SELECT * FROM kot_items WHERE kot_id = ?', [k.id]) });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update KOT item status
router.patch('/kot/:kotId/items/:itemId', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    await db.run('UPDATE kot_items SET status=? WHERE id=?', [status, req.params.itemId]);
    const allItems = await dbQuery(db, 'SELECT * FROM kot_items WHERE kot_id=?', [req.params.kotId]);
    const allDone = allItems.every(i => i.status === 'ready');
    if (allDone) {
      await db.run("UPDATE kot_tickets SET status='completed', completed_at=NOW() WHERE id=?", [req.params.kotId]);
    }
    if (req.app.get('io')) {
      req.app.get('io').to('tenant_' + req.tenantSlug).emit('kot_updated', { kot_id: req.params.kotId, item_id: req.params.itemId, status });
      req.app.get('io').to('tenant_' + req.tenantSlug).emit('table_updated');
    }
    res.json({ success: true, kot_completed: allDone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
