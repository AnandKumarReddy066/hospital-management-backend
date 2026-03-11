/**
 * routes/adminRoutes.js
 * Admin-only dashboard data and management routes.
 */

const express = require('express');
const router = express.Router();
const { protect, authorize, ROLES } = require('../middleware/auth');
const User = require('../models/User');
const adminController = require('../controllers/adminController');

router.use(protect, authorize(ROLES.ADMIN));

// ── Advanced Analytics Dashboard ──────────────────────────────────────────────
router.get('/dashboard', adminController.getDashboardStats);

// ── Basic User Management ─────────────────────────────────────────────────────
router.get('/users', async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const filter = role ? { role } : {};
    const users = await User.find(filter).select('-password').skip((page-1)*limit).limit(Number(limit));
    res.json({ success: true, data: { users } });
  } catch(err) { next(err); }
});

router.patch('/users/:id/toggle-status', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, data: { isActive: user.isActive } });
  } catch(err) { next(err); }
});

module.exports = router;
