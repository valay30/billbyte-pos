require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { initSchema } = require('./database/schema');
const { getPlatformDb } = require('./database/platform');
const { setupSocket } = require('./socket');
const { tenantMiddleware } = require('./middleware/tenant');

const helmet = require('helmet');

const app = express();
const server = http.createServer(app);

// Allow all origins in dev, restrict in production via CORS_ORIGIN env
const corsOriginEnv = process.env.CORS_ORIGIN;
// If CORS_ORIGIN is explicitly set to a comma-separated list, use that. Otherwise, allow all for dev.
const allowedOrigins = corsOriginEnv 
  ? corsOriginEnv.split(',').map(s => s.trim())
  : true;

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], credentials: true }
});

app.set('io', io);

// Security Middleware
app.use(helmet({
  // Disable CSP for now so we don't break external images (like Cloudinary) or inline Vite scripts
  contentSecurityPolicy: false, 
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Basic Middleware
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Super Admin Routes (no tenant middleware) ──────────────────────────────
app.use('/api/superadmin', require('./routes/superadmin'));

// ─── Tenant Info Endpoint (public — for login page to show restaurant name) ─
app.get('/api/tenant-info', tenantMiddleware, (req, res) => {
  res.json({
    slug: req.tenant.slug,
    name: req.tenant.name,
    status: req.tenant.status,
  });
});

// ─── All Restaurant API Routes (tenant-scoped) ──────────────────────────────
app.use('/api/auth',      tenantMiddleware, require('./routes/auth'));
app.use('/api/tables',    tenantMiddleware, require('./routes/tables'));
app.use('/api/menu',      tenantMiddleware, require('./routes/menu'));
app.use('/api/orders',    tenantMiddleware, require('./routes/orders'));
app.use('/api/inventory', tenantMiddleware, require('./routes/inventory'));
app.use('/api/crm',       tenantMiddleware, require('./routes/crm'));
app.use('/api/reports',   tenantMiddleware, require('./routes/reports'));
app.use('/api/customer',  tenantMiddleware, require('./routes/customer'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'BillByte POS Platform', version: '2.0.0' });
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../client/dist')));

// Catch-all route to serve the React app (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

setupSocket(io);

const PORT = process.env.PORT || 5000;

// Initialize platform DB + default tenant schema, then start server
(async () => {
  try {
    await getPlatformDb();

    // Register default tenant if not already present
    const { queryPlatform } = require('./database/platform');
    const { pool } = require('./database/db');
    const defaultSlug = process.env.DEFAULT_TENANT_SLUG || 'demo';
    const existing = await queryPlatform('SELECT id FROM tenants WHERE slug = ?', [defaultSlug]);
    if (!existing.length) {
      await pool.query(
        'INSERT INTO tenants (slug, name, admin_email) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING',
        [defaultSlug, 'Demo Restaurant', 'admin@demo.com']
      );
      console.log(`✅ Default tenant "${defaultSlug}" ensured`);
    }

    // Initialize schema for default demo tenant on first run
    await initSchema(defaultSlug);

    server.listen(PORT, () => {
      console.log(`\n🚀 BillByte POS Platform running on port ${PORT}`);
      console.log(`📡 API: http://localhost:${PORT}/api`);
      console.log(`🌐 Super Admin: http://localhost:${PORT}/api/superadmin/tenants?key=${process.env.SUPERADMIN_KEY}`);
      console.log(`\nDefault tenant: "${defaultSlug}" — login at http://localhost:${PORT}\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
