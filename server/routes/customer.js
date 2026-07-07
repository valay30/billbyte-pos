// Customer-facing QR ordering routes (no auth required)
const express = require('express');
const router = express.Router();
const { getTenantDb, dbQuery } = require('../database/db');



// Get table info + menu for QR page
router.get('/table/:tableId', async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const tables = await dbQuery(db, 'SELECT id, name, capacity, section, status FROM tables WHERE id=?', [req.params.tableId]);
    if (!tables.length) return res.status(404).json({ error: 'Table not found' });

    const categories = await dbQuery(db, 'SELECT * FROM menu_categories WHERE is_active=1 ORDER BY sort_order');
    const items = await dbQuery(db, `
      SELECT i.id, i.name, i.description, i.price, i.is_veg, i.image_url, i.preparation_time, i.category_id, i.tax_category
      FROM menu_items i WHERE i.is_available=1 ORDER BY i.sort_order, i.name
    `);
    const rows = await dbQuery(db, 'SELECT key, value FROM settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });

    res.json({ table: tables[0], categories, items, settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get active order for table (customer tracks their order)
router.get('/order/:tableId', async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const orders = await dbQuery(db, `
      SELECT o.*, t.name as table_name FROM orders o JOIN tables t ON o.table_id = t.id
      WHERE o.table_id=? AND o.status NOT IN ('paid','cancelled')
      ORDER BY o.created_at DESC LIMIT 1
    `, [req.params.tableId]);
    if (!orders.length) return res.json({ order: null });
    const order = orders[0];
    order.items = await dbQuery(db, 'SELECT * FROM order_items WHERE order_id=?', [order.id]);
    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Place order from QR page
router.post('/order', async (req, res) => {
  try {
    const { table_id, items, customer_name, customer_phone, notes } = req.body;
    const db = await getTenantDb(req.tenantSlug);

    // Check for existing active order on table (add to it)
    const existingOrders = await dbQuery(db, "SELECT id FROM orders WHERE table_id=? AND status NOT IN ('paid','cancelled')", [table_id]);

    if (existingOrders.length) {
      const orderId = existingOrders[0].id;
      for (const item of items) {
        const total = item.unit_price * item.quantity;
        await db.run(
          'INSERT INTO order_items (order_id, item_id, item_name, quantity, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [orderId, item.item_id, item.item_name, item.quantity, item.unit_price, total, item.notes]
        );
      }

      const allItems = await dbQuery(db, 'SELECT * FROM order_items WHERE order_id=?', [orderId]);
      const subtotal = allItems.reduce((s, i) => s + parseFloat(i.total_price), 0);
      const cgst = (subtotal * 2.5) / 100;
      const sgst = (subtotal * 2.5) / 100;
      await db.run(
        'UPDATE orders SET subtotal=?, cgst=?, sgst=?, total=?, updated_at=NOW() WHERE id=?',
        [subtotal, cgst, sgst, subtotal + cgst + sgst, orderId]
      );

      const kotNum = `KOT-QR-${Date.now()}`;
      const kotId = await db.insert(
        'INSERT INTO kot_tickets (kot_number, order_id, table_id, station) VALUES (?, ?, ?, ?)',
        [kotNum, orderId, table_id, 'kitchen']
      );

      const newItems = await dbQuery(db, 'SELECT * FROM order_items WHERE order_id=? AND kot_printed=0', [orderId]);
      for (const oi of newItems) {
        await db.run('INSERT INTO kot_items (kot_id, order_item_id, item_name, quantity, notes) VALUES (?, ?, ?, ?, ?)', [kotId, oi.id, oi.item_name, oi.quantity, oi.notes]);
        await db.run('UPDATE order_items SET kot_printed=1 WHERE id=?', [oi.id]);
      }

      if (req.app.get('io')) {
        req.app.get('io').to('tenant_' + req.tenantSlug).emit('qr_order', { order_id: orderId, table_id, kot_number: kotNum });
        req.app.get('io').to('tenant_' + req.tenantSlug).emit('table_updated');
      }
      return res.json({ success: true, order_id: orderId, kot_number: kotNum, type: 'added' });
    }

    // Create new order
    const orderNumber = `ORD-QR-${Date.now()}`;
    let subtotal = 0;
    items.forEach(item => { subtotal += item.unit_price * item.quantity; });
    const cgst = (subtotal * 2.5) / 100;
    const sgst = (subtotal * 2.5) / 100;
    const total = subtotal + cgst + sgst;

    const orderId = await db.insert(
      `INSERT INTO orders (order_number, table_id, order_type, subtotal, cgst, sgst, total, notes, source, status)
       VALUES (?, ?, 'dine_in', ?, ?, ?, ?, ?, 'qr', 'pending')`,
      [orderNumber, table_id, subtotal, cgst, sgst, total, notes]
    );

    for (const item of items) {
      await db.run(
        'INSERT INTO order_items (order_id, item_id, item_name, quantity, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [orderId, item.item_id, item.item_name, item.quantity, item.unit_price, item.unit_price * item.quantity, item.notes]
      );
    }

    await db.run("UPDATE tables SET status='occupied' WHERE id=?", [table_id]);

    const kotNum = `KOT-QR-${Date.now()}`;
    const kotId = await db.insert(
      'INSERT INTO kot_tickets (kot_number, order_id, table_id, station) VALUES (?, ?, ?, ?)',
      [kotNum, orderId, table_id, 'kitchen']
    );

    const orderItemsRows = await dbQuery(db, 'SELECT * FROM order_items WHERE order_id=?', [orderId]);
    for (const oi of orderItemsRows) {
      await db.run('INSERT INTO kot_items (kot_id, order_item_id, item_name, quantity, notes) VALUES (?, ?, ?, ?, ?)', [kotId, oi.id, oi.item_name, oi.quantity, oi.notes]);
      await db.run('UPDATE order_items SET kot_printed=1 WHERE id=?', [oi.id]);
    }

    if (req.app.get('io')) {
      req.app.get('io').to('tenant_' + req.tenantSlug).emit('qr_order', { order_id: orderId, table_id, kot_number: kotNum, order_number: orderNumber });
      req.app.get('io').to('tenant_' + req.tenantSlug).emit('table_updated');
    }

    res.json({ success: true, order_id: orderId, order_number: orderNumber, kot_number: kotNum, type: 'new' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Submit feedback from QR
router.post('/feedback', async (req, res) => {
  try {
    const { order_id, rating, food_rating, service_rating, ambiance_rating, comment } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    await db.run(
      'INSERT INTO feedback (order_id, rating, food_rating, service_rating, ambiance_rating, comment) VALUES (?, ?, ?, ?, ?, ?)',
      [order_id, rating, food_rating, service_rating, ambiance_rating, comment]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
