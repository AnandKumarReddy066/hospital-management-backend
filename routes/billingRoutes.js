/**
 * routes/billingRoutes.js
 */

const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.post('/', authorize('admin', 'receptionist'), billingController.createBill);
router.get('/:id', billingController.getBill);
router.post('/initiate-payment', billingController.initiatePayment);

module.exports = router;
