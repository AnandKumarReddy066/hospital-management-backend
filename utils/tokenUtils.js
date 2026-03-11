/**
 * utils/tokenUtils.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Centralised JWT signing and verification helpers.
 * Both access tokens (short-lived) and refresh tokens (long-lived) are managed here.
 */

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

// ── Access token ──────────────────────────────────────────────────────────────

/**
 * signAccessToken — Issues a short-lived JWT access token.
 * Payload includes user id, role, and email for fast RBAC checks.
 */
exports.signAccessToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

/**
 * verifyAccessToken — Verifies and decodes an access token.
 * Throws if invalid or expired.
 */
exports.verifyAccessToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET);

// ── Refresh token ─────────────────────────────────────────────────────────────

/**
 * signRefreshToken — Issues a long-lived opaque refresh token.
 * Stored as a JWT so we can embed the user ID without a DB lookup,
 * but is also stored (hashed) in the User document for revocation.
 */
exports.signRefreshToken = (user) =>
  jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

/**
 * verifyRefreshToken — Verifies a refresh token.
 */
exports.verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET);

// ── OTP ───────────────────────────────────────────────────────────────────────

/**
 * generateOTP — Creates a 6-digit numeric OTP.
 */
exports.generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/**
 * hashOTP — Hashes the OTP before storing in DB (SHA-256, no salt needed for short-lived codes).
 */
exports.hashOTP = (otp) =>
  crypto.createHash('sha256').update(otp).digest('hex');

// ── Email verification token ──────────────────────────────────────────────────

/**
 * generateEmailVerifyToken — Random 32-byte hex token for email verification links.
 */
exports.generateEmailVerifyToken = () => crypto.randomBytes(32).toString('hex');

/**
 * hashEmailVerifyToken — SHA-256 hash of the email verification token.
 */
exports.hashEmailVerifyToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

// ── Cookie helper ─────────────────────────────────────────────────────────────

/**
 * setCookies — Attaches access and refresh tokens as HTTP-only cookies.
 * Called by auth controller after login / register / refresh.
 */
exports.setCookies = (res, accessToken, refreshToken) => {
  const isProd = process.env.NODE_ENV === 'production';

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'Strict' : 'Lax',
    maxAge:   15 * 60 * 1000,          // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'Strict' : 'Lax',
    maxAge:   30 * 24 * 60 * 60 * 1000, // 30 days
    path:     '/api/auth/refresh-token',  // Only sent to the refresh endpoint
  });
};

/**
 * clearCookies — Clears both token cookies on logout.
 */
exports.clearCookies = (res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/auth/refresh-token' });
};
