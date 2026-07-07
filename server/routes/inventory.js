const express = require('express');
const router = express.Router();
const { getTenantDb, dbQuery } = require('../database/db');
const { auth } = require('../middleware/auth');



// Get all inventory items
router.get('/', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const { low_stock } = req.query;
    let sql = 'SELECT * FROM inventory_items WHERE is_active = 1';
    if (low_stock === 'true') sql += ' AND current_stock <= min_stock';
    sql += ' ORDER BY name';
    res.json(await dbQuery(db, sql));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create inventory item
router.post('/', auth, async (req, res) => {
  try {
    const { name, unit, current_stock, min_stock, cost_per_unit, category, supplier } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    await db.run(
      'INSERT INTO inventory_items (name, unit, current_stock, min_stock, cost_per_unit, category, supplier) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, unit, current_stock, min_stock, cost_per_unit, category, supplier]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update inventory item
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, unit, current_stock, min_stock, cost_per_unit, category, supplier } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    await db.run(
      'UPDATE inventory_items SET name=?, unit=?, current_stock=?, min_stock=?, cost_per_unit=?, category=?, supplier=?, updated_at=NOW() WHERE id=?',
      [name, unit, current_stock, min_stock, cost_per_unit, category, supplier, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adjust stock
router.post('/:id/adjust', auth, async (req, res) => {
  try {
    const { quantity, type, notes } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    const adj = type === 'add' ? quantity : -quantity;
    await db.run('UPDATE inventory_items SET current_stock = current_stock + ?, updated_at=NOW() WHERE id=?', [adj, req.params.id]);
    await db.run(
      'INSERT INTO inventory_transactions (inventory_item_id, type, quantity, notes, created_by) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, type, quantity, notes, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recipes
router.get('/recipes', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const recipes = await dbQuery(db, 'SELECT r.*, m.name as item_name FROM recipes r JOIN menu_items m ON r.menu_item_id = m.id');
    const result = [];
    for (const r of recipes) {
      result.push({
        ...r,
        ingredients: await dbQuery(db, 'SELECT ri.*, inv.name as ingredient_name, inv.unit FROM recipe_ingredients ri JOIN inventory_items inv ON ri.inventory_item_id = inv.id WHERE ri.recipe_id = ?', [r.id])
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create / update recipe
router.post('/recipes', auth, async (req, res) => {
  try {
    const { menu_item_id, ingredients } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    const existing = await dbQuery(db, 'SELECT id FROM recipes WHERE menu_item_id = ?', [menu_item_id]);
    let recipeId;
    if (existing.length) {
      recipeId = existing[0].id;
      await db.run('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipeId]);
    } else {
      recipeId = await db.insert('INSERT INTO recipes (menu_item_id) VALUES (?)', [menu_item_id]);
    }

    for (const ing of ingredients) {
      await db.run(
        'INSERT INTO recipe_ingredients (recipe_id, inventory_item_id, quantity) VALUES (?, ?, ?)',
        [recipeId, ing.inventory_item_id, ing.quantity]
      );
    }
    res.json({ success: true, recipe_id: recipeId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create purchase order
router.post('/purchases', auth, async (req, res) => {
  try {
    const { supplier, expected_date, notes, items } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const poNumber = `PO-${dateStr}-${Math.floor(Math.random() * 1000)}`;
    let total = 0;
    items.forEach(i => total += i.quantity * i.unit_price);

    const poId = await db.insert(
      'INSERT INTO purchase_orders (po_number, supplier, notes, total_amount, created_by) VALUES (?, ?, ?, ?, ?)',
      [poNumber, supplier, notes, total, req.user.id]
    );
    for (const item of items) {
      await db.run(
        'INSERT INTO purchase_items (po_id, inventory_item_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
        [poId, item.inventory_item_id, item.quantity, item.unit_price, item.quantity * item.unit_price]
      );
    }
    res.json({ success: true, po_number: poNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Receive purchase order
router.patch('/purchases/:id/receive', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const po = await dbQuery(db, 'SELECT * FROM purchase_orders WHERE id=?', [req.params.id]);
    if (!po.length) return res.status(404).json({ error: 'PO not found' });
    const items = await dbQuery(db, 'SELECT * FROM purchase_items WHERE po_id=?', [req.params.id]);
    for (const item of items) {
      await db.run('UPDATE inventory_items SET current_stock = current_stock + ?, updated_at=NOW() WHERE id=?', [item.quantity, item.inventory_item_id]);
      await db.run(
        "INSERT INTO inventory_transactions (inventory_item_id, type, quantity, notes) VALUES (?, 'purchase', ?, ?)",
        [item.inventory_item_id, item.quantity, `PO: ${po[0].po_number}`]
      );
    }
    await db.run("UPDATE purchase_orders SET status='received', received_at=NOW() WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get inventory transactions
router.get('/transactions', auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const txns = await dbQuery(db, `
      SELECT it.*, inv.name as item_name, inv.unit FROM inventory_transactions it
      JOIN inventory_items inv ON it.inventory_item_id = inv.id
      ORDER BY it.created_at DESC LIMIT 100
    `);
    res.json(txns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
