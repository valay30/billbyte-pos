/**
 * db.js — Multi-Tenant Database Manager (PostgreSQL / Neon)
 * Each tenant gets their own isolated schema inside one PostgreSQL database.
 * Schema naming: tenant_{slug}  (e.g. tenant_caferoy, tenant_demo)
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PG client', err);
});

/** Convert SQLite ? placeholders to PostgreSQL $1, $2, ... */
function toPositional(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Replace SQLite-specific functions with PostgreSQL equivalents */
function normalizeSql(sql) {
  return sql
    .replace(/datetime\('now'\)/gi, 'NOW()')
    .replace(/date\('now'\)/gi, 'CURRENT_DATE')
    .replace(/date\('now',\s*([^)]+)\)/gi, "(CURRENT_DATE + $1)")
    .replace(/date\(([^)]+)\)/gi, '($1)::date')
    .replace(/strftime\('%Y-%m',\s*([^)]+)\)/gi, "TO_CHAR($1, 'YYYY-MM')")
    .replace(/INSERT OR REPLACE INTO/gi, 'INSERT INTO')
    .replace(/GROUP_CONCAT\(([^)]+)\)/gi, "STRING_AGG($1, ',')")
    .replace(/ON CONFLICT\s*\([^)]+\)\s*DO REPLACE/gi, '');
}

/** Clean undefined params to null */
function cleanParams(params) {
  if (Array.isArray(params)) return params.map(p => (p === undefined ? null : p));
  if (params && typeof params === 'object') {
    const cleaned = {};
    for (const k in params) cleaned[k] = params[k] === undefined ? null : params[k];
    return cleaned;
  }
  return params;
}

/**
 * Returns a db helper scoped to a tenant's schema.
 * All SQL is automatically run inside SET search_path TO tenant_{slug}.
 */
async function getTenantDb(slug) {
  if (!slug) throw new Error('Tenant slug is required');
  const schemaName = `tenant_${slug.replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`;

  async function runInSchema(sql, params = []) {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}", public`);
      const normalized = normalizeSql(toPositional(sql));
      return await client.query(normalized, cleanParams(params));
    } finally {
      client.release();
    }
  }

  return {
    /** SELECT many rows → returns array */
    query: async (sql, params = []) => {
      const result = await runInSchema(sql, params);
      return result.rows;
    },
    /** SELECT one row → returns object or null */
    get: async (sql, params = []) => {
      const result = await runInSchema(sql, params);
      return result.rows[0] || null;
    },
    /** INSERT / UPDATE / DELETE (no return value) */
    run: async (sql, params = []) => {
      await runInSchema(sql, params);
    },
    /** INSERT ... RETURNING id → returns the new row id (integer) */
    insert: async (sql, params = []) => {
      // Append RETURNING id so we get back the new PK
      const insertSql = sql.trimEnd().replace(/;?$/, '') + ' RETURNING id';
      const result = await runInSchema(insertSql, params);
      return result.rows[0].id;
    },
    /** Run raw SQL string (schema creation, etc.) */
    exec: async (sql) => {
      const client = await pool.connect();
      try {
        await client.query(`SET search_path TO "${schemaName}", public`);
        await client.query(normalizeSql(sql));
      } finally {
        client.release();
      }
    },
    /** Expose the schema name for schema creation use */
    schemaName,
    /** Expose pool for direct use if needed */
    pool,
  };
}

/** Global dbQuery helper — replaces synchronous dbQuery(db, sql, params) */
async function dbQuery(db, sql, params = []) {
  return db.query(sql, params);
}

// No-op stubs (kept for API compatibility with route files)
function saveTenantDb() {}
function saveAllTenantDbs() {}
function getTenantDbPath() { return null; }

module.exports = {
  getTenantDb, saveTenantDb, saveAllTenantDbs, getTenantDbPath,
  dbQuery, cleanParams, pool, toPositional, normalizeSql,
};
