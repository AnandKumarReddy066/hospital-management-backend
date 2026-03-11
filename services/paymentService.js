/**
 * services/paymentService.js
 * Unified payment service wrapping Stripe and Razorpay.
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Razorpay = require('razorpay');
const logger = require('../utils/logger');
const { handlePaymentSuccess } = require('../controllers/billingController');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummyKey12345',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummySecretabc123',
});

// ── Create payment intent ─────────────────────────────────────────────────────
exports.createPaymentIntent = async (amount, gateway, billId) => {
  if (gateway === 'stripe') {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),    // paise / cents
      currency: 'inr',
      metadata: { billId },
    });
    return { clientSecret: paymentIntent.client_secret, gateway: 'stripe' };
  }

  if (gateway === 'razorpay') {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `bill_${billId}`,
    });
    return { orderId: order.id, gateway: 'razorpay' };
  }

  throw new Error(`Unknown payment gateway: ${gateway}`);
};

// ── Stripe webhook handler ────────────────────────────────────────────────────
exports.handleStripeWebhook = async (rawBody, signature) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error(`Stripe webhook signature verification failed: ${err.message}`);
    throw err;
  }

  if (event.type === 'payment_intent.succeeded') {
    const { billId } = event.data.object.metadata;
    await handlePaymentSuccess(billId, event.data.object.id, 'card');
    logger.info(`Payment succeeded for bill ${billId}`);
  }
};

// ── Razorpay webhook handler ──────────────────────────────────────────────────
exports.handleRazorpayWebhook = async (body, signature) => {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');

  if (expectedSignature !== signature) throw new Error('Invalid Razorpay signature');

  if (body.event === 'payment.captured') {
    const billId = body.payload.payment.entity.receipt?.replace('bill_', '');
    await handlePaymentSuccess(billId, body.payload.payment.entity.id, 'upi');
  }
};

// ── Get payment status ────────────────────────────────────────────────────────
exports.getPaymentStatus = async (paymentId) => {
  if (paymentId.startsWith('pi_')) {
    const intent = await stripe.paymentIntents.retrieve(paymentId);
    return { status: intent.status, gateway: 'stripe' };
  }
  const payment = await razorpay.payments.fetch(paymentId);
  return { status: payment.status, gateway: 'razorpay' };
};
