/**
 * models/MedicalReport.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Stores lab and radiology reports uploaded by staff or doctors.
 * Includes an AI analysis sub-document populated by the AI report analyser.
 */

const mongoose = require('mongoose');

// ── Lab result row (for structured reports like blood tests) ──────────────────
const testResultSchema = new mongoose.Schema({
  parameter:   { type: String },          // e.g. "Haemoglobin"
  value:       { type: mongoose.Schema.Types.Mixed },  // "12.5" or "Negative"
  unit:        { type: String },          // "g/dL"
  normalRange: { type: String },          // "12 – 16"
  isAbnormal:  { type: Boolean, default: false },
}, { _id: false });

// ── AI analysis (populated asynchronously) ────────────────────────────────────
const aiAnalysisSchema = new mongoose.Schema({
  summary:     { type: String },
  findings:    { type: [String], default: [] },
  riskLevel:   { type: String, enum: ['low', 'moderate', 'high'] },
  suggestions: { type: [String], default: [] },
  analysedAt:  { type: Date },
  modelUsed:   { type: String, default: 'gpt-4o' },
}, { _id: false });

// ── Main schema ───────────────────────────────────────────────────────────────

const medicalReportSchema = new mongoose.Schema(
  {
    // ── References ────────────────────────────────────────────────────────────
    patientId:     {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    doctorId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },

    // ── Report metadata ───────────────────────────────────────────────────────
    reportType: {
      type: String,
      required: true,
      enum: [
        'blood_test', 'urine_test', 'stool_test',
        'x_ray', 'mri', 'ct_scan', 'ultrasound', 'ecg', 'echo',
        'biopsy', 'pathology', 'culture', 'other',
      ],
    },
    title:         { type: String, required: true },
    description:   { type: String },
    labName:       { type: String },      // Name of the diagnostic lab
    technicianName:{ type: String },

    // ── Test results (structured, optional) ───────────────────────────────────
    testResults: { type: [testResultSchema], default: [] },
    hasCritical: { type: Boolean, default: false },   // auto-set if any result isAbnormal

    // ── File ──────────────────────────────────────────────────────────────────
    fileUrl:   { type: String, required: true },    // Cloudinary / S3 URL
    fileType:  { type: String, enum: ['pdf', 'image', 'dicom', 'other'], default: 'pdf' },
    fileName:  { type: String },
    fileSize:  { type: Number },  // bytes
    thumbnailUrl: { type: String },

    // ── Dates ─────────────────────────────────────────────────────────────────
    sampleCollectedAt: { type: Date },
    reportedAt:        { type: Date },

    // ── Sharing ───────────────────────────────────────────────────────────────
    isSharedWithDoctor: { type: Boolean, default: true },
    sharedWith:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' }],

    // ── AI analysis ───────────────────────────────────────────────────────────
    aiAnalysis: aiAnalysisSchema,

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'processing', 'ready', 'reviewed'],
      default: 'ready',
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

medicalReportSchema.index({ patientId: 1, reportType: 1 });
medicalReportSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model('MedicalReport', medicalReportSchema);
