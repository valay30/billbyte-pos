/**
 * schema.js — PostgreSQL Schema Initializer
 * Creates a dedicated schema + all tables for a given tenant slug.
 */
const { pool } = require('./db');

async function initSchema(tenantSlug = 'demo') {
  const schemaName = `tenant_${tenantSlug.replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`;
  const client = await pool.connect();

  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await client.query(`SET search_path TO "${schemaName}", public`);

    await client.query(`
      -- Users & Auth
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        email       TEXT UNIQUE NOT NULL,
        password    TEXT NOT NULL,
        role        TEXT NOT NULL DEFAULT 'waiter',
        phone       TEXT,
        is_active   SMALLINT DEFAULT 1,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );

      -- Restaurant Settings
      CREATE TABLE IF NOT EXISTS settings (
        id         SERIAL PRIMARY KEY,
        key        TEXT UNIQUE NOT NULL,
        value      TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Tables
      CREATE TABLE IF NOT EXISTS tables (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        capacity   INTEGER DEFAULT 4,
        section    TEXT DEFAULT 'Main Hall',
        status     TEXT DEFAULT 'available',
        qr_code    TEXT,
        x_pos      INTEGER DEFAULT 0,
        y_pos      INTEGER DEFAULT 0,
        shape      TEXT DEFAULT 'square',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Reservations
      CREATE TABLE IF NOT EXISTS reservations (
        id               SERIAL PRIMARY KEY,
        table_id         INTEGER REFERENCES tables(id),
        customer_name    TEXT NOT NULL,
        customer_phone   TEXT,
        party_size       INTEGER DEFAULT 2,
        reservation_date TEXT NOT NULL,
        reservation_time TEXT NOT NULL,
        status           TEXT DEFAULT 'confirmed',
        notes            TEXT,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      );

      -- Menu Categories
      CREATE TABLE IF NOT EXISTS menu_categories (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        icon        TEXT,
        color       TEXT DEFAULT '#FF6B35',
        sort_order  INTEGER DEFAULT 0,
        is_active   SMALLINT DEFAULT 1,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      -- Menu Items
      CREATE TABLE IF NOT EXISTS menu_items (
        id               SERIAL PRIMARY KEY,
        category_id      INTEGER REFERENCES menu_categories(id),
        name             TEXT NOT NULL,
        description      TEXT,
        price            DECIMAL(10,2) NOT NULL,
        mrp              DECIMAL(10,2),
        cost_price       DECIMAL(10,2) DEFAULT 0,
        image_url        TEXT,
        is_veg           SMALLINT DEFAULT 1,
        is_available     SMALLINT DEFAULT 1,
        tax_category     TEXT DEFAULT 'gst5',
        preparation_time INTEGER DEFAULT 15,
        calories         INTEGER,
        tags             TEXT,
        sort_order       INTEGER DEFAULT 0,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      );

      -- Modifier Groups
      CREATE TABLE IF NOT EXISTS modifier_groups (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        min_select  INTEGER DEFAULT 0,
        max_select  INTEGER DEFAULT 1,
        is_required SMALLINT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS modifiers (
        id           SERIAL PRIMARY KEY,
        group_id     INTEGER REFERENCES modifier_groups(id),
        name         TEXT NOT NULL,
        price        DECIMAL(10,2) DEFAULT 0,
        is_available SMALLINT DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS item_modifier_groups (
        item_id  INTEGER REFERENCES menu_items(id),
        group_id INTEGER REFERENCES modifier_groups(id),
        PRIMARY KEY (item_id, group_id)
      );

      -- Combos
      CREATE TABLE IF NOT EXISTS combos (
        id           SERIAL PRIMARY KEY,
        name         TEXT NOT NULL,
        description  TEXT,
        price        DECIMAL(10,2) NOT NULL,
        image_url    TEXT,
        is_available SMALLINT DEFAULT 1,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS combo_items (
        combo_id INTEGER REFERENCES combos(id),
        item_id  INTEGER REFERENCES menu_items(id),
        quantity INTEGER DEFAULT 1,
        PRIMARY KEY (combo_id, item_id)
      );

      -- Customers / CRM
      CREATE TABLE IF NOT EXISTS customers (
        id             SERIAL PRIMARY KEY,
        name           TEXT NOT NULL,
        phone          TEXT UNIQUE,
        email          TEXT,
        address        TEXT,
        loyalty_points INTEGER DEFAULT 0,
        loyalty_tier   TEXT DEFAULT 'bronze',
        total_visits   INTEGER DEFAULT 0,
        total_spent    DECIMAL(10,2) DEFAULT 0,
        birthday       TEXT,
        anniversary    TEXT,
        notes          TEXT,
        is_active      SMALLINT DEFAULT 1,
        created_at     TIMESTAMPTZ DEFAULT NOW(),
        updated_at     TIMESTAMPTZ DEFAULT NOW()
      );

      -- Orders
      CREATE TABLE IF NOT EXISTS orders (
        id              SERIAL PRIMARY KEY,
        order_number    TEXT UNIQUE NOT NULL,
        table_id        INTEGER REFERENCES tables(id),
        customer_id     INTEGER REFERENCES customers(id),
        order_type      TEXT DEFAULT 'dine_in',
        status          TEXT DEFAULT 'pending',
        waiter_id       INTEGER REFERENCES users(id),
        subtotal        DECIMAL(10,2) DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        discount_type   TEXT,
        coupon_code     TEXT,
        cgst            DECIMAL(10,2) DEFAULT 0,
        sgst            DECIMAL(10,2) DEFAULT 0,
        igst            DECIMAL(10,2) DEFAULT 0,
        total           DECIMAL(10,2) DEFAULT 0,
        notes           TEXT,
        source          TEXT DEFAULT 'pos',
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      );

      -- Order Items
      CREATE TABLE IF NOT EXISTS order_items (
        id          SERIAL PRIMARY KEY,
        order_id    INTEGER NOT NULL REFERENCES orders(id),
        item_id     INTEGER REFERENCES menu_items(id),
        item_name   TEXT NOT NULL,
        quantity    INTEGER DEFAULT 1,
        unit_price  DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        notes       TEXT,
        status      TEXT DEFAULT 'pending',
        kot_printed SMALLINT DEFAULT 0,
        station     TEXT DEFAULT 'kitchen',
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      -- Order Item Modifiers
      CREATE TABLE IF NOT EXISTS order_item_modifiers (
        id             SERIAL PRIMARY KEY,
        order_item_id  INTEGER REFERENCES order_items(id),
        modifier_id    INTEGER,
        modifier_name  TEXT,
        price          DECIMAL(10,2) DEFAULT 0
      );

      -- KOT Tickets
      CREATE TABLE IF NOT EXISTS kot_tickets (
        id           SERIAL PRIMARY KEY,
        kot_number   TEXT UNIQUE NOT NULL,
        order_id     INTEGER NOT NULL REFERENCES orders(id),
        table_id     INTEGER,
        station      TEXT DEFAULT 'kitchen',
        status       TEXT DEFAULT 'pending',
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS kot_items (
        id             SERIAL PRIMARY KEY,
        kot_id         INTEGER NOT NULL REFERENCES kot_tickets(id),
        order_item_id  INTEGER NOT NULL REFERENCES order_items(id),
        item_name      TEXT NOT NULL,
        quantity       INTEGER DEFAULT 1,
        notes          TEXT,
        status         TEXT DEFAULT 'pending'
      );

      -- Payments
      CREATE TABLE IF NOT EXISTS payments (
        id             SERIAL PRIMARY KEY,
        order_id       INTEGER NOT NULL REFERENCES orders(id),
        payment_method TEXT NOT NULL,
        amount         DECIMAL(10,2) NOT NULL,
        reference      TEXT,
        status         TEXT DEFAULT 'completed',
        created_at     TIMESTAMPTZ DEFAULT NOW()
      );

      -- Loyalty Transactions
      CREATE TABLE IF NOT EXISTS loyalty_transactions (
        id          SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        order_id    INTEGER REFERENCES orders(id),
        type        TEXT NOT NULL,
        points      INTEGER NOT NULL,
        description TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      -- Coupons
      CREATE TABLE IF NOT EXISTS coupons (
        id              SERIAL PRIMARY KEY,
        code            TEXT UNIQUE NOT NULL,
        description     TEXT,
        discount_type   TEXT DEFAULT 'percentage',
        discount_value  DECIMAL(10,2) NOT NULL,
        min_order_amount DECIMAL(10,2) DEFAULT 0,
        max_discount    DECIMAL(10,2),
        usage_limit     INTEGER,
        used_count      INTEGER DEFAULT 0,
        valid_from      TEXT,
        valid_until     TEXT,
        is_active       SMALLINT DEFAULT 1,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );

      -- Inventory
      CREATE TABLE IF NOT EXISTS inventory_items (
        id            SERIAL PRIMARY KEY,
        name          TEXT NOT NULL,
        unit          TEXT NOT NULL,
        current_stock DECIMAL(10,3) DEFAULT 0,
        min_stock     DECIMAL(10,3) DEFAULT 0,
        cost_per_unit DECIMAL(10,2) DEFAULT 0,
        category      TEXT DEFAULT 'General',
        supplier      TEXT,
        is_active     SMALLINT DEFAULT 1,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );

      -- Recipes
      CREATE TABLE IF NOT EXISTS recipes (
        id           SERIAL PRIMARY KEY,
        menu_item_id INTEGER NOT NULL REFERENCES menu_items(id)
      );

      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id                SERIAL PRIMARY KEY,
        recipe_id         INTEGER NOT NULL REFERENCES recipes(id),
        inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id),
        quantity          DECIMAL(10,3) NOT NULL,
        unit              TEXT
      );

      -- Purchase Orders
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id           SERIAL PRIMARY KEY,
        po_number    TEXT UNIQUE NOT NULL,
        supplier     TEXT NOT NULL,
        status       TEXT DEFAULT 'pending',
        total_amount DECIMAL(10,2) DEFAULT 0,
        notes        TEXT,
        ordered_at   TIMESTAMPTZ DEFAULT NOW(),
        received_at  TIMESTAMPTZ,
        created_by   INTEGER REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS purchase_items (
        id                SERIAL PRIMARY KEY,
        po_id             INTEGER NOT NULL REFERENCES purchase_orders(id),
        inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id),
        quantity          DECIMAL(10,3) NOT NULL,
        unit_price        DECIMAL(10,2) NOT NULL,
        total_price       DECIMAL(10,2) NOT NULL
      );

      -- Inventory Transactions
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id                SERIAL PRIMARY KEY,
        inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id),
        type              TEXT NOT NULL,
        quantity          DECIMAL(10,3) NOT NULL,
        reference         TEXT,
        notes             TEXT,
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        created_by        INTEGER
      );

      -- Feedback
      CREATE TABLE IF NOT EXISTS feedback (
        id              SERIAL PRIMARY KEY,
        order_id        INTEGER REFERENCES orders(id),
        customer_id     INTEGER REFERENCES customers(id),
        rating          INTEGER,
        food_rating     INTEGER,
        service_rating  INTEGER,
        ambiance_rating INTEGER,
        comment         TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );

      -- Expenses
      CREATE TABLE IF NOT EXISTS expenses (
        id             SERIAL PRIMARY KEY,
        category       TEXT NOT NULL,
        description    TEXT,
        amount         DECIMAL(10,2) NOT NULL,
        expense_date   DATE DEFAULT CURRENT_DATE,
        payment_method TEXT DEFAULT 'cash',
        created_by     INTEGER,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      );

      -- Password Reset Tokens
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token      TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used       BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log(`✅ PostgreSQL schema initialized for tenant: ${tenantSlug} (schema: ${schemaName})`);
  } catch (e) {
    console.error('Schema error:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { initSchema };
