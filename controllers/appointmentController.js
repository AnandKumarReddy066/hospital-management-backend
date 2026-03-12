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

// ── Mock Storage (File-based to survive nodemon restarts) ─────────────
const fs = require('fs');
const path = require('path');

const mockFilePath = path.join(__dirname, '../tmp/mockAppointments.json');

// Ensure tmp directory exists
if (!fs.existsSync(path.dirname(mockFilePath))) {
  fs.mkdirSync(path.dirname(mockFilePath), { recursive: true });
}

function getMockAppointments() {
  try {
    if (fs.existsSync(mockFilePath)) {
      const data = fs.readFileSync(mockFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading mock appointments:', e);
  }
  return [];
}

function saveMockAppointments(appts) {
  try {
    fs.writeFileSync(mockFilePath, JSON.stringify(appts, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving mock appointments:', e);
  }
}

const MOCK_DOCTORS = {
  mock_doc_1: { _id: 'mock_doc_1', name: { first: 'Sarah', last: 'Jenning' }, specialization: 'Heart Surgeon', consultationFee: 500 },
  mock_doc_2: { _id: 'mock_doc_2', name: { first: 'Michael', last: 'Chen' }, specialization: 'Brain Specialist', consultationFee: 800 },
  mock_doc_3: { _id: 'mock_doc_3', name: { first: 'Emily', last: 'Sato' }, specialization: 'Child Care', consultationFee: 400 },
};

// ── Book appointment ──────────────────────────────────────────────────────────
exports.bookAppointment = async (req, res, next) => {
  try {
    const { doctorId, date, time, type, reason } = req.body;

    // ── MOCK BYPASS ───────────────────────────────────────────────────────────
    if (doctorId && doctorId.startsWith('mock_')) {
      const mockDoc = MOCK_DOCTORS[doctorId] || MOCK_DOCTORS['mock_doc_1'];
      // Create a mock appointment object without saving to DB
      const mockAppointment = {
        _id: 'mock_appt_' + Date.now(),
        patientId: req.user._id, // stored as ID but we won't populate it
        patient: req.user._id,
        doctor: mockDoc,         // Mock populated doctor object
        doctorId: doctorId,
        date: date,
        time: time,
        type: type || 'in-person',
        reason: reason,
        status: 'confirmed',
        queuePosition: Math.floor(Math.random() * 10) + 1,
        estimatedWaitMinutes: 15,
        createdAt: new Date(),
        appointmentDate: new Date(date), // for sorting compatibility
      };
      
      const appts = getMockAppointments();
      appts.push(mockAppointment);
      saveMockAppointments(appts);
      
      return res.status(201).json({ success: true, data: { appointment: mockAppointment } });
    }

    // Prevent double-booking for real doctors
    const conflict = await Appointment.findOne({
      doctorId: doctorId,
      date: new Date(date),
      'time.start': time.start,
      status: { $nin: ['cancelled', 'no-show'] },
    });
    if (conflict) return next(new AppError('This slot is already booked', 409));

    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return next(new AppError('Patient profile not found. Please complete profile first.', 404));

    const appointment = await Appointment.create({
      patientId: patient._id,
      doctorId: doctorId,
      date,
      time,
      type,
      reason,
    });

    // Assign queue number
    appointment.queuePosition = await queueService.assignQueueNumber(doctorId, date);
    await appointment.save();

    await notificationService.sendAppointmentConfirmation(appointment);

    res.status(201).json({ success: true, data: { appointment } });
  } catch (err) { next(err); }
};

// ── Get all appointments (admin / staff / doctor view) ────────────────────────
exports.getAllAppointments = async (req, res, next) => {
  try {
    const { date, status, doctorId } = req.query;
    
    // Fetch from real DB
    const filter = {};
    if (date)     filter.appointmentDate = new Date(date);
    if (status)   filter.status = status;
    if (doctorId) filter.doctor = doctorId;

    let dbAppointments = [];
    try {
      dbAppointments = await Appointment.find(filter)
        .populate('patient', 'user firstName lastName')
        .populate('doctor', 'user specialization name consultationFee')
        .sort({ appointmentDate: 1, 'time.start': 1 }); // Fixed sort field
    } catch(e) { }

    // Fetch from mock JSON storage
    let mockAppointments = getMockAppointments();

    // Apply filters to mock data
    if (date) {
      mockAppointments = mockAppointments.filter(a => a.date === date);
    }
    if (status) {
      mockAppointments = mockAppointments.filter(a => a.status === status);
    }
    if (doctorId) {
      mockAppointments = mockAppointments.filter(a => a.doctorId === doctorId);
    }

    // Since mock bypass doesn't fully populate the patient object for the staff UI (just ID)
    // Add default mock patient names if missing so the table doesn't look empty
    const enrichedMockAppts = mockAppointments.map(a => ({
      ...a,
      patient: a.patient?.firstName ? a.patient : { firstName: 'Mock', lastName: 'Patient' }
    }));

    // Merge them
    const allAppointments = [...enrichedMockAppts, ...dbAppointments].sort((a,b) => 
      new Date(a.date || a.appointmentDate) - new Date(b.date || b.appointmentDate)
    );

    res.json({ success: true, count: allAppointments.length, data: { appointments: allAppointments } });
  } catch (err) { next(err); }
};

// ── Get my appointments (patient / doctor) ────────────────────────────────────
exports.getMyAppointments = async (req, res, next) => {
  try {
    const filter = req.user.role === 'doctor'
      ? { doctor: req.user._id }
      : { patient: req.user._id };

    // Fetch from real DB
    let dbAppointments = [];
    try {
      dbAppointments = await Appointment.find(filter)
        .populate('doctor', 'user specialization consultationFee name')
        .sort({ appointmentDate: -1 });
    } catch(e) {
      // Ignore DB errors if Patient profile doesn't exist yet but they have mock appointments
    }

    // Merge with in-memory mock appointments for this user
    const appts = getMockAppointments();
    let myMockAppts = [];
    
    if (req.user.role === 'doctor') {
      // If the doctor logs in with doctor@hsptl.com, show them all mock appointments to test the dashboard
      // since the mock patient bookings don't necessarily map to the real doctor's DB ID right now
      myMockAppts = appts.filter(a => a.doctorId === req.user._id.toString() || a.doctorId.startsWith('mock_'));
    } else {
      myMockAppts = appts.filter(a => String(a.patientId) === String(req.user._id));
    }

    const allAppointments = [...myMockAppts, ...dbAppointments].sort((a,b) => 
      new Date(b.date || b.appointmentDate) - new Date(a.date || a.appointmentDate)
    );

    res.json({ success: true, count: allAppointments.length, data: { appointments: allAppointments } });
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
