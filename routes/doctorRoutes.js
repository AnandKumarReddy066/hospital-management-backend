/**
 * routes/doctorRoutes.js
 */

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Doctor = require('../models/Doctor');
const { AppError } = require('../middleware/errorHandler');

// List all doctors with optional specialization filter
router.get('/', async (req, res, next) => {
  try {
    const { specialization, page = 1, limit = 20 } = req.query;
    const filter = specialization ? { specialization: new RegExp(specialization, 'i') } : {};
    const doctors = await Doctor.find(filter)
      .populate('user', 'firstName lastName email profileImage')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    if (doctors.length === 0) {
      // Provide mock doctors if DB is empty
      return res.json({
        success: true,
        data: {
          doctors: [
            { _id: 'mock_doc_1', name: { first: 'Sarah', last: 'Jenning' }, department: 'Cardiology', specialization: 'Heart Surgeon' },
            { _id: 'mock_doc_2', name: { first: 'Michael', last: 'Chen' }, department: 'Neurology', specialization: 'Brain Specialist' },
            { _id: 'mock_doc_3', name: { first: 'Emily', last: 'Sato' }, department: 'Pediatrics', specialization: 'Child Care' },
          ]
        }
      });
    }

    res.json({ success: true, data: { doctors } });
  } catch(err) { next(err); }
});

// Get single doctor
router.get('/:id', async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id)
      .populate('user', 'firstName lastName email phone profileImage');
    if (!doctor) return next(new AppError('Doctor not found', 404));
    res.json({ success: true, data: { doctor } });
  } catch(err) { next(err); }
});

// Update doctor availability (doctor only)
router.patch('/:id/availability', protect, authorize('doctor', 'admin'), async (req, res, next) => {
  try {
    const doctor = await Doctor.findByIdAndUpdate(
      req.params.id,
      { availability: req.body.availability },
      { new: true }
    );
    res.json({ success: true, data: { doctor } });
  } catch(err) { next(err); }
});

module.exports = router;
