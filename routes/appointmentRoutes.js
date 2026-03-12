/**
 * routes/appointmentRoutes.js
 */

const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.post('/', authorize('patient', 'staff', 'receptionist'), appointmentController.bookAppointment);
router.get('/', authorize('admin', 'doctor', 'nurse', 'receptionist', 'staff'), appointmentController.getAllAppointments);
router.get('/me', appointmentController.getMyAppointments);
router.patch('/:id/status', authorize('admin', 'doctor', 'receptionist'), appointmentController.updateAppointmentStatus);

module.exports = router;
