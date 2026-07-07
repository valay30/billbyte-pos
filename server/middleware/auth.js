const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Enforce tenant isolation: JWT tenant must match request tenant
    if (req.tenantSlug && decoded.tenant_slug && decoded.tenant_slug !== req.tenantSlug) {
      return res.status(403).json({ error: 'Token does not belong to this restaurant' });
    }

    // If tenant middleware ran, trust its slug; else fall back to JWT slug
    if (!req.tenantSlug && decoded.tenant_slug) {
      req.tenantSlug = decoded.tenant_slug;
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

module.exports = { auth, requireRole };
