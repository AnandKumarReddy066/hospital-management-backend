/**
 * routes/authRoutes.js
 * ──────────────────────────────────────────────────────────────────────────────
 * All authentication and identity endpoints.
 *
 * Public endpoints:
 *   POST  /api/auth/register
 *   POST  /api/auth/login
 *   POST  /api/auth/refresh-token
 *   POST  /api/auth/forgot-password
 *   POST  /api/auth/verify-otp
 *   POST  /api/auth/reset-password
 *   POST  /api/auth/verify-email
 *
 * Protected endpoints (require valid JWT):
 *   GET   /api/auth/me
 *   POST  /api/auth/logout
 *   POST  /api/auth/change-password
 *   PATCH /api/auth/update-profile
 *
 * Admin-only:
 *   POST  /api/auth/admin/create-user
 */

const express    = require('express');
const router     = express.Router();
const { body }   = require('express-validator');

const authController = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const { authLimiter }  = require('../middleware/rateLimiter');
const validate         = require('../middleware/validate');

// ── Validation rule sets ──────────────────────────────────────────────────────

const registerRules = [
  body('firstName').notEmpty().trim().withMessage('First name is required'),
  body('lastName').notEmpty().trim().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('phone')
    .isMobilePhone()
    .withMessage('Valid phone number required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('role')
    .optional()
    .isIn(['patient', 'doctor', 'staff'])
    .withMessage('Role must be patient, doctor, or staff'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const forgotPasswordRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
];

const verifyOTPRules = [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
];

const resetPasswordRules = [
  body('resetToken').notEmpty().withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Must contain uppercase letter')
    .matches(/[0-9]/).withMessage('Must contain a number'),
];

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Must contain uppercase letter')
    .matches(/[0-9]/).withMessage('Must contain a number'),
];

const adminCreateUserRules = [
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('phone').isMobilePhone(),
  body('password').isLength({ min: 8 }),
  body('role').isIn(['patient', 'doctor', 'staff', 'admin']).withMessage('Invalid role'),
];

// ════════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/auth/register
 * @desc    Register a new patient, doctor, or staff member
 * @access  Public
 * @example
 *   Body: { firstName, lastName, email, phone, password, role? }
 *   Response: { success, accessToken, refreshToken, data: { user } }
 */
router.post('/register',
  authLimiter,
  registerRules,
  validate,
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user, issue access + refresh tokens
 * @access  Public
 * @example
 *   Body: { email, password }
 *   Response: { success, accessToken, refreshToken, data: { user } }
 */
router.post('/login',
  authLimiter,
  loginRules,
  validate,
  authController.login
);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Issue new access token using refresh token (rotation)
 * @access  Public (token from cookie or body)
 * @example
 *   Body (optional): { refreshToken }   (auto-read from cookie if present)
 *   Response: { success, accessToken, refreshToken }
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Generate + email a 6-digit OTP for password reset
 * @access  Public
 * @example
 *   Body: { email }
 *   Response: { success, message }
 */
router.post('/forgot-password',
  authLimiter,
  forgotPasswordRules,
  validate,
  authController.forgotPassword
);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP; returns a short-lived resetToken
 * @access  Public
 * @example
 *   Body: { email, otp }
 *   Response: { success, resetToken }
 */
router.post('/verify-otp',
  authLimiter,
  verifyOTPRules,
  validate,
  authController.verifyOTP
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Set new password using resetToken from verify-otp
 * @access  Public
 * @example
 *   Body: { resetToken, newPassword }
 *   Response: { success, message }
 */
router.post('/reset-password',
  authLimiter,
  resetPasswordRules,
  validate,
  authController.resetPassword
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email using token from the verification link
 * @access  Public
 * @example
 *   Body: { token }    (from ?token= query or email link)
 *   Response: { success, message }
 */
router.post('/verify-email', authController.verifyEmail);

// ════════════════════════════════════════════════════════════════════════════════
// PROTECTED ROUTES (require valid JWT)
// ════════════════════════════════════════════════════════════════════════════════

router.use(protect);   // All routes below this line require authentication

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user's profile
 * @access  Protected — all roles
 * @example
 *   Headers: Authorization: Bearer <accessToken>
 *   Response: { success, data: { user } }
 */
router.get('/me', authController.getMe);

/**
 * @route   POST /api/auth/logout
 * @desc    Revoke refresh token and clear cookies
 * @access  Protected — all roles
 */
router.post('/logout', authController.logout);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password (must know current password)
 * @access  Protected — all roles
 * @example
 *   Body: { currentPassword, newPassword }
 */
router.post('/change-password',
  changePasswordRules,
  validate,
  authController.changePassword
);

/**
 * @route   PATCH /api/auth/update-profile
 * @desc    Update non-sensitive profile fields (name, phone, profileImage)
 * @access  Protected — all roles
 * @example
 *   Body: { firstName?, lastName?, phone?, profileImage? }
 */
router.patch('/update-profile', authController.updateProfile);

// ════════════════════════════════════════════════════════════════════════════════
// ADMIN-ONLY ROUTES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/auth/admin/create-user
 * @desc    Admin creates any user with any role (including other admins)
 * @access  Admin only
 * @example
 *   Body: { firstName, lastName, email, phone, password, role }
 *   Response: { success, data: { user } }
 */
router.post('/admin/create-user',
  authorize('admin'),
  adminCreateUserRules,
  validate,
  authController.adminCreateUser
);

module.exports = router;
