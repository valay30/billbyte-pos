require('dotenv').config({ path: './.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const resAll = await pool.query('SELECT slug FROM tenants');
  console.log('All slugs:', resAll.rows);

  const res1 = await pool.query('SELECT * FROM tenants WHERE slug = $1', ['cafetwo']);
  console.log('With $1 array:', res1.rows);
  
  const res2 = await pool.query("SELECT * FROM tenants WHERE slug = 'cafetwo'");
  console.log('With hardcoded string:', res2.rows);

  const { queryPlatform, getPlatformDb } = require('./database/platform');
  await getPlatformDb();
  const res3 = await queryPlatform('SELECT * FROM tenants WHERE slug = ?', ['cafetwo']);
  console.log('With queryPlatform and ?:', res3);

  process.exit(0);
}

run();
