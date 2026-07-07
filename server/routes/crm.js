const express = require('express');
const router = express.Router();
const { getTenantDb, dbQuery } = require('../database/db');
const { auth } = require('../middleware/auth');



// Get all customers
router.get('/', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const { search, tier } = req.query;
    let sql = 'SELECT * FROM customers WHERE is_active = 1';
    const params = [];
    if (search) { sql += ' AND (name ILIKE ? OR phone ILIKE ? OR email ILIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (tier) { sql += ' AND loyalty_tier = ?'; params.push(tier); }
    sql += ' ORDER BY name';
    res.json(await dbQuery(db, sql, params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get customer by phone (for quick lookup)
router.get('/phone/:phone', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const customers = await dbQuery(db, 'SELECT * FROM customers WHERE phone = ? AND is_active = 1', [req.params.phone]);
    if (!customers.length) return res.status(404).json({ error: 'Customer not found' });
    res.json(customers[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get customer with history
router.get('/:id', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const customers = await dbQuery(db, 'SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customers.length) return res.status(404).json({ error: 'Customer not found' });
    const customer = customers[0];
    customer.orders = await dbQuery(db, 'SELECT id, order_number, total, status, created_at FROM orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 10', [customer.id]);
    customer.loyalty_history = await dbQuery(db, 'SELECT * FROM loyalty_transactions WHERE customer_id=? ORDER BY created_at DESC LIMIT 20', [customer.id]);
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create customer
router.post('/', auth, async (req, res) => {
  try {
    const { name, phone, email, address, birthday, anniversary, notes } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    const id = await db.insert(
      'INSERT INTO customers (name, phone, email, address, birthday, anniversary, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, phone, email, address, birthday, anniversary, notes]
    );
    res.json({ id, name, phone, email, loyalty_points: 0, loyalty_tier: 'bronze' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Phone number already registered' });
    res.status(500).json({ error: err.message });
  }
});

// Update customer
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, phone, email, address, birthday, anniversary, notes } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    await db.run(
      'UPDATE customers SET name=?, phone=?, email=?, address=?, birthday=?, anniversary=?, notes=?, updated_at=NOW() WHERE id=?',
      [name, phone, email, address, birthday, anniversary, notes, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Loyalty stats
router.get('/loyalty/stats', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const tiers = await dbQuery(db, `
      SELECT loyalty_tier, COUNT(*) as count, SUM(loyalty_points) as total_points, AVG(total_spent) as avg_spent
      FROM customers WHERE is_active=1 GROUP BY loyalty_tier
    `);
    const topCustomers = await dbQuery(db, 'SELECT * FROM customers WHERE is_active=1 ORDER BY total_spent DESC LIMIT 10');
    res.json({ tiers, top_customers: topCustomers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit feedback
router.post('/feedback', async (req, res) => {
  try {
    const { order_id, customer_id, rating, food_rating, service_rating, ambiance_rating, comment } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    await db.run(
      'INSERT INTO feedback (order_id, customer_id, rating, food_rating, service_rating, ambiance_rating, comment) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [order_id, customer_id, rating, food_rating, service_rating, ambiance_rating, comment]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all feedback
router.get('/feedback/all', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const feedback = await dbQuery(db, `
      SELECT f.*, c.name as customer_name, o.order_number FROM feedback f
      LEFT JOIN customers c ON f.customer_id = c.id
      LEFT JOIN orders o ON f.order_id = o.id
      ORDER BY f.created_at DESC
    `);
    res.json(feedback);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Expenses CRUD
router.get('/expenses/all', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const exps = await dbQuery(db, 'SELECT * FROM expenses ORDER BY expense_date DESC LIMIT 100');
    res.json(exps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/expenses', auth, async (req, res) => {
  try {
    const { category, description, amount, expense_date, payment_method } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    await db.run(
      'INSERT INTO expenses (category, description, amount, expense_date, payment_method, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [category, description, amount, expense_date, payment_method, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
