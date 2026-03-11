/**
 * routes/patientRoutes.js
 */

const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.post('/profile', authorize('patient'), patientController.createProfile);
router.get('/profile', patientController.getProfile);
router.patch('/profile', authorize('patient'), patientController.updateProfile);
router.get('/', authorize('admin', 'doctor', 'nurse'), patientController.getAllPatients);
router.get('/:userId', authorize('admin', 'doctor', 'nurse'), patientController.getProfile);

module.exports = router;
