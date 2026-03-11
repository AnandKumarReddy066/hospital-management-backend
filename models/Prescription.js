/**
 * models/Prescription.js
 * Digital prescription issued by the doctor after a consultation.
 */

const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  dosage:    String,   // "500mg"
  frequency: String,   // "twice daily"
  duration:  String,   // "7 days"
  notes:     String,
});

const prescriptionSchema = new mongoose.Schema(
  {
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
    patient:     { type: mongoose.Schema.Types.ObjectId, ref: 'Patient',     required: true },
    doctor:      { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor',      required: true },
    diagnosis:   { type: String, required: true },
    medicines:   [medicineSchema],
    labTests:    [String],
    advice:      String,
    followUpDate:Date,
    issuedAt:    { type: Date, default: Date.now },
    pdfUrl:      String,   // Cloudinary URL of generated PDF
  },
  { timestamps: true }
);

module.exports = mongoose.model('Prescription', prescriptionSchema);
