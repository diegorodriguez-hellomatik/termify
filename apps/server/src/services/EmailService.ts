import nodemailer from 'nodemailer';

// Create reusable transporter object using SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const APP_NAME = 'Termify';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const EMAIL_FROM = process.env.EMAIL_FROM || `${APP_NAME} <noreply@termify.app>`;

/**
 * Escape HTML to prevent XSS in email templates
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Email template styles
 */
const emailStyles = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f5f5f5;
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    padding: 40px 20px;
  }
  .card {
    background-color: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    padding: 40px;
  }
  .logo {
    text-align: center;
    margin-bottom: 30px;
  }
  .logo-icon {
    width: 60px;
    height: 60px;
    background-color: #2563eb;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 24px;
    font-weight: bold;
  }
  h1 {
    color: #1a1a1a;
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 16px 0;
    text-align: center;
  }
  p {
    color: #666;
    font-size: 16px;
    margin: 0 0 20px 0;
  }
  .button {
    display: inline-block;
    padding: 14px 32px;
    background-color: #2563eb;
    color: #ffffff !important;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 16px;
    text-align: center;
  }
  .button:hover {
    background-color: #1d4ed8;
  }
  .button-container {
    text-align: center;
    margin: 30px 0;
  }
  .footer {
    text-align: center;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #eee;
  }
  .footer p {
    color: #999;
    font-size: 14px;
    margin: 0;
  }
  .note {
    background-color: #f8f9fa;
    border-radius: 8px;
    padding: 16px;
    margin: 20px 0;
  }
  .note p {
    margin: 0;
    font-size: 14px;
    color: #666;
  }
  .link {
    color: #2563eb;
    word-break: break-all;
  }
`;

/**
 * Generate base email template
 */
function emailTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${APP_NAME}</title>
      <style>${emailStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo">
            <div class="logo-icon">&gt;_</div>
          </div>
          ${content}
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send verification email
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
  name?: string | null
): Promise<void> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
  const safeName = name ? escapeHtml(name) : null;
  const greeting = safeName ? `Hi ${safeName}` : 'Hi there';

  const content = `
    <h1>Verify Your Email</h1>
    <p>${greeting},</p>
    <p>Thanks for signing up for ${APP_NAME}! Please verify your email address to complete your registration.</p>
    <div class="button-container">
      <a href="${verifyUrl}" class="button">Verify Email</a>
    </div>
    <div class="note">
      <p>This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
    </div>
    <p style="font-size: 14px; color: #999;">
      Or copy and paste this URL into your browser:<br>
      <a href="${verifyUrl}" class="link">${verifyUrl}</a>
    </p>
  `;

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: `Verify your ${APP_NAME} account`,
    html: emailTemplate(content),
  });

  console.log(`[EmailService] Verification email sent to ${email}`);
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
  name?: string | null
): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const safeName = name ? escapeHtml(name) : null;
  const greeting = safeName ? `Hi ${safeName}` : 'Hi there';

  const content = `
    <h1>Reset Your Password</h1>
    <p>${greeting},</p>
    <p>We received a request to reset your password. Click the button below to choose a new password.</p>
    <div class="button-container">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </div>
    <div class="note">
      <p>This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
    <p style="font-size: 14px; color: #999;">
      Or copy and paste this URL into your browser:<br>
      <a href="${resetUrl}" class="link">${resetUrl}</a>
    </p>
  `;

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: `Reset your ${APP_NAME} password`,
    html: emailTemplate(content),
  });

  console.log(`[EmailService] Password reset email sent to ${email}`);
}

/**
 * Send password changed confirmation email
 */
export async function sendPasswordChangedEmail(
  email: string,
  name?: string | null
): Promise<void> {
  const safeName = name ? escapeHtml(name) : null;
  const greeting = safeName ? `Hi ${safeName}` : 'Hi there';

  const content = `
    <h1>Password Changed</h1>
    <p>${greeting},</p>
    <p>Your password has been successfully changed. You can now log in with your new password.</p>
    <div class="note">
      <p><strong>Didn't make this change?</strong> If you didn't change your password, please contact our support team immediately or reset your password.</p>
    </div>
    <div class="button-container">
      <a href="${APP_URL}/login" class="button">Go to Login</a>
    </div>
  `;

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: `Your ${APP_NAME} password was changed`,
    html: emailTemplate(content),
  });

  console.log(`[EmailService] Password changed email sent to ${email}`);
}

/**
 * Send email verified confirmation
 */
export async function sendEmailVerifiedEmail(
  email: string,
  name?: string | null
): Promise<void> {
  const safeName = name ? escapeHtml(name) : null;
  const greeting = safeName ? `Hi ${safeName}` : 'Hi there';

  const content = `
    <h1>Email Verified!</h1>
    <p>${greeting},</p>
    <p>Your email address has been successfully verified. You now have full access to all ${APP_NAME} features.</p>
    <div class="button-container">
      <a href="${APP_URL}/terminals" class="button">Get Started</a>
    </div>
    <p style="text-align: center; color: #666;">Welcome to ${APP_NAME}!</p>
  `;

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: `Welcome to ${APP_NAME}!`,
    html: emailTemplate(content),
  });

  console.log(`[EmailService] Email verified confirmation sent to ${email}`);
}

/**
 * Send email change confirmation email (to NEW email)
 */
export async function sendEmailChangeConfirmation(
  newEmail: string,
  token: string,
  name?: string | null
): Promise<void> {
  const confirmUrl = `${APP_URL}/confirm-email-change?token=${token}`;
  const safeName = name ? escapeHtml(name) : null;
  const greeting = safeName ? `Hi ${safeName}` : 'Hi there';

  const content = `
    <h1>Confirm Email Change</h1>
    <p>${greeting},</p>
    <p>You requested to change your ${APP_NAME} account email to this address. Click the button below to confirm this change.</p>
    <div class="button-container">
      <a href="${confirmUrl}" class="button">Confirm Email Change</a>
    </div>
    <div class="note">
      <p>This link will expire in 1 hour. If you didn't request this change, you can safely ignore this email.</p>
    </div>
    <p style="font-size: 14px; color: #999;">
      Or copy and paste this URL into your browser:<br>
      <a href="${confirmUrl}" class="link">${confirmUrl}</a>
    </p>
  `;

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: newEmail,
    subject: `Confirm your new ${APP_NAME} email`,
    html: emailTemplate(content),
  });

  console.log(`[EmailService] Email change confirmation sent to ${newEmail}`);
}

/**
 * Send email changed notification (to OLD email)
 */
export async function sendEmailChangedNotification(
  oldEmail: string,
  newEmail: string,
  name?: string | null
): Promise<void> {
  const safeName = name ? escapeHtml(name) : null;
  const safeNewEmail = escapeHtml(newEmail);
  const greeting = safeName ? `Hi ${safeName}` : 'Hi there';

  const content = `
    <h1>Email Address Changed</h1>
    <p>${greeting},</p>
    <p>Your ${APP_NAME} account email has been changed to <strong>${safeNewEmail}</strong>.</p>
    <div class="note">
      <p><strong>Didn't make this change?</strong> If you didn't change your email address, please contact our support team immediately.</p>
    </div>
  `;

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: oldEmail,
    subject: `Your ${APP_NAME} email was changed`,
    html: emailTemplate(content),
  });

  console.log(`[EmailService] Email changed notification sent to ${oldEmail}`);
}

/**
 * Test email configuration
 */
export async function testEmailConfiguration(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log('[EmailService] SMTP configuration verified successfully');
    return true;
  } catch (error) {
    console.error('[EmailService] SMTP configuration error:', error);
    return false;
  }
}

export const emailService = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendEmailVerifiedEmail,
  sendEmailChangeConfirmation,
  sendEmailChangedNotification,
  testEmailConfiguration,
};
