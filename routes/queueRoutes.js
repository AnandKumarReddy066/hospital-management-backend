/**
 * routes/queueRoutes.js
 * ──────────────────────────────────────────────────────────────────────────────
 * API routes for real-time queue management.
 */

const express = require('express');
const router  = express.Router();
const queueController = require('../controllers/queueController');
const { protect, authorize, ROLES } = require('../middleware/auth');

router.use(protect);

/**
 * @route   GET /api/queue/status
 * @desc    Patient checks queue for a doctor on a given date
 * @access  Patient & up
 */
router.get('/status', queueController.getQueueStatus);

/**
 * @route   GET /api/queue/my-queue
 * @desc    Doctor retrieves their full day's queue list
 * @access  Doctor
 */
router.get('/my-queue', authorize(ROLES.DOCTOR), queueController.getMyQueue);

/**
 * @route   POST /api/queue/:id/call-next
 * @desc    Doctor triggers the next patient in queue
 * @access  Doctor
 */
router.post('/:id/call-next', authorize(ROLES.DOCTOR), queueController.callNextPatient);

module.exports = router;
