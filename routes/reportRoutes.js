/**
 * routes/reportRoutes.js | routes/notificationRoutes.js | routes/adminRoutes.js
 * Stub route files — expand as needed.
 */

// ── reportRoutes ───────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const MedicalReport = require('../models/MedicalReport');

router.use(protect);

router.get('/my', async (req, res, next) => {
  try {
    const reports = await MedicalReport.find({ patient: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: { reports } });
  } catch(err) { next(err); }
});

router.post('/', authorize('doctor', 'admin'), async (req, res, next) => {
  try {
    const report = await MedicalReport.create(req.body);
    res.status(201).json({ success: true, data: { report } });
  } catch(err) { next(err); }
});

module.exports = router;
