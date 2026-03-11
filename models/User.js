/**
 * models/User.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Core identity model. All four roles (patient, doctor, staff, admin) share
 * this schema. Role-specific profile data lives in Patient / Doctor /
 * HospitalStaff models and is linked via the `profileId` field.
 *
 * Security features:
 *  • bcrypt password hashing (pre-save hook)
 *  • Refresh token stored as hashed value
 *  • OTP for email/phone verification and password reset
 *  • Failed login tracking with auto-lockout after 5 attempts
 *  • Password change timestamp to invalidate old JWTs
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ── Audit log sub-schema (login history) ──────────────────────────────────────
const loginHistorySchema = new mongoose.Schema({
  ip:        { type: String },
  userAgent: { type: String },
  at:        { type: Date, default: Date.now },
  success:   { type: Boolean, default: true },
}, { _id: false });

// ── Main schema ───────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:     { type: String, required: true, unique: true },

    // ── Credentials ───────────────────────────────────────────────────────────
    password:  { type: String, required: true, minlength: 8, select: false },
    passwordChangedAt: { type: Date, select: false },

    // ── Role ──────────────────────────────────────────────────────────────────
    role: {
      type: String,
      enum: ['patient', 'doctor', 'staff', 'admin'],
      default: 'patient',
      required: true,
    },

    // ── Profile reference (points to Patient / Doctor / HospitalStaff doc) ────
    profileId: { type: mongoose.Schema.Types.ObjectId, refPath: 'profileModel' },
    profileModel: {
      type: String,
      enum: ['Patient', 'Doctor', 'HospitalStaff'],
    },

    // ── Profile image ─────────────────────────────────────────────────────────
    profileImage: { type: String, default: '' },

    // ── Verification ─────────────────────────────────────────────────────────
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    emailVerifyToken:       { type: String, select: false },
    emailVerifyTokenExpiry: { type: Date,   select: false },

    // ── OTP (password reset / 2FA) ────────────────────────────────────────────
    otp:          { type: String,  select: false },
    otpExpiry:    { type: Date,    select: false },
    otpPurpose:   { type: String,  select: false, enum: ['password_reset', 'email_verify', 'phone_verify', '2fa'] },

    // ── Refresh token ──────────────────────────────────────────────────────────
    refreshToken:       { type: String, select: false },

    // ── Security / lockout ────────────────────────────────────────────────────
    failedLoginAttempts: { type: Number, default: 0,    select: false },
    lockUntil:           { type: Date,   default: null,  select: false },

    // ── Status ────────────────────────────────────────────────────────────────
    isActive:   { type: Boolean, default: true },
    lastLogin:  { type: Date },
    loginHistory: { type: [loginHistorySchema], default: [], select: false },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Hash password before save (only if modified) ──────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password         = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = new Date(Date.now() - 1000); // 1 sec before now to avoid race with token
  next();
});

// ═══════════════════════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * comparePassword — Compares plain-text candidate against stored hash.
 */
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

/**
 * wasPasswordChangedAfter — Checks if password was changed after a given JWT iat.
 * Used in the protect middleware to invalidate old tokens after password changes.
 * @param {number} jwtIat - JWT issued-at timestamp (seconds)
 */
userSchema.methods.wasPasswordChangedAfter = function (jwtIat) {
  if (this.passwordChangedAt) {
    const changedAt = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return changedAt > jwtIat;
  }
  return false;
};

/**
 * incrementFailedAttempts — Increments the failed login counter.
 * Locks the account for 15 minutes after 5 consecutive failures.
 */
userSchema.methods.incrementFailedAttempts = async function () {
  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= 5) {
    this.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min
  }
  await this.save({ validateBeforeSave: false });
};

/**
 * resetFailedAttempts — Clears lockout state on successful login.
 */
userSchema.methods.resetFailedAttempts = async function () {
  this.failedLoginAttempts = 0;
  this.lockUntil           = null;
  this.lastLogin           = new Date();
  await this.save({ validateBeforeSave: false });
};

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1, isActive: 1 });

module.exports = mongoose.model('User', userSchema);
