/**
 * tenant.js — Tenant Identification Middleware
 * Extracts the restaurant slug from the incoming request hostname.
 *
 * Production:  caferoy.billbyte.com  → slug = "caferoy"
 * Development: localhost             → slug from X-Tenant-Slug header or "demo"
 */
const { getPlatformDb, queryPlatform } = require('../database/platform');

function extractSlug(req) {
  const host = (req.headers.host || '').split(':')[0]; // strip port

  const parts = host.split('.');
  // Ignore free hosting domains, treat them as localhost fallback
  if (host.includes('onrender.com') || host.includes('vercel.app')) {
    // skip subdomain extraction and fall through to headers
  }
  else if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'admin') {
    return parts[0];
  }

  // Development / direct IP: fall back to X-Tenant-Slug header
  if (req.headers['x-tenant-slug']) {
    return req.headers['x-tenant-slug'];
  }

  // Default tenant for bare localhost access
  return process.env.DEFAULT_TENANT_SLUG || 'demo';
}

async function tenantMiddleware(req, res, next) {
  try {
    let slug = extractSlug(req);
    // Sanitize: trim whitespace and lowercase
    slug = (slug || '').trim().toLowerCase();
    
    console.log(`[TenantMW] method=${req.method} path=${req.path} host=${req.headers.host} x-tenant-slug=${req.headers['x-tenant-slug']} → resolved slug="${slug}"`);
    
    if (!slug) {
      slug = process.env.DEFAULT_TENANT_SLUG || 'demo';
    }
    
    await getPlatformDb(); // ensure platform db is initialized
    const tenants = await queryPlatform('SELECT * FROM tenants WHERE slug = $1', [slug]);

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
    console.error('Tenant middleware error:', err);
    res.status(500).json({ error: 'Failed to identify restaurant' });
  }
}

module.exports = { tenantMiddleware, extractSlug };
