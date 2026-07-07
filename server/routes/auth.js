const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getTenantDb, dbQuery } = require('../database/db');
const { sendPasswordResetEmail } = require('../utils/email');



const rateLimit = require('express-rate-limit');

// Strict rate limiter for authentication endpoints (prevent brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login/reset attempts per 15 minutes
  message: { error: 'Too many authentication attempts from this IP, please try again after 15 minutes.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Login — tenant identified via tenantMiddleware (req.tenantSlug)
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const slug = req.tenantSlug;

    const db = await getTenantDb(slug);
    const users = await dbQuery(db, 'SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);

    if (!users.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, tenant_slug: slug },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    delete user.password;
    res.json({ token, user, tenant: req.tenant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', require('../middleware/auth').auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const users = await dbQuery(db, 'SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!users.length) return res.status(404).json({ error: 'User not found' });
    res.json(users[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users
router.get('/users', require('../middleware/auth').auth, async (req, res) => {
  try {
    const db = await getTenantDb(req.tenantSlug);
    const users = await dbQuery(db, 'SELECT id, name, email, role, phone, is_active, created_at FROM users ORDER BY name');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create user
router.post('/users', require('../middleware/auth').auth, async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    const hash = await bcrypt.hash(password, 10);
    const id = await db.insert(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name, email, hash, role, phone]
    );
    res.json({ id, name, email, role, phone });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user
router.put('/users/:id', require('../middleware/auth').auth, async (req, res) => {
  try {
    const { name, email, role, phone, is_active } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    await db.run(
      'UPDATE users SET name=?, email=?, role=?, phone=?, is_active=?, updated_at=NOW() WHERE id=?',
      [name, email, role, phone, is_active, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password
router.post('/change-password', require('../middleware/auth').auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const db = await getTenantDb(req.tenantSlug);
    const users = await dbQuery(db, 'SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!users.length) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(current_password, users[0].password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await db.run('UPDATE users SET password=? WHERE id=?', [hash, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Forgot Password ─────────────────────────────────────────────────────────
// Step 1: User submits their email → we generate a token and send a reset link
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const db = await getTenantDb(req.tenantSlug);

    // Always respond with 200 to avoid leaking which emails exist
    const users = await dbQuery(db, 'SELECT id, name, email FROM users WHERE email = ? AND is_active = 1', [email]);
    if (!users.length) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const user = users[0];

    // Invalidate any existing unused tokens for this user
    await db.run('UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ? AND used = FALSE', [user.id]);

    // Generate secure random token (64 hex chars)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.run(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt.toISOString()]
    );

    // Build the reset URL — includes tenant slug so the frontend knows which tenant
    const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${token}&tenant=${req.tenantSlug}`;

    // Get restaurant name for email
    const settingRows = await dbQuery(db, "SELECT value FROM settings WHERE key = 'restaurant_name'");
    const restaurantName = settingRows[0]?.value || req.tenant?.name || 'BillByte POS';

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      tenantName: restaurantName,
    });

    console.log(`📧 Password reset email sent to ${user.email} for tenant: ${req.tenantSlug}`);
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    // Don't expose internal errors to prevent info leakage
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  }
});

// ─── Reset Password ───────────────────────────────────────────────────────────
// Step 2: User clicks the link, submits token + new password
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, new_password, tenant } = req.body;
    if (!token || !new_password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Use tenant from body since this route is hit without X-Tenant-Slug sometimes
    const slugToUse = tenant || req.tenantSlug;
    const db = await getTenantDb(slugToUse);

    // Find valid, unused, non-expired token
    const tokens = await dbQuery(db, `
      SELECT prt.*, u.email, u.name FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.id
      WHERE prt.token = ? AND prt.used = FALSE AND prt.expires_at > NOW()
    `, [token]);

    if (!tokens.length) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    const resetToken = tokens[0];

    // Hash new password and update user
    const hash = await bcrypt.hash(new_password, 10);
    await db.run('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hash, resetToken.user_id]);

    // Mark token as used
    await db.run('UPDATE password_reset_tokens SET used = TRUE WHERE id = ?', [resetToken.id]);

    console.log(`✅ Password reset successful for user: ${resetToken.email} (tenant: ${slugToUse})`);
    res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

// ─── Validate Reset Token ─────────────────────────────────────────────────────
// Called by frontend to check if a token is valid before showing the reset form
router.get('/reset-password/validate', async (req, res) => {
  try {
    const { token, tenant } = req.query;
    const slugToUse = tenant || req.tenantSlug;
    const db = await getTenantDb(slugToUse);

    const tokens = await dbQuery(db, `
      SELECT prt.expires_at, u.email FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.id
      WHERE prt.token = ? AND prt.used = FALSE AND prt.expires_at > NOW()
    `, [token]);

    if (!tokens.length) {
      return res.status(400).json({ valid: false, error: 'Invalid or expired reset link.' });
    }

    // Return masked email (e.g., a***@gmail.com)
    const email = tokens[0].email;
    const masked = email.replace(/(.{1}).+(@.+)/, '$1***$2');
    res.json({ valid: true, email: masked, expires_at: tokens[0].expires_at });
  } catch (err) {
    res.status(500).json({ valid: false, error: 'Server error' });
  }
});

module.exports = router;
