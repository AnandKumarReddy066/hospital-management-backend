/**
 * routes/paymentRoutes.js
 * ──────────────────────────────────────────────────────────────────────────────
 * API endpoints for Razorpay payment integration.
 */

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

router.use(protect);

/**
 * @route   POST /api/payments/create-order
 * @desc    Creates a Razorpay order and returns the ID
 * @access  Protected
 */
router.post('/create-order', paymentController.createOrder);

/**
 * @route   POST /api/payments/verify
 * @desc    Verifies Razorpay payment signature
 * @access  Protected
 */
router.post('/verify', paymentController.verifyPayment);

module.exports = router;
