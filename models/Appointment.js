/**
 * models/Appointment.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Links a patient to a doctor for a specific date/time slot.
 * Tracks status lifecycle, queue position, and optional teleconsult link.
 */

const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    // ── References ────────────────────────────────────────────────────────────
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },

    // ── Scheduling ────────────────────────────────────────────────────────────
    date: {
      type: Date,
      required: true,
    },
    time: {
      start: { type: String, required: true },   // "10:00" (24-hr)
      end:   { type: String },                   // "10:15"
    },

    // ── Type ──────────────────────────────────────────────────────────────────
    type: {
      type: String,
      enum: ['in-person', 'teleconsult', 'home-visit'],
      default: 'in-person',
    },

    // ── Status lifecycle ──────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show'],
      default: 'pending',
    },
    cancelledBy:       { type: String, enum: ['patient', 'doctor', 'admin'] },
    cancellationReason:{ type: String },
    cancelledAt:       { type: Date },

    // ── Queue ─────────────────────────────────────────────────────────────────
    queuePosition: {
      type: Number,
      min: 1,
    },
    estimatedWaitMinutes: { type: Number },  // dynamically updated by queue service
    checkedInAt:          { type: Date },

    // ── Visit details ──────────────────────────────────────────────────────────
    reason:         { type: String, required: true, maxlength: 500 },
    symptoms:       { type: [String], default: [] },
    notes:          { type: String },
    followUpDate:   { type: Date },

    // ── Teleconsult ────────────────────────────────────────────────────────────
    meetingLink:    { type: String },  // Video call URL

    // ── Linked documents ───────────────────────────────────────────────────────
    prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' },
    paymentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },

    // ── Fees snapshot ──────────────────────────────────────────────────────────
    consultationFee:{ type: Number },  // Snapshotted at booking time

    // ── Reminder ──────────────────────────────────────────────────────────────
    reminderSent:   { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Compound indexes ──────────────────────────────────────────────────────────
// Prevent double-booking — same doctor, same date, same start time
appointmentSchema.index(
  { doctorId: 1, date: 1, 'time.start': 1 },
  { unique: true, partialFilterExpression: { status: { $nin: ['cancelled', 'no-show'] } } }
);
appointmentSchema.index({ patientId: 1, date: -1 });
appointmentSchema.index({ status: 1, date: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
