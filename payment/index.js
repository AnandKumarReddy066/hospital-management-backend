/**
 * payment/index.js
 * Re-exports the unified payment service.
 * This folder can be extended with additional gateways (PayPal, Paytm, etc.)
 */

module.exports = require('../services/paymentService');
