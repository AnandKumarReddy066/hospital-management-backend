/**
 * models/Payment.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Records every financial transaction — appointment fees, lab charges,
 * or package billing — with gateway-specific references and refund support.
 */

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    // ── References ────────────────────────────────────────────────────────────
    patientId:     {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    billId:        {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bill',
    },

    // ── Amount ────────────────────────────────────────────────────────────────
    amount:        { type: Number, required: true, min: 0 },
    currency:      { type: String, default: 'INR', uppercase: true },
    tax:           { type: Number, default: 0 },
    discount:      { type: Number, default: 0 },
    netAmount:     { type: Number, required: true },   // amount − discount + tax

    // ── Payment method ────────────────────────────────────────────────────────
    method: {
      type: String,
      enum: ['cash', 'card', 'upi', 'net-banking', 'wallet', 'insurance', 'online'],
      required: true,
    },

    // ── Gateway info ──────────────────────────────────────────────────────────
    gateway: {
      type: String,
      enum: ['stripe', 'razorpay', 'cash', 'manual'],
      default: 'manual',
    },
    gatewayPaymentId: { type: String },   // Stripe PI id / Razorpay payment id
    gatewayOrderId:   { type: String },   // Razorpay order id
    gatewaySignature: { type: String },   // Razorpay verification signature

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['initiated', 'pending', 'success', 'failed', 'refunded', 'partial-refund'],
      default: 'initiated',
    },
    failureReason: { type: String },
    paidAt:        { type: Date },

    // ── Refund ────────────────────────────────────────────────────────────────
    refund: {
      amount:      { type: Number, default: 0 },
      reason:      { type: String },
      refundId:    { type: String },     // Gateway refund ID
      processedAt: { type: Date },
    },

    // ── Insurance ─────────────────────────────────────────────────────────────
    insurance: {
      provider:     { type: String },
      claimNo:      { type: String },
      claimAmount:  { type: Number },
      approvedAt:   { type: Date },
    },

    // ── Receipt ───────────────────────────────────────────────────────────────
    receiptNo:  { type: String, unique: true, sparse: true },
    receiptUrl: { type: String },    // Cloudinary PDF URL

    // ── Notes ─────────────────────────────────────────────────────────────────
    notes:      { type: String },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-generate receipt number before saving a successful payment
paymentSchema.pre('save', function (next) {
  if (this.status === 'success' && !this.receiptNo) {
    this.receiptNo = `RCP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    this.paidAt    = this.paidAt || new Date();
  }
  next();
});

paymentSchema.index({ patientId: 1, status: 1 });
paymentSchema.index({ gatewayPaymentId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
