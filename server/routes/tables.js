const express = require('express');
const router = express.Router();
const { getTenantDb, dbQuery } = require('../database/db');
const { auth } = require('../middleware/auth');
const QRCode = require('qrcode');



// Get all tables
router.get('/', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const tables = await dbQuery(db, 'SELECT * FROM tables ORDER BY LENGTH(name), name, id');
    tables.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }));
    // Get active order for each table
    const result = [];
    for (const t of tables) {
      const orders = await dbQuery(db,
        "SELECT id, order_number, status, total FROM orders WHERE table_id = ? AND status NOT IN ('paid', 'cancelled') ORDER BY created_at DESC LIMIT 1",
        [t.id]);
      result.push({ ...t, active_order: orders[0] || null });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create table
router.post('/', auth, async (req, res) => {
  try {
    const { name, capacity, section, x_pos, y_pos, shape } = req.body;
    const db = await getTenantDb(req.tenantSlug);

    const existing = await dbQuery(db, 'SELECT id FROM tables WHERE name = ?', [name]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Table with this name already exists' });
    }

    const id = await db.insert(
      'INSERT INTO tables (name, capacity, section, x_pos, y_pos, shape) VALUES (?, ?, ?, ?, ?, ?)',
      [name, capacity, section, x_pos || 0, y_pos || 0, shape || 'square']
    );
    if (req.app.get('io')) req.app.get('io').to('tenant_' + req.tenantSlug).emit('table_updated');
    res.json({ id, name, capacity, section, status: 'available' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update table
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, capacity, section, status, x_pos, y_pos, shape } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    await db.run(
      'UPDATE tables SET name=?, capacity=?, section=?, status=?, x_pos=?, y_pos=?, shape=? WHERE id=?',
      [name, capacity, section, status, x_pos, y_pos, shape, req.params.id]
    );
    if (req.app.get('io')) req.app.get('io').to('tenant_' + req.tenantSlug).emit('table_updated');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete table
router.delete('/:id', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    await db.run('DELETE FROM tables WHERE id = ?', [req.params.id]);
    if (req.app.get('io')) req.app.get('io').to('tenant_' + req.tenantSlug).emit('table_updated');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate QR Code for table
router.get('/:id/qr', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    // Use the single-domain APP_URL for all QR codes, ignoring the old subdomain settings
    const appUrl = process.env.APP_URL || 'https://billbyte-pos.onrender.com';
    const url = `${appUrl}/menu/${req.params.id}?tenant=${req.tenantSlug}`;
    
    const qrData = await QRCode.toDataURL(url, { width: 300, margin: 2 });
    await db.run('UPDATE tables SET qr_code = ? WHERE id = ?', [qrData, req.params.id]);
    res.json({ qr_code: qrData, url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get reservations
router.get('/reservations', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const reservations = await dbQuery(db, `
      SELECT r.*, t.name as table_name FROM reservations r
      LEFT JOIN tables t ON r.table_id = t.id
      ORDER BY r.reservation_date, r.reservation_time
    `);
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create reservation
router.post('/reservations', auth, async (req, res) => {
  try {
    const { table_id, customer_name, customer_phone, party_size, reservation_date, reservation_time, notes } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    await db.run(
      'INSERT INTO reservations (table_id, customer_name, customer_phone, party_size, reservation_date, reservation_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [table_id, customer_name, customer_phone, party_size, reservation_date, reservation_time, notes]
    );
    if (req.app.get('io')) req.app.get('io').to('tenant_' + req.tenantSlug).emit('table_updated');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Merge tables
router.post('/merge', auth, async (req, res) => {
  try {
    const { table_ids, master_table_id } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    for (const tid of table_ids) {
      if (tid !== master_table_id) {
        await db.run("UPDATE tables SET status='merged' WHERE id=?", [tid]);
        await db.run("UPDATE orders SET table_id=? WHERE table_id=? AND status NOT IN ('paid','cancelled')", [master_table_id, tid]);
      }
    }
    if (req.app.get('io')) req.app.get('io').to('tenant_' + req.tenantSlug).emit('table_updated');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
