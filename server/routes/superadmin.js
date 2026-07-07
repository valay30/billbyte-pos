/**
 * superadmin.js — Platform Super Admin API
 * Protected by SUPERADMIN_KEY in .env — NOT by restaurant JWT tokens.
 * Used to create, manage, and view all tenant restaurants.
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getPlatformDb, queryPlatform, savePlatformDb } = require('../database/platform');
const { getTenantDb, dbQuery } = require('../database/db');
const { initSchema } = require('../database/schema');
const { pool } = require('../database/db');
const { sendWelcomeEmail } = require('../utils/email');

// Super admin key authentication middleware
function superAdminAuth(req, res, next) {
  const key = req.headers['x-superadmin-key'] || req.query.key;
  if (!key || key !== process.env.SUPERADMIN_KEY) {
    return res.status(401).json({ error: 'Invalid super admin key' });
  }
  next();
}



// List all tenants
router.get('/tenants', superAdminAuth, async (req, res) => {
  try {
    await getPlatformDb();
    const tenants = await queryPlatform('SELECT * FROM tenants ORDER BY created_at DESC');
    // Attach order stats from each tenant's DB
    const enriched = await Promise.all(tenants.map(async t => {
      try {
        const db = await getTenantDb(t.slug);
        const orderCount = await db.get("SELECT COUNT(*) as c FROM orders WHERE status='paid'");
        const userCount = await db.get("SELECT COUNT(*) as c FROM users WHERE is_active=1");
        return {
          ...t,
          total_orders: parseInt(orderCount?.c || 0),
          total_users: parseInt(userCount?.c || 0),
        };
      } catch { return t; }
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new tenant (restaurant)
router.post('/tenants', superAdminAuth, async (req, res) => {
  try {
    const { slug, name, admin_name, admin_email, admin_password } = req.body;

    if (!slug || !name || !admin_email || !admin_password) {
      return res.status(400).json({ error: 'slug, name, admin_email and admin_password are required' });
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({ error: 'Slug must be lowercase letters, numbers and hyphens only' });
    }

    await getPlatformDb();

    // Check slug not taken
    const existing = await queryPlatform('SELECT id FROM tenants WHERE slug = ?', [slug]);
    if (existing.length) {
      return res.status(400).json({ error: `Slug "${slug}" is already taken` });
    }

    // Register in platform DB
    await pool.query(
      'INSERT INTO tenants (slug, name, admin_email) VALUES ($1, $2, $3)',
      [slug, name, admin_email]
    );

    // Initialize tenant schema in PostgreSQL
    await initSchema(slug);

    // Create admin user in tenant DB
    const tenantDb = await getTenantDb(slug);
    const hash = await bcrypt.hash(admin_password, 10);
    await tenantDb.run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [admin_name || 'Admin', admin_email, hash, 'admin']
    );

    // Set restaurant default settings in tenant DB
    const settingsToInsert = [
      ['restaurant_name', name],
      ['loyalty_points_per_rupee', '0.1'],
      ['loyalty_redemption_ratio', '100'],
      ['table_qr_base_url', `https://${slug}.${process.env.PLATFORM_DOMAIN || 'billbyte.com'}/menu`],
      ['receipt_footer', 'Thank you for dining with us!'],
    ];
    for (const [key, value] of settingsToInsert) {
      await tenantDb.run(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value]
      );
    }

    const loginUrl = `${process.env.APP_URL || 'http://localhost:5000'}`;

    // Send welcome email (non-blocking — don't let email failure block the response)
    sendWelcomeEmail({
      to: admin_email,
      restaurantName: name,
      slug,
      adminEmail: admin_email,
      loginUrl,
    }).then(() => {
      console.log(`📧 Welcome email sent to ${admin_email}`);
    }).catch(err => {
      console.warn(`⚠️  Welcome email failed (non-critical): ${err.message}`);
    });

    res.json({
      success: true,
      tenant: { slug, name, admin_email, status: 'active' },
      login_url: loginUrl,
      message: `Restaurant "${name}" created. Login at the URL above with ${admin_email}.`
    });
  } catch (err) {
    console.error('Create tenant error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update tenant (suspend / activate / rename)
router.put('/tenants/:slug', superAdminAuth, async (req, res) => {
  try {
    const { status, name } = req.body;
    await pool.query(
      'UPDATE tenants SET status=$1, name=$2, updated_at=NOW() WHERE slug=$3',
      [status, name, req.params.slug]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset admin password for a tenant
router.post('/tenants/:slug/reset-password', superAdminAuth, async (req, res) => {
  try {
    const { admin_email, new_password } = req.body;
    const db = await getTenantDb(req.params.slug);
    const hash = await bcrypt.hash(new_password, 10);
    await db.run('UPDATE users SET password=? WHERE email=? AND role=?', [hash, admin_email, 'admin']);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete tenant (drops their PostgreSQL schema)
router.delete('/tenants/:slug', superAdminAuth, async (req, res) => {
  try {
    const schemaName = `tenant_${req.params.slug.replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`;
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.query('DELETE FROM tenants WHERE slug=$1', [req.params.slug]);
    res.json({ success: true, message: `Tenant ${req.params.slug} and their data have been permanently deleted.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Platform health / stats
router.get('/stats', superAdminAuth, async (req, res) => {
  try {
    await getPlatformDb();
    const tenants = await queryPlatform('SELECT * FROM tenants');
    res.json({
      total_restaurants: tenants.length,
      active: tenants.filter(t => t.status === 'active').length,
      suspended: tenants.filter(t => t.status === 'suspended').length,
      tenants,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
