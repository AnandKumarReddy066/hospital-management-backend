/**
 * models/Doctor.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Full doctor profile: personal info, qualifications, department,
 * experience, per-day availability slots, and aggregated ratings.
 */

const mongoose = require('mongoose');

// ── Embedded sub-schemas ──────────────────────────────────────────────────────

const availabilitySlotSchema = new mongoose.Schema({
  day:         { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], required: true },
  startTime:   { type: String, required: true },  // "09:00"
  endTime:     { type: String, required: true },  // "13:00"
  slotDuration:{ type: Number, default: 15 },     // minutes per appointment slot
  maxPatients: { type: Number, default: 20 },     // cap per session
  isActive:    { type: Boolean, default: true },
}, { _id: false });

const qualificationSchema = new mongoose.Schema({
  degree:      { type: String, required: true }, // "MBBS", "MD"
  institution: { type: String },
  year:        { type: Number },
}, { _id: false });

// ── Main schema ───────────────────────────────────────────────────────────────

const doctorSchema = new mongoose.Schema(
  {
    // ── Core identification ─────────────────────────────────────────────────
    name: {
      first:  { type: String, required: true, trim: true },
      last:   { type: String, required: true, trim: true },
    },
    email:   { type: String, required: true, unique: true, lowercase: true },
    phone:   { type: String, required: true },

    // ── Auth reference ───────────────────────────────────────────────────────
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // ── Professional details ─────────────────────────────────────────────────
    registrationNo:  { type: String, required: true, unique: true },
    department: {
      type: String,
      required: true,
      enum: [
        'Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Dermatology',
        'Oncology', 'Gynecology', 'Urology', 'Psychiatry', 'ENT',
        'Ophthalmology', 'General Medicine', 'Emergency', 'Radiology',
        'Anesthesiology', 'Dentistry', 'Physiotherapy', 'Other',
      ],
    },
    specialization:  { type: String, required: true },
    qualifications:  { type: [qualificationSchema], default: [] },
    experience:      { type: Number, required: true, min: 0 }, // years
    languages:       { type: [String], default: ['English'] },
    bio:             { type: String, maxlength: 1000 },
    profileImage:    { type: String, default: '' },

    // ── Consultation ──────────────────────────────────────────────────────────
    consultationFee:        { type: Number, required: true },
    onlineFee:              { type: Number },
    isAvailableForOnline:   { type: Boolean, default: false },

    // ── Availability ───────────────────────────────────────────────────────────
    availability: { type: [availabilitySlotSchema], default: [] },

    // ── Ratings (aggregated; updated via Review model) ────────────────────────
    ratings: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count:   { type: Number, default: 0 },
      total:   { type: Number, default: 0 },
    },

    // ── Hospital association ──────────────────────────────────────────────────
    hospital:  { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },

    // ── Status ────────────────────────────────────────────────────────────────
    isActive:  { type: Boolean, default: true },
    isOnLeave: { type: Boolean, default: false },
    leaveUntil:{ type: Date },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Virtuals ─────────────────────────────────────────────────────────────────
doctorSchema.virtual('fullName').get(function () {
  return `${this.name.first} ${this.name.last}`;
});

// ── Indexes ───────────────────────────────────────────────────────────────────
doctorSchema.index({ department: 1 });
doctorSchema.index({ specialization: 1 });
doctorSchema.index({ 'ratings.average': -1 });

module.exports = mongoose.model('Doctor', doctorSchema);
