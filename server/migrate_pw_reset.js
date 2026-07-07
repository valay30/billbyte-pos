require('dotenv').config();
const { pool } = require('./database/db');

async function run() {
  await pool.query(`SET search_path TO "tenant_demo", public`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('✅ password_reset_tokens table ready for demo tenant');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
