/**
 * controllers/billingController.js
 * Bill generation, retrieval, and payment recording.
 */

const Bill = require('../models/Bill');
const { AppError } = require('../middleware/errorHandler');
const paymentService = require('../services/paymentService');

// ── Create bill ───────────────────────────────────────────────────────────────
exports.createBill = async (req, res, next) => {
  try {
    const { patientId, appointmentId, items, tax, discount, dueDate } = req.body;

    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const totalAmount = subtotal + (tax || 0) - (discount || 0);

    const bill = await Bill.create({
      patient: patientId,
      appointment: appointmentId,
      items,
      subtotal,
      tax,
      discount,
      totalAmount,
      dueDate,
    });
    res.status(201).json({ success: true, data: { bill } });
  } catch (err) { next(err); }
};

// ── Get bill by ID ────────────────────────────────────────────────────────────
exports.getBill = async (req, res, next) => {
  try {
    const bill = await Bill.findById(req.params.id).populate('patient appointment');
    if (!bill) return next(new AppError('Bill not found', 404));
    res.json({ success: true, data: { bill } });
  } catch (err) { next(err); }
};

// ── Initiate payment ──────────────────────────────────────────────────────────
exports.initiatePayment = async (req, res, next) => {
  try {
    const { billId, gateway } = req.body;  // gateway: 'stripe' | 'razorpay'
    const bill = await Bill.findById(billId);
    if (!bill) return next(new AppError('Bill not found', 404));

    const paymentData = await paymentService.createPaymentIntent(bill.totalAmount, gateway, billId);
    res.json({ success: true, data: paymentData });
  } catch (err) { next(err); }
};

// ── Webhook — mark bill as paid ───────────────────────────────────────────────
exports.handlePaymentSuccess = async (billId, paymentRef, method) => {
  await Bill.findByIdAndUpdate(billId, {
    status: 'paid',
    paidAmount: undefined,
    paymentReference: paymentRef,
    paymentMethod: method,
  });
};
