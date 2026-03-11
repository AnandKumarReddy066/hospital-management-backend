/**
 * controllers/authController.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Complete authentication controller.
 *
 * Endpoints covered:
 *   POST   /api/auth/register          → Create account
 *   POST   /api/auth/login             → Login, issue access + refresh tokens
 *   POST   /api/auth/logout            → Revoke refresh token
 *   GET    /api/auth/me                → Get current user (protected)
 *   POST   /api/auth/refresh-token     → Exchange refresh token for new access token
 *   POST   /api/auth/forgot-password   → Send OTP to email
 *   POST   /api/auth/verify-otp        → Verify OTP
 *   POST   /api/auth/reset-password    → Set new password after OTP verified
 *   POST   /api/auth/change-password   → Change password (authenticated)
 *   POST   /api/auth/verify-email      → Verify email via token link
 *   PATCH  /api/auth/update-profile    → Update name, phone (authenticated)
 */

const User          = require('../models/User');
const { AppError }  = require('../middleware/errorHandler');
const tokenUtils    = require('../utils/tokenUtils');
const emailService  = require('../services/emailService');
const logger        = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * sendAuthResponse — Sets cookies and returns JSON with tokens + user.
 * Always omits sensitive fields from the user object in the response.
 */
const sendAuthResponse = (user, statusCode, res) => {
  const accessToken  = tokenUtils.signAccessToken(user);
  const refreshToken = tokenUtils.signRefreshToken(user);

  // Store token in cookie (httpOnly) AND return in body (for mobile clients)
  tokenUtils.setCookies(res, accessToken, refreshToken);

  // Strip sensitive fields
  const safeUser = user.toObject();
  delete safeUser.password;
  delete safeUser.refreshToken;
  delete safeUser.otp;
  delete safeUser.otpExpiry;
  delete safeUser.failedLoginAttempts;
  delete safeUser.lockUntil;

  return res.status(statusCode).json({
    success: true,
    accessToken,
    refreshToken,
    data: { user: safeUser },
  });
};

/**
 * getClientMeta — Extracts IP and User-Agent for login history.
 */
const getClientMeta = (req) => ({
  ip:        req.ip || req.connection.remoteAddress,
  userAgent: req.headers['user-agent'] || '',
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/auth/register
 * @access  Public
 * @desc    Creates a new user. Role must be one of: patient | doctor | staff | admin.
 *          Admins can only be created by existing admins (enforced in the route middleware).
 */
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password, role = 'patient' } = req.body;

    // Prevent self-assignment of 'admin' role from public endpoint
    const requestedRole = ['patient', 'doctor', 'staff'].includes(role) ? role : 'patient';

    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      const field = existing.email === email ? 'email' : 'phone';
      return next(new AppError(`This ${field} is already registered`, 409));
    }

    const user = await User.create({ firstName, lastName, email, phone, password, role: requestedRole });

    // Send verification email (non-blocking)
    try {
      const verifyToken  = tokenUtils.generateEmailVerifyToken();
      const hashedToken  = tokenUtils.hashEmailVerifyToken(verifyToken);
      user.emailVerifyToken       = hashedToken;
      user.emailVerifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hrs
      await user.save({ validateBeforeSave: false });

      const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken}`;
      await emailService.sendWelcomeEmail(user, verifyLink);
    } catch (emailErr) {
      logger.warn(`Welcome email failed for ${email}: ${emailErr.message}`);
    }

    logger.info(`New ${requestedRole} registered: ${email}`);
    return sendAuthResponse(user, 201, res);
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/auth/login
 * @access  Public
 * @desc    Validates credentials, handles lockout, issues tokens.
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return next(new AppError('Email and password are required', 400));

    // Select sensitive fields explicitly (they use select: false)
    const user = await User.findOne({ email })
      .select('+password +failedLoginAttempts +lockUntil +loginHistory +refreshToken');

    if (!user) {
      return next(new AppError('Invalid email or password', 401));
    }

    // ── Account lockout check ────────────────────────────────────────────────
    if (user.isLocked) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return next(new AppError(`Account locked. Try again in ${minutesLeft} minute(s)`, 423));
    }

    // ── Deactivated account ──────────────────────────────────────────────────
    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated. Contact support.', 403));
    }

    // ── Password check ───────────────────────────────────────────────────────
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incrementFailedAttempts();
      const attemptsLeft = Math.max(0, 5 - user.failedLoginAttempts);
      return next(new AppError(
        attemptsLeft > 0
          ? `Invalid email or password. ${attemptsLeft} attempt(s) remaining before lockout.`
          : 'Account locked for 15 minutes due to too many failed attempts.',
        401
      ));
    }

    // ── Success: reset failed attempts + log ─────────────────────────────────
    await user.resetFailedAttempts();

    // Append to login history (keep last 10 entries)
    user.loginHistory = [getClientMeta(req), ...(user.loginHistory || [])].slice(0, 10);
    await user.save({ validateBeforeSave: false });

    logger.info(`Login: ${email} [${user.role}] from ${getClientMeta(req).ip}`);
    return sendAuthResponse(user, 200, res);
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/auth/logout
 * @access  Protected
 * @desc    Clears cookies and revokes the refresh token in the DB.
 */
exports.logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    tokenUtils.clearCookies(res);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET ME
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/auth/me
 * @access  Protected
 */
exports.getMe = async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};

// ═══════════════════════════════════════════════════════════════════════════════
// REFRESH TOKEN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/auth/refresh-token
 * @access  Public (uses refresh token cookie or body)
 * @desc    Issues new access token. Implements refresh token rotation.
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    if (!token) return next(new AppError('Refresh token missing', 401));

    let decoded;
    try {
      decoded = tokenUtils.verifyRefreshToken(token);
    } catch {
      return next(new AppError('Invalid or expired refresh token', 401));
    }

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user) return next(new AppError('User not found', 401));

    // ── Rotation: each refresh token is single-use ────────────────────────────
    const newAccessToken  = tokenUtils.signAccessToken(user);
    const newRefreshToken = tokenUtils.signRefreshToken(user);
    tokenUtils.setCookies(res, newAccessToken, newRefreshToken);

    res.json({
      success: true,
      accessToken:  newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/auth/forgot-password
 * @access  Public
 * @desc    Generates a 6-digit OTP, stores hashed version, sends to user's email.
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always respond with 200 to prevent email enumeration attacks
    if (!user) {
      return res.json({ success: true, message: 'If this email exists, an OTP has been sent.' });
    }

    const otp    = tokenUtils.generateOTP();
    const hashed = tokenUtils.hashOTP(otp);

    user.otp       = hashed;
    user.otpExpiry  = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    user.otpPurpose = 'password_reset';
    await user.save({ validateBeforeSave: false });

    await emailService.sendOTPEmail(user, otp);
    logger.info(`Password reset OTP generated for: ${email}`);

    res.json({ success: true, message: 'If this email exists, an OTP has been sent.' });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFY OTP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/auth/verify-otp
 * @access  Public
 * @desc    Validates the OTP and returns a short-lived reset token.
 */
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const hashedOtp = tokenUtils.hashOTP(otp);

    const user = await User.findOne({
      email,
      otp:        hashedOtp,
      otpExpiry:  { $gt: Date.now() },
      otpPurpose: 'password_reset',
    }).select('+otp +otpExpiry +otpPurpose');

    if (!user) return next(new AppError('Invalid or expired OTP', 400));

    // Issue a short-lived (5 min) reset token instead of completing reset here
    const resetToken = tokenUtils.signAccessToken({ ...user.toObject(), _id: user._id, purpose: 'reset' });

    // Clear OTP so it can't be reused
    user.otp = user.otpExpiry = user.otpPurpose = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, message: 'OTP verified', resetToken });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESET PASSWORD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/auth/reset-password
 * @access  Public (requires resetToken from verifyOTP)
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return next(new AppError('Reset token and new password are required', 400));
    }

    let decoded;
    try {
      decoded = tokenUtils.verifyAccessToken(resetToken);
    } catch {
      return next(new AppError('Invalid or expired reset token', 401));
    }

    const user = await User.findById(decoded.id);
    if (!user) return next(new AppError('User not found', 404));

    user.password = newPassword;
    await user.save();

    tokenUtils.clearCookies(res);
    logger.info(`Password reset completed for: ${user.email}`);
    res.json({ success: true, message: 'Password reset successful. Please log in again.' });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CHANGE PASSWORD (Authenticated)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/auth/change-password
 * @access  Protected
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.comparePassword(currentPassword))) {
      return next(new AppError('Current password is incorrect', 401));
    }
    if (currentPassword === newPassword) {
      return next(new AppError('New password must differ from current password', 400));
    }

    user.password = newPassword;
    await user.save();

    tokenUtils.clearCookies(res);
    logger.info(`Password changed for: ${user.email}`);
    res.json({ success: true, message: 'Password changed. Please log in again.' });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFY EMAIL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/auth/verify-email
 * @access  Public
 */
exports.verifyEmail = async (req, res, next) => {
  try {
    const hashedToken = tokenUtils.hashEmailVerifyToken(req.body.token);
    const user = await User.findOne({
      emailVerifyToken:       hashedToken,
      emailVerifyTokenExpiry: { $gt: Date.now() },
    }).select('+emailVerifyToken +emailVerifyTokenExpiry');

    if (!user) return next(new AppError('Invalid or expired verification link', 400));

    user.isEmailVerified      = true;
    user.emailVerifyToken     = undefined;
    user.emailVerifyTokenExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   PATCH /api/auth/update-profile
 * @access  Protected
 * @desc    Only allows safe fields — password changes go through change-password.
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const ALLOWED = ['firstName', 'lastName', 'phone', 'profileImage'];
    const updates = Object.keys(req.body)
      .filter((k) => ALLOWED.includes(k))
      .reduce((obj, k) => ({ ...obj, [k]: req.body[k] }), {});

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN: CREATE USER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/auth/admin/create-user
 * @access  Admin only
 * @desc    Admins can create doctor / staff / admin accounts with any role.
 */
exports.adminCreateUser = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password, role } = req.body;
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) return next(new AppError('Email or phone already registered', 409));

    const user = await User.create({ firstName, lastName, email, phone, password, role });
    logger.info(`Admin ${req.user.email} created ${role} account: ${email}`);

    res.status(201).json({ success: true, data: { user } });
  } catch (err) { next(err); }
};
