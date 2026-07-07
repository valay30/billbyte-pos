/**
 * seed_pg.js — Seeds the demo tenant with an admin user
 * Run once: node seed_pg.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getTenantDb } = require('./database/db');

async function seed() {
  const slug = process.env.DEFAULT_TENANT_SLUG || 'demo';
  const db = await getTenantDb(slug);

  console.log(`Seeding tenant: ${slug}...`);

  // Check if admin already exists
  const existing = await db.query("SELECT id FROM users WHERE email = 'admin@demo.com'");
  if (existing.length) {
    console.log('✅ Admin user already exists. Skipping.');
    process.exit(0);
  }

  const hash = await bcrypt.hash('admin123', 10);
  await db.run(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
    ['Admin', 'admin@demo.com', hash, 'admin']
  );

  // Seed default settings
  const settings = [
    ['restaurant_name', 'Demo Restaurant'],
    ['loyalty_points_per_rupee', '0.1'],
    ['loyalty_redemption_ratio', '100'],
    ['table_qr_base_url', 'http://localhost:5000/menu'],
    ['receipt_footer', 'Thank you for dining with us!'],
  ];

  for (const [key, value] of settings) {
    await db.run(
      `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value]
    );
  }

  console.log('✅ Demo admin created: admin@demo.com / admin123');
  console.log('✅ Default settings seeded');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
