/**
 * middleware/auth.js
 * ──────────────────────────────────────────────────────────────────────────────
 * JWT authentication and role-based access control middleware.
 *
 * Exports:
 *   protect            — Verifies JWT and attaches req.user
 *   authorize          — Restricts to specific roles
 *   optionalProtect    — Attaches user if token present, but doesn't block if not
 *   requireVerified    — Blocks unverified email accounts
 */

const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const logger  = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════════
// PROTECT — Verifies JWT (from Authorization header OR httpOnly cookie)
// ═══════════════════════════════════════════════════════════════════════════════

exports.protect = async (req, res, next) => {
  try {
    // 1. Extract token — prefer Authorization header, fall back to cookie
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(new AppError('Authentication required. Please log in.', 401));
    }

    // 2. Verify token signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Session expired. Please log in again.', 401));
      }
      return next(new AppError('Invalid access token.', 401));
    }

    // 3. Check user still exists and is active
    const user = await User.findById(decoded.id).select('+passwordChangedAt');
    if (!user) {
      return next(new AppError('Account no longer exists.', 401));
    }
    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated. Contact support.', 403));
    }

    // 4. Check password hasn't changed since token was issued
    //    (e.g. after "change-password" all old tokens are invalidated)
    if (user.wasPasswordChangedAfter(decoded.iat)) {
      return next(new AppError('Password was recently changed. Please log in again.', 401));
    }

    // 5. Attach user to request
    req.user = user;
    next();

  } catch (err) {
    logger.error(`protect middleware error: ${err.message}`);
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHORIZE — Role-based access control
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * authorize(...roles) — Restricts route access to specific roles.
 *
 * Usage examples:
 *   router.get('/admin-only', protect, authorize('admin'), handler)
 *   router.get('/staff-or-admin', protect, authorize('staff', 'admin'), handler)
 *   router.get('/all-except-patient', protect, authorize('doctor', 'staff', 'admin'), handler)
 */
exports.authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required.', 401));
  }
  if (!roles.includes(req.user.role)) {
    return next(new AppError(
      `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}.`,
      403
    ));
  }
  next();
};

// ═══════════════════════════════════════════════════════════════════════════════
// OPTIONAL PROTECT — Attaches user if token present, passes through if not
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * optionalProtect — Used on routes that show different data for logged-in vs guest users.
 * Never blocks the request, just enriches req.user if possible.
 */
exports.optionalProtect = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id);
    if (user?.isActive) req.user = user;
    next();
  } catch {
    // Silently ignore — token invalid, just proceed as guest
    next();
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRE VERIFIED EMAIL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * requireVerified — Blocks access for users who haven't verified their email.
 * Must be used AFTER protect.
 */
exports.requireVerified = (req, res, next) => {
  if (!req.user?.isEmailVerified) {
    return next(new AppError(
      'Please verify your email address before accessing this feature.',
      403
    ));
  }
  next();
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROLE CONSTANTS (convenience export for routes)
// ═══════════════════════════════════════════════════════════════════════════════

exports.ROLES = {
  PATIENT:  'patient',
  DOCTOR:   'doctor',
  STAFF:    'staff',
  ADMIN:    'admin',
};

// Pre-built role group combiners for common patterns
exports.ROLE_GROUPS = {
  ALL_STAFF:        ['doctor', 'staff', 'admin'],
  CLINICAL_STAFF:   ['doctor', 'staff'],
  MANAGEMENT:       ['staff', 'admin'],
  ADMIN_ONLY:       ['admin'],
  DOCTOR_ADMIN:     ['doctor', 'admin'],
};
