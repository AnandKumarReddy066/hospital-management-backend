/**
 * models/Patient.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Stores complete patient profile including personal details, contact
 * information, medical history, emergency contacts, and insurance.
 */

const mongoose = require('mongoose');

// ── Embedded sub-schemas ──────────────────────────────────────────────────────

const medicalHistorySchema = new mongoose.Schema({
  condition:      { type: String, required: true }, // e.g. "Type 2 Diabetes"
  diagnosedOn:    { type: Date },
  status:         { type: String, enum: ['active', 'resolved', 'chronic'], default: 'active' },
  treatingDoctor: { type: String },
  notes:          { type: String },
}, { _id: false });

const allergySchema = new mongoose.Schema({
  substance: { type: String, required: true }, // e.g. "Penicillin"
  severity:  { type: String, enum: ['mild', 'moderate', 'severe'], default: 'mild' },
  reaction:  { type: String }, // e.g. "Rash, difficulty breathing"
}, { _id: false });

const vaccinationSchema = new mongoose.Schema({
  vaccine:       { type: String, required: true },
  dateAdminis:   { type: Date },
  nextDueDate:   { type: Date },
  batchNumber:   { type: String },
}, { _id: false });

const addressSchema = new mongoose.Schema({
  street:  { type: String },
  city:    { type: String },
  state:   { type: String },
  country: { type: String, default: 'India' },
  pincode: { type: String },
}, { _id: false });

// ── Main schema ───────────────────────────────────────────────────────────────

const patientSchema = new mongoose.Schema(
  {
    // ── Core identification ─────────────────────────────────────────────────
    name: {
      first:  { type: String, required: true, trim: true },
      last:   { type: String, required: true, trim: true },
    },
    age:     { type: Number, required: true, min: 0, max: 150 },
    gender:  { type: String, enum: ['male', 'female', 'other'], required: true },
    dob:     { type: Date },                // Date of birth (source of truth over `age`)

    // ── Contact ─────────────────────────────────────────────────────────────
    phone:   { type: String, required: true, unique: true },
    email:   { type: String, required: true, unique: true, lowercase: true },
    address: addressSchema,

    // ── Auth reference ───────────────────────────────────────────────────────
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // ── Physical ─────────────────────────────────────────────────────────────
    bloodGroup:  { type: String, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-'] },
    height:      { type: Number },    // centimetres
    weight:      { type: Number },    // kilograms

    // ── Medical data ──────────────────────────────────────────────────────────
    medicalHistory:     { type: [medicalHistorySchema], default: [] },
    allergies:          { type: [allergySchema],        default: [] },
    vaccinations:       { type: [vaccinationSchema],    default: [] },
    currentMedications: { type: [String],               default: [] },
    chronicConditions:  { type: [String],               default: [] },

    // ── Emergency contact ─────────────────────────────────────────────────────
    emergencyContact: {
      name:         { type: String },
      relationship: { type: String },
      phone:        { type: String },
    },

    // ── Insurance ─────────────────────────────────────────────────────────────
    insurance: {
      provider:   { type: String },
      policyNo:   { type: String },
      expiryDate: { type: Date },
      coverageAmount: { type: Number },
    },

    // ── Profile image ─────────────────────────────────────────────────────────
    profileImage:  { type: String, default: '' },

    // ── Status ────────────────────────────────────────────────────────────────
    isActive:      { type: Boolean, default: true },
    registeredAt:  { type: Date,    default: Date.now },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────
patientSchema.virtual('fullName').get(function () {
  return `${this.name.first} ${this.name.last}`;
});

// ── Indexes ───────────────────────────────────────────────────────────────────
patientSchema.index({ email: 1 });
patientSchema.index({ phone: 1 });
patientSchema.index({ 'name.first': 'text', 'name.last': 'text' });

module.exports = mongoose.model('Patient', patientSchema);
