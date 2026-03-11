/**
 * models/QueueStatus.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Tracks real-time queue state for a specific doctor on a specific date.
 * One document per (doctorId + date) pair. Updated as patients check in,
 * are called, and are served. Data is broadcast via WebSocket to waiting patients.
 */

const mongoose = require('mongoose');

// ── A single entry in the queue ───────────────────────────────────────────────
const queueEntrySchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true,
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
  },
  position:      { type: Number, required: true },   // 1-indexed queue number
  status: {
    type: String,
    enum: ['waiting', 'called', 'in-consultation', 'completed', 'skipped', 'cancelled'],
    default: 'waiting',
  },
  scheduledTime: { type: String },    // "10:00" — original booked slot
  checkedInAt:   { type: Date },      // when patient physically arrived
  calledAt:      { type: Date },      // when doctor/reception called them
  completedAt:   { type: Date },      // when consultation ended
  waitMinutes:   { type: Number },    // actual wait time (filled on calledAt)
  priority: {
    type: String,
    enum: ['normal', 'urgent', 'emergency'],
    default: 'normal',
  },
  notes: { type: String },
}, { _id: true });

// ── Main schema (one document per doctor per day) ─────────────────────────────

const queueStatusSchema = new mongoose.Schema(
  {
    // ── References ────────────────────────────────────────────────────────────
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },

    // ── Current serving ───────────────────────────────────────────────────────
    currentPosition:    { type: Number, default: 0 },     // Position being served right now
    currentPatientId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    consultationStarted:{ type: Date },

    // ── Queue entries ─────────────────────────────────────────────────────────
    entries: { type: [queueEntrySchema], default: [] },

    // ── Statistics ────────────────────────────────────────────────────────────
    totalBooked:    { type: Number, default: 0 },
    totalCheckedIn: { type: Number, default: 0 },
    totalCompleted: { type: Number, default: 0 },
    totalSkipped:   { type: Number, default: 0 },
    avgConsultationMinutes: { type: Number, default: 0 },  // rolling average

    // ── Session state ─────────────────────────────────────────────────────────
    sessionStatus: {
      type: String,
      enum: ['scheduled', 'active', 'paused', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    sessionStartedAt:  { type: Date },
    sessionEndedAt:    { type: Date },
    pauseReason:       { type: String },

    // ── Estimated wait ────────────────────────────────────────────────────────
    estimatedWaitPerPatient: { type: Number, default: 15 },  // minutes, adjusts dynamically

    // ── Last update meta ──────────────────────────────────────────────────────
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// ── Compound unique index — one queue per doctor per day ──────────────────────
queueStatusSchema.index({ doctorId: 1, date: 1 }, { unique: true });

// ── Instance method: get number of patients ahead ─────────────────────────────
queueStatusSchema.methods.getWaitCount = function (appointmentId) {
  const entry = this.entries.find(
    (e) => e.appointmentId.toString() === appointmentId.toString()
  );
  if (!entry) return null;
  return this.entries.filter(
    (e) => e.position < entry.position && ['waiting', 'called', 'in-consultation'].includes(e.status)
  ).length;
};

// ── Instance method: estimated wait for a position ───────────────────────────
queueStatusSchema.methods.estimateWait = function (position) {
  const ahead = Math.max(0, position - this.currentPosition - 1);
  return ahead * this.estimatedWaitPerPatient;
};

module.exports = mongoose.model('QueueStatus', queueStatusSchema);
