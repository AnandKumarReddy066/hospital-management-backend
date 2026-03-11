/**
 * controllers/appointmentController.js
 * CRUD + slot-checking logic for appointments.
 */

const Appointment = require('../models/Appointment');
const Doctor      = require('../models/Doctor');
const Patient     = require('../models/Patient');
const { AppError } = require('../middleware/errorHandler');
const queueService = require('../services/queueService');
const notificationService = require('../services/notificationService');

// ── Book appointment ──────────────────────────────────────────────────────────
exports.bookAppointment = async (req, res, next) => {
  try {
    const { doctorId, appointmentDate, slot, type, reason } = req.body;

    // Prevent double-booking
    const conflict = await Appointment.findOne({
      doctor: doctorId,
      appointmentDate: new Date(appointmentDate),
      'slot.startTime': slot.startTime,
      status: { $nin: ['cancelled', 'no-show'] },
    });
    if (conflict) return next(new AppError('This slot is already booked', 409));

    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return next(new AppError('Patient profile not found', 404));

    const appointment = await Appointment.create({
      patient: patient._id,
      doctor: doctorId,
      appointmentDate,
      slot,
      type,
      reason,
    });

    // Assign queue number
    appointment.queueNumber = await queueService.assignQueueNumber(doctorId, appointmentDate);
    await appointment.save();

    await notificationService.sendAppointmentConfirmation(appointment);

    res.status(201).json({ success: true, data: { appointment } });
  } catch (err) { next(err); }
};

// ── Get all appointments (admin / doctor view) ────────────────────────────────
exports.getAllAppointments = async (req, res, next) => {
  try {
    const { date, status, doctorId } = req.query;
    const filter = {};
    if (date)     filter.appointmentDate = new Date(date);
    if (status)   filter.status = status;
    if (doctorId) filter.doctor = doctorId;

    const appointments = await Appointment.find(filter)
      .populate('patient', 'user')
      .populate('doctor', 'user specialization')
      .sort({ appointmentDate: 1, 'slot.startTime': 1 });

    res.json({ success: true, count: appointments.length, data: { appointments } });
  } catch (err) { next(err); }
};

// ── Get my appointments (patient / doctor) ────────────────────────────────────
exports.getMyAppointments = async (req, res, next) => {
  try {
    const filter = req.user.role === 'doctor'
      ? { doctor: req.user._id }
      : { patient: req.user._id };

    const appointments = await Appointment.find(filter)
      .populate('doctor', 'user specialization consultationFee')
      .sort({ appointmentDate: -1 });

    res.json({ success: true, data: { appointments } });
  } catch (err) { next(err); }
};

// ── Update appointment status ─────────────────────────────────────────────────
exports.updateAppointmentStatus = async (req, res, next) => {
  try {
    const { status, cancellationReason } = req.body;
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status, ...(cancellationReason && { cancellationReason }) },
      { new: true, runValidators: true }
    );
    if (!appointment) return next(new AppError('Appointment not found', 404));

    await notificationService.sendStatusUpdate(appointment);
    res.json({ success: true, data: { appointment } });
  } catch (err) { next(err); }
};
