/**
 * models/HospitalStaff.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Non-doctor hospital staff: nurses, receptionists, lab technicians,
 * ward boys, pharmacists, admins, etc.
 */

const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  day:       { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] },
  startTime: { type: String },   // "07:00"
  endTime:   { type: String },   // "15:00"
}, { _id: false });

const hospitalStaffSchema = new mongoose.Schema(
  {
    // ── Auth reference ───────────────────────────────────────────────────────
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // ── Personal details ─────────────────────────────────────────────────────
    name: {
      first:  { type: String, required: true, trim: true },
      last:   { type: String, required: true, trim: true },
    },
    email:  { type: String, required: true, unique: true, lowercase: true },
    phone:  { type: String, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    dob:    { type: Date },
    profileImage: { type: String },

    // ── Role & department ─────────────────────────────────────────────────────
    role: {
      type: String,
      required: true,
      enum: [
        'nurse', 'receptionist', 'lab_technician', 'pharmacist',
        'ward_boy', 'housekeeping', 'security', 'admin',
        'accountant', 'it_support', 'other',
      ],
    },
    department: { type: String },    // "Cardiology Ward", "Billing", etc.
    employeeId: { type: String, unique: true, sparse: true },

    // ── Employment ────────────────────────────────────────────────────────────
    joiningDate:  { type: Date },
    employmentType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'intern'],
      default: 'full-time',
    },
    salary: { type: Number },    // monthly, stored securely (consider field-level encryption in prod)

    // ── Qualifications ────────────────────────────────────────────────────────
    qualifications: { type: [String], default: [] },  // ["B.Sc Nursing", "GNM"]
    licenseNumber:  { type: String },
    specialization: { type: String },

    // ── Shift schedule ────────────────────────────────────────────────────────
    shifts: { type: [shiftSchema], default: [] },

    // ── Supervisor ────────────────────────────────────────────────────────────
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalStaff' },

    // ── Status ────────────────────────────────────────────────────────────────
    isActive:  { type: Boolean, default: true },
    isOnLeave: { type: Boolean, default: false },
    leaveUntil:{ type: Date },

    // ── Emergency contact ─────────────────────────────────────────────────────
    emergencyContact: {
      name:         { type: String },
      relationship: { type: String },
      phone:        { type: String },
    },

    // ── Notes ─────────────────────────────────────────────────────────────────
    notes: { type: String },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────
hospitalStaffSchema.virtual('fullName').get(function () {
  return `${this.name.first} ${this.name.last}`;
});

// ── Indexes ───────────────────────────────────────────────────────────────────
hospitalStaffSchema.index({ role: 1, department: 1 });
hospitalStaffSchema.index({ email: 1 });

module.exports = mongoose.model('HospitalStaff', hospitalStaffSchema);
