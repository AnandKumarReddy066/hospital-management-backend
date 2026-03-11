/**
 * controllers/patientController.js
 * Patient profile CRUD and medical history management.
 */

const Patient = require('../models/Patient');
const User    = require('../models/User');
const { AppError } = require('../middleware/errorHandler');

// ── Create patient profile ────────────────────────────────────────────────────
exports.createProfile = async (req, res, next) => {
  try {
    const existing = await Patient.findOne({ user: req.user._id });
    if (existing) return next(new AppError('Patient profile already exists', 409));

    const patient = await Patient.create({ user: req.user._id, ...req.body });
    res.status(201).json({ success: true, data: { patient } });
  } catch (err) { next(err); }
};

// ── Get patient profile ───────────────────────────────────────────────────────
exports.getProfile = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ user: req.params.userId || req.user._id })
                                 .populate('user', 'firstName lastName email phone profileImage');
    if (!patient) return next(new AppError('Patient profile not found', 404));
    res.json({ success: true, data: { patient } });
  } catch (err) { next(err); }
};

// ── Update patient profile ────────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const patient = await Patient.findOneAndUpdate(
      { user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!patient) return next(new AppError('Patient profile not found', 404));
    res.json({ success: true, data: { patient } });
  } catch (err) { next(err); }
};

// ── Get all patients (admin/doctor only) ──────────────────────────────────────
exports.getAllPatients = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;

    let query = Patient.find().populate('user', 'firstName lastName email phone');
    if (search) {
      const users = await User.find({
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName:  { $regex: search, $options: 'i' } },
          { email:     { $regex: search, $options: 'i' } },
        ],
      }).select('_id');
      query = query.where('user').in(users.map(u => u._id));
    }

    const [patients, total] = await Promise.all([
      query.skip(skip).limit(Number(limit)),
      Patient.countDocuments(),
    ]);
    res.json({ success: true, count: total, data: { patients } });
  } catch (err) { next(err); }
};
