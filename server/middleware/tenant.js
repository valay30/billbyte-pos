/**
 * tenant.js — Tenant Identification Middleware
 *
 * Resolution order (most specific to least):
 * 1. Subdomain on a custom domain: caferoy.billbyte.com → "caferoy"
 * 2. X-Tenant-Slug request header (set by the React frontend from localStorage)
 * 3. JWT token in Authorization header (most reliable fallback — always contains tenant)
 * 4. DEFAULT_TENANT_SLUG env var (bare domain / first-time access)
 */
const { getPlatformDb, queryPlatform } = require('../database/platform');
const jwt = require('jsonwebtoken');

function extractSlug(req) {
  const host = (req.headers.host || '').split(':')[0]; // strip port

  // 1. Custom production subdomain: caferoy.billbyte.com → "caferoy"
  //    Skip free hosting domains (*.onrender.com, *.vercel.app) — they are shared
  const isSharedHost = host.includes('onrender.com') || host.includes('vercel.app') || host === 'localhost' || host === '127.0.0.1';
  if (!isSharedHost) {
    const parts = host.split('.');
    if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'admin') {
      return parts[0];
    }
  }

  // 2. X-Tenant-Slug header (set by React frontend interceptor)
  const headerSlug = (req.headers['x-tenant-slug'] || '').trim().toLowerCase();
  if (headerSlug && headerSlug !== 'undefined' && headerSlug !== 'null') {
    return headerSlug;
  }

  // 3. JWT token — most reliable fallback for authenticated requests
  //    The token is signed with tenant_slug during login so it's always correct
  try {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.tenant_slug) {
        return decoded.tenant_slug;
      }
    }
  } catch {
    // JWT invalid or expired — continue to fallback
  }

  // 4. Default tenant
  return process.env.DEFAULT_TENANT_SLUG || 'demo';
}

async function tenantMiddleware(req, res, next) {
  try {
    const slug = extractSlug(req);

    console.log(`[Tenant] ${req.method} ${req.path} → slug="${slug}" (host=${req.headers.host}, x-tenant-slug=${req.headers['x-tenant-slug']})`);

    await getPlatformDb();
    const tenants = await queryPlatform('SELECT * FROM tenants WHERE slug = ?', [slug]);

    if (!tenants.length) {
      return res.status(404).json({ error: `Restaurant "${slug}" not found. Please check your URL.` });
    }

    const tenant = tenants[0];
    if (tenant.status !== 'active') {
      return res.status(403).json({ error: 'This restaurant account is suspended. Please contact BillByte support.' });
    }

    req.tenantSlug = slug;
    req.tenant = tenant;
    next();
  } catch (err) {
    console.error('[Tenant] Middleware error:', err);
    res.status(500).json({ error: 'Failed to identify restaurant' });
  }
}

module.exports = { tenantMiddleware, extractSlug };
