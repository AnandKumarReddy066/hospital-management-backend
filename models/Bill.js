/**
 * models/Bill.js
 * Billing record tied to an appointment or hospitalization.
 */

const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({
  description: String,
  quantity:    { type: Number, default: 1 },
  unitPrice:   Number,
  total:       Number,
});

const billSchema = new mongoose.Schema(
  {
    patient:     { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    billNumber:  { type: String, unique: true },
    items:       [billItemSchema],
    subtotal:    Number,
    tax:         { type: Number, default: 0 },
    discount:    { type: Number, default: 0 },
    totalAmount: Number,
    paidAmount:  { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['draft', 'pending', 'partial', 'paid', 'refunded', 'cancelled'],
      default: 'pending',
    },
    paymentMethod: { type: String, enum: ['cash','card','insurance','upi','online'] },
    paymentReference: String,   // Stripe / Razorpay payment intent ID
    insuranceClaim:   String,
    pdfUrl:           String,
    dueDate:          Date,
  },
  { timestamps: true }
);

// Auto-generate bill number before save
billSchema.pre('save', function (next) {
  if (!this.billNumber) {
    this.billNumber = `BILL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
  next();
});

module.exports = mongoose.model('Bill', billSchema);
