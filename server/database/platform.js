/**
 * platform.js — Tenant Registry (PostgreSQL / Neon)
 * Stores the list of all tenants (restaurants) in the 'public' schema.
 */
const { Pool } = require('pg');
const { toPositional, normalizeSql, cleanParams } = require('./db');

let pool = null;
let initialized = false;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

async function getPlatformDb() {
  const p = getPool();

  if (!initialized) {
    await p.query(`
      CREATE TABLE IF NOT EXISTS public.tenants (
        id        SERIAL PRIMARY KEY,
        slug      TEXT UNIQUE NOT NULL,
        name      TEXT NOT NULL,
        status    TEXT DEFAULT 'active',
        admin_email TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    initialized = true;
    console.log('✅ Platform DB (PostgreSQL) ready');
  }

  return p;
}

async function queryPlatform(sql, params = []) {
  const p = getPool();
  const result = await p.query(toPositional(normalizeSql(sql)), cleanParams(params));
  return result.rows;
}

async function scalarPlatform(sql, params = []) {
  const p = getPool();
  const result = await p.query(toPositional(normalizeSql(sql)), cleanParams(params));
  if (!result.rows[0]) return null;
  return Object.values(result.rows[0])[0];
}

// No-op — PostgreSQL commits automatically
function savePlatformDb() {}

module.exports = { getPlatformDb, savePlatformDb, queryPlatform, scalarPlatform };
