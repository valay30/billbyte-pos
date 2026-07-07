const express = require('express');
const router = express.Router();
const { getTenantDb, dbQuery } = require('../database/db');
const { auth } = require('../middleware/auth');



// Get all categories with items count
router.get('/categories', async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const cats = await dbQuery(db, `
      SELECT c.*, COUNT(i.id) as item_count FROM menu_categories c
      LEFT JOIN menu_items i ON i.category_id = c.id AND i.is_available = 1
      GROUP BY c.id ORDER BY c.sort_order, c.name
    `);
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create category
router.post('/categories', auth, async (req, res) => {
  try {
    const { name, description, icon, color } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    await db.run('INSERT INTO menu_categories (name, description, icon, color) VALUES (?, ?, ?, ?)', [name, description, icon, color]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update category
router.put('/categories/:id', auth, async (req, res) => {
  try {
    const { name, description, icon, color, is_active } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    await db.run('UPDATE menu_categories SET name=?, description=?, icon=?, color=?, is_active=? WHERE id=?', [name, description, icon, color, is_active, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all menu items
router.get('/items', async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const { category_id, search, available_only } = req.query;
    let sql = `
      SELECT i.*, c.name as category_name, c.color as category_color
      FROM menu_items i LEFT JOIN menu_categories c ON i.category_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (category_id) { sql += ' AND i.category_id = ?'; params.push(category_id); }
    if (search) { sql += ' AND (i.name ILIKE ? OR i.description ILIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (available_only === 'true') sql += ' AND i.is_available = 1';
    sql += ' ORDER BY i.sort_order, i.name';
    const items = await dbQuery(db, sql, params);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single item with modifiers
router.get('/items/:id', async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const items = await dbQuery(db, 'SELECT i.*, c.name as category_name FROM menu_items i LEFT JOIN menu_categories c ON i.category_id = c.id WHERE i.id = ?', [req.params.id]);
    if (!items.length) return res.status(404).json({ error: 'Item not found' });
    const item = items[0];
    const groups = await dbQuery(db, `
      SELECT mg.*, m.id as mod_id, m.name as mod_name, m.price as mod_price
      FROM modifier_groups mg
      JOIN item_modifier_groups img ON img.group_id = mg.id
      LEFT JOIN modifiers m ON m.group_id = mg.id
      WHERE img.item_id = ?
    `, [req.params.id]);

    const groupMap = {};
    groups.forEach(g => {
      if (!groupMap[g.id]) groupMap[g.id] = { id: g.id, name: g.name, min_select: g.min_select, max_select: g.max_select, is_required: g.is_required, modifiers: [] };
      if (g.mod_id) groupMap[g.id].modifiers.push({ id: g.mod_id, name: g.mod_name, price: g.mod_price });
    });
    item.modifier_groups = Object.values(groupMap);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create menu item
router.post('/items', auth, async (req, res) => {
  try {
    const { category_id, name, description, price, mrp, cost_price, is_veg, tax_category, preparation_time, calories, tags } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    const id = await db.insert(
      'INSERT INTO menu_items (category_id, name, description, price, mrp, cost_price, is_veg, tax_category, preparation_time, calories, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [category_id, name, description, price, mrp, cost_price || 0, is_veg ? 1 : 0, tax_category || 'gst5', preparation_time || 15, calories, tags]
    );
    res.json({ id, name, price });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update menu item
router.put('/items/:id', auth, async (req, res) => {
  try {
    const { category_id, name, description, price, mrp, cost_price, is_veg, is_available, tax_category, preparation_time, calories, tags } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    await db.run(
      'UPDATE menu_items SET category_id=?, name=?, description=?, price=?, mrp=?, cost_price=?, is_veg=?, is_available=?, tax_category=?, preparation_time=?, calories=?, tags=? WHERE id=?',
      [category_id, name, description, price, mrp, cost_price, is_veg ? 1 : 0, is_available ? 1 : 0, tax_category, preparation_time, calories, tags, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle availability
router.patch('/items/:id/toggle', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    await db.run('UPDATE menu_items SET is_available = CASE WHEN is_available=1 THEN 0 ELSE 1 END WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete item
router.delete('/items/:id', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    await db.run('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get modifier groups
router.get('/modifiers', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const groups = await dbQuery(db, 'SELECT * FROM modifier_groups ORDER BY name');
    const mods = await dbQuery(db, 'SELECT * FROM modifiers ORDER BY name');
    const result = groups.map(g => ({ ...g, modifiers: mods.filter(m => m.group_id === g.id) }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get combos
router.get('/combos', async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const combos = await dbQuery(db, 'SELECT * FROM combos WHERE is_available = 1');
    res.json(combos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get settings
router.get('/settings', async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const rows = await dbQuery(db, 'SELECT key, value FROM settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update settings (upsert)
router.put('/settings', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    for (const [key, value] of Object.entries(req.body)) {
      await db.run(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, value]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
