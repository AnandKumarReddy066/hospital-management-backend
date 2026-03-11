/**
 * controllers/paymentController.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Handles Razorpay order generation, payment verification, and saving to MongoDB.
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const { AppError } = require('../middleware/errorHandler');

// Initialize Razorpay (Requires environment variables RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)
// Using dummy keys as generic defaults if env vars are missing
const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummyKey12345',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummySecretabc123',
});

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE ORDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/payments/create-order
 * @desc    Initialize a Razorpay order before frontend checkout
 * @access  Protected (Patient)
 */
exports.createOrder = async (req, res, next) => {
  try {
    const { amount, receiptNote, appointmentId, billId } = req.body;

    if (!amount) {
      return next(new AppError('Payment amount is required', 400));
    }

    // Razorpay expects amount in subunits (paise for INR)
    const options = {
      amount: Math.round(amount * 100), 
      currency: 'INR',
      receipt: receiptNote || `rcpt_${Date.now()}`,
    };

    const order = await instance.orders.create(options);

    if (!order) {
      return next(new AppError('Failed to create Razorpay order', 500));
    }

    // Create an initial "pending" payment record in DB
    const payment = await Payment.create({
      patientId: req.user._id,
      appointmentId,
      billId,
      amount,
      netAmount: amount,
      method: 'online',
      gateway: 'razorpay',
      gatewayOrderId: order.id,
      status: 'pending',
    });

    res.json({
      success: true,
      data: {
        order,
        paymentId: payment._id,
        key: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummyKey12345'
      }
    });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFY PAYMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/payments/verify
 * @desc    Verify the Razorpay signature after checkout succeeds
 * @access  Protected (Patient)
 */
exports.verifyPayment = async (req, res, next) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      dbPaymentId 
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return next(new AppError('Missing Razorpay payment coordinates', 400));
    }

    // 1. Verify Signature
    const secret = process.env.RAZORPAY_KEY_SECRET || 'dummySecretabc123';
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      // Mark as failed in DB
      await Payment.findByIdAndUpdate(dbPaymentId, {
        status: 'failed',
        failureReason: 'Signature mismatch'
      });
      return next(new AppError('Payment verification failed', 400));
    }

    // 2. Mark as Success in DB
    const payment = await Payment.findByIdAndUpdate(
      dbPaymentId,
      {
        status: 'success',
        gatewayPaymentId: razorpay_payment_id,
        gatewaySignature: razorpay_signature,
      },
      { new: true } // Return updated doc
    );

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        receiptNo: payment.receiptNo,
        amount: payment.amount,
        paidAt: payment.paidAt
      }
    });
  } catch (err) {
    next(err);
  }
};
