const express = require('express');
const router = express.Router();
const { getTenantDb, dbQuery } = require('../database/db');
const { auth } = require('../middleware/auth');



async function scalar(db, sql, params = []) {
  const result = await db.get(sql, params);
  if (!result) return 0;
  return parseFloat(Object.values(result)[0]) || 0;
}

// Dashboard summary
router.get('/dashboard', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const today = new Date().toISOString().slice(0, 10);

    const todayRevenue = await scalar(db, "SELECT COALESCE(SUM(total),0) as v FROM orders WHERE status='paid' AND created_at::date=?", [today]);
    const todayOrders = await scalar(db, "SELECT COUNT(*) as v FROM orders WHERE status='paid' AND created_at::date=?", [today]);
    const activeOrders = await scalar(db, "SELECT COUNT(*) as v FROM orders WHERE status NOT IN ('paid','cancelled')");
    const activeTables = await scalar(db, "SELECT COUNT(*) as v FROM tables WHERE status='occupied'");
    const totalTables = await scalar(db, 'SELECT COUNT(*) as v FROM tables');
    const pendingKots = await scalar(db, "SELECT COUNT(*) as v FROM kot_tickets WHERE status='pending'");
    const lowStock = await scalar(db, 'SELECT COUNT(*) as v FROM inventory_items WHERE current_stock <= min_stock AND is_active=1');

    // Last 7 days revenue
    const dailyRevenue = await dbQuery(db, `
      SELECT created_at::date as day, COALESCE(SUM(total),0) as revenue, COUNT(*) as orders
      FROM orders WHERE status='paid' AND created_at::date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY created_at::date ORDER BY day
    `);

    // Top items today
    const topItems = await dbQuery(db, `
      SELECT oi.item_name, SUM(oi.quantity) as qty, SUM(oi.total_price) as revenue
      FROM order_items oi JOIN orders o ON oi.order_id = o.id
      WHERE o.status='paid' AND o.created_at::date=?
      GROUP BY oi.item_name ORDER BY qty DESC LIMIT 5
    `, [today]);

    // Payment method breakdown today
    const paymentMethods = await dbQuery(db, `
      SELECT p.payment_method, SUM(p.amount) as total
      FROM payments p JOIN orders o ON p.order_id = o.id
      WHERE o.created_at::date=? AND o.status='paid'
      GROUP BY p.payment_method
    `, [today]);

    res.json({
      today_revenue: todayRevenue,
      today_orders: todayOrders,
      active_orders: activeOrders,
      active_tables: activeTables,
      total_tables: totalTables,
      pending_kots: pendingKots,
      low_stock_count: lowStock,
      daily_revenue: dailyRevenue,
      top_items: topItems,
      payment_breakdown: paymentMethods,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sales report
router.get('/sales', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const { from, to, group_by = 'day' } = req.query;
    const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);

    const groupExpr = group_by === 'month' ? "TO_CHAR(created_at, 'YYYY-MM')" : 'created_at::date';
    const sales = await dbQuery(db, `
      SELECT ${groupExpr} as period,
        COUNT(*) as orders,
        SUM(subtotal) as subtotal,
        SUM(cgst) as cgst, SUM(sgst) as sgst,
        SUM(discount_amount) as total_discount,
        SUM(total) as revenue
      FROM orders WHERE status='paid'
        AND created_at::date BETWEEN ? AND ?
      GROUP BY period ORDER BY period
    `, [fromDate, toDate]);

    const itemWise = await dbQuery(db, `
      SELECT oi.item_name, mi.category_id, c.name as category,
        SUM(oi.quantity) as qty, SUM(oi.total_price) as revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN menu_items mi ON oi.item_id = mi.id
      LEFT JOIN menu_categories c ON mi.category_id = c.id
      WHERE o.status='paid' AND o.created_at::date BETWEEN ? AND ?
      GROUP BY oi.item_name, mi.category_id, c.name ORDER BY revenue DESC LIMIT 20
    `, [fromDate, toDate]);

    const categoryWise = await dbQuery(db, `
      SELECT c.name as category, SUM(oi.quantity) as qty, SUM(oi.total_price) as revenue
      FROM order_items oi JOIN orders o ON oi.order_id = o.id
      JOIN menu_items mi ON oi.item_id = mi.id
      JOIN menu_categories c ON mi.category_id = c.id
      WHERE o.status='paid' AND o.created_at::date BETWEEN ? AND ?
      GROUP BY c.name ORDER BY revenue DESC
    `, [fromDate, toDate]);

    const totals = {
      orders: sales.reduce((s, r) => s + parseInt(r.orders), 0),
      revenue: sales.reduce((s, r) => s + parseFloat(r.revenue), 0),
      subtotal: sales.reduce((s, r) => s + parseFloat(r.subtotal), 0),
      cgst: sales.reduce((s, r) => s + parseFloat(r.cgst), 0),
      sgst: sales.reduce((s, r) => s + parseFloat(r.sgst), 0),
      discount: sales.reduce((s, r) => s + parseFloat(r.total_discount || 0), 0),
    };

    res.json({ sales, item_wise: itemWise, category_wise: categoryWise, totals, from: fromDate, to: toDate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Staff performance
router.get('/staff', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const { from, to } = req.query;
    const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);

    const staff = await dbQuery(db, `
      SELECT u.name, u.role, COUNT(o.id) as orders_handled, COALESCE(SUM(o.total), 0) as revenue_generated
      FROM users u LEFT JOIN orders o ON o.waiter_id = u.id
        AND o.status='paid' AND o.created_at::date BETWEEN ? AND ?
      WHERE u.role IN ('waiter','cashier') AND u.is_active=1
      GROUP BY u.id, u.name, u.role ORDER BY revenue_generated DESC
    `, [fromDate, toDate]);

    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inventory consumption report
router.get('/inventory', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const items = await dbQuery(db, `
      SELECT inv.name, inv.unit, inv.current_stock, inv.min_stock, inv.cost_per_unit,
        inv.current_stock * inv.cost_per_unit as stock_value,
        CASE WHEN inv.current_stock <= inv.min_stock THEN 1 ELSE 0 END as is_low
      FROM inventory_items inv WHERE inv.is_active=1 ORDER BY inv.name
    `);
    const lowStock = items.filter(i => i.is_low);
    const totalValue = items.reduce((s, i) => s + parseFloat(i.stock_value), 0);
    res.json({ items, low_stock: lowStock, total_value: totalValue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// P&L report
router.get('/pnl', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const { from, to } = req.query;
    const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);

    const revenue = await scalar(db, "SELECT COALESCE(SUM(total),0) as v FROM orders WHERE status='paid' AND created_at::date BETWEEN ? AND ?", [fromDate, toDate]);
    const expenses = await scalar(db, 'SELECT COALESCE(SUM(amount),0) as v FROM expenses WHERE expense_date BETWEEN ? AND ?', [fromDate, toDate]);
    const gst = await scalar(db, "SELECT COALESCE(SUM(cgst+sgst),0) as v FROM orders WHERE status='paid' AND created_at::date BETWEEN ? AND ?", [fromDate, toDate]);
    const discounts = await scalar(db, "SELECT COALESCE(SUM(discount_amount),0) as v FROM orders WHERE status='paid' AND created_at::date BETWEEN ? AND ?", [fromDate, toDate]);
    const expByCategory = await dbQuery(db, 'SELECT category, SUM(amount) as total FROM expenses WHERE expense_date BETWEEN ? AND ? GROUP BY category', [fromDate, toDate]);

    res.json({
      revenue, gst, discounts, expenses,
      gross_profit: revenue - gst - discounts,
      net_profit: revenue - gst - discounts - expenses,
      expense_by_category: expByCategory,
      from: fromDate, to: toDate,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer analytics
router.get('/customers', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const total = await scalar(db, 'SELECT COUNT(*) as v FROM customers WHERE is_active=1');
    const byTier = await dbQuery(db, 'SELECT loyalty_tier, COUNT(*) as count FROM customers WHERE is_active=1 GROUP BY loyalty_tier');
    const newThisMonth = await scalar(db, "SELECT COUNT(*) as v FROM customers WHERE TO_CHAR(created_at, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')");
    const topSpenders = await dbQuery(db, 'SELECT name, phone, total_spent, total_visits, loyalty_tier, loyalty_points FROM customers WHERE is_active=1 ORDER BY total_spent DESC LIMIT 10');
    res.json({ total, by_tier: byTier, new_this_month: newThisMonth, top_spenders: topSpenders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
