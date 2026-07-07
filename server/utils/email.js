/**
 * email.js — BillByte Email Service (powered by Resend)
 * Handles all transactional emails: welcome, password reset, etc.
 */
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const APP_URL = process.env.APP_URL || 'http://localhost:5000';
const BRAND_COLOR = '#FF6B35';

/** Base HTML wrapper used by all emails */
function baseTemplate(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:${BRAND_COLOR};padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
              🍽️ BillByte POS
            </h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
              Smart Restaurant Management
            </p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:24px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;color:#999;font-size:12px;">
              © ${new Date().getFullYear()} BillByte POS · This is an automated message, please do not reply.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Send welcome email to a new restaurant admin.
 * @param {object} opts - { to, restaurantName, slug, adminEmail, adminPassword }
 */
async function sendWelcomeEmail({ to, restaurantName, slug, adminEmail, loginUrl }) {
  const html = baseTemplate('Welcome to BillByte POS', `
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:24px;">Welcome to BillByte! 🎉</h2>
    <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
      Your restaurant <strong>${restaurantName}</strong> has been successfully set up on the BillByte POS platform.
      Here are your login details:
    </p>
    
    <div style="background:#f8f8f8;border-radius:8px;padding:24px;margin-bottom:24px;border-left:4px solid ${BRAND_COLOR};">
      <p style="margin:0 0 12px;color:#333;font-size:14px;"><strong>🌐 Your Restaurant URL:</strong></p>
      <a href="${loginUrl}" style="color:${BRAND_COLOR};font-size:15px;word-break:break-all;">${loginUrl}</a>
      
      <hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0;"/>
      
      <p style="margin:0 0 4px;color:#333;font-size:14px;"><strong>📧 Email:</strong> ${adminEmail}</p>
      <p style="margin:0;color:#333;font-size:14px;">
        <strong>🔑 Password:</strong> The one you chose during setup
      </p>
    </div>
    
    <a href="${loginUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;margin-bottom:24px;">
      Open Your POS Dashboard →
    </a>
    
    <p style="margin:0;color:#888;font-size:13px;line-height:1.6;">
      If you have any questions, contact BillByte support.<br/>
      We recommend changing your password after your first login.
    </p>
  `);

  return resend.emails.send({
    from: `BillByte POS <${FROM}>`,
    to,
    subject: `✅ Your restaurant "${restaurantName}" is ready on BillByte!`,
    html,
  });
}

/**
 * Send password reset email with a secure token link.
 * @param {object} opts - { to, name, resetUrl, tenantName }
 */
async function sendPasswordResetEmail({ to, name, resetUrl, tenantName }) {
  const html = baseTemplate('Reset Your Password', `
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:24px;">Password Reset Request 🔐</h2>
    <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
      Hi <strong>${name || 'there'}</strong>, we received a request to reset your password for 
      <strong>${tenantName || 'BillByte POS'}</strong>. 
      Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
    </p>
    
    <a href="${resetUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;margin-bottom:24px;">
      Reset My Password →
    </a>
    
    <p style="margin:0 0 8px;color:#888;font-size:13px;">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin:0 0 24px;word-break:break-all;">
      <a href="${resetUrl}" style="color:${BRAND_COLOR};font-size:12px;">${resetUrl}</a>
    </p>
    
    <div style="background:#fff8f6;border:1px solid #ffe0d4;border-radius:8px;padding:16px;">
      <p style="margin:0;color:#c04a00;font-size:13px;">
        ⚠️ If you did not request a password reset, please ignore this email. 
        Your password will remain unchanged.
      </p>
    </div>
  `);

  return resend.emails.send({
    from: `BillByte POS <${FROM}>`,
    to,
    subject: `🔐 Reset your BillByte password`,
    html,
  });
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail };
