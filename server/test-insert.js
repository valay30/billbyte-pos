require('dotenv').config({ path: './.env' });
const { queryPlatform, getPlatformDb } = require('./database/platform');
const { pool } = require('./database/db');

async function test() {
  await getPlatformDb();
  try {
    await pool.query("INSERT INTO tenants (slug, name, admin_email) VALUES ('cafeone', 'Cafe 1', 'admin@cafe1.com') ON CONFLICT DO NOTHING");
  } catch (e) {
    console.error(e);
  }
  
  const res = await queryPlatform("SELECT * FROM tenants WHERE slug = ?", ['cafeone']);
  console.log('Result:', res);
  process.exit(0);
}
test();
