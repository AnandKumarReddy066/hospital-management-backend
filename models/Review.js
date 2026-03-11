/**
 * models/Review.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Patient reviews for doctors, automatically updating the doctor's
 * aggregated rating using a post-save hook.
 */

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    // ── References ────────────────────────────────────────────────────────────
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      unique: true,   // One review per appointment
    },

    // ── Ratings ───────────────────────────────────────────────────────────────
    rating: {
      overall:       { type: Number, required: true, min: 1, max: 5 },
      communication: { type: Number, min: 1, max: 5 },   // Bedside manner
      waitTime:      { type: Number, min: 1, max: 5 },
      expertise:     { type: Number, min: 1, max: 5 },
      cleanliness:   { type: Number, min: 1, max: 5 },
    },

    // ── Content ───────────────────────────────────────────────────────────────
    title:     { type: String, maxlength: 150 },
    comment:   { type: String, maxlength: 1000 },
    images:    [{ type: String }],    // Cloudinary URLs for review screenshots

    // ── Moderation ────────────────────────────────────────────────────────────
    isVerified:  { type: Boolean, default: false },  // verified appointment-based review
    isPublished: { type: Boolean, default: true },
    isReported:  { type: Boolean, default: false },
    reportReason:{ type: String },

    // ── Doctor reply ──────────────────────────────────────────────────────────
    doctorReply: {
      message:   { type: String },
      repliedAt: { type: Date },
    },

    // ── Helpful votes ─────────────────────────────────────────────────────────
    helpfulVotes:   { type: Number, default: 0 },
    unhelpfulVotes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ── Post-save hook: update Doctor's aggregated ratings ────────────────────────
reviewSchema.post('save', async function () {
  const Doctor = mongoose.model('Doctor');
  const stats = await mongoose.model('Review').aggregate([
    { $match: { doctorId: this.doctorId, isPublished: true } },
    {
      $group: {
        _id:     '$doctorId',
        average: { $avg: '$rating.overall' },
        count:   { $sum: 1 },
        total:   { $sum: '$rating.overall' },
      },
    },
  ]);
  if (stats.length > 0) {
    await Doctor.findByIdAndUpdate(this.doctorId, {
      'ratings.average': Math.round(stats[0].average * 10) / 10,
      'ratings.count':   stats[0].count,
      'ratings.total':   stats[0].total,
    });
  }
});

// ── Post-delete hook: recalculate ratings ─────────────────────────────────────
reviewSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    const Doctor = mongoose.model('Doctor');
    const stats = await mongoose.model('Review').aggregate([
      { $match: { doctorId: doc.doctorId, isPublished: true } },
      { $group: { _id: '$doctorId', average: { $avg: '$rating.overall' }, count: { $sum: 1 }, total: { $sum: '$rating.overall' } } },
    ]);
    await Doctor.findByIdAndUpdate(doc.doctorId, {
      'ratings.average': stats[0]?.average || 0,
      'ratings.count':   stats[0]?.count   || 0,
      'ratings.total':   stats[0]?.total   || 0,
    });
  }
});

reviewSchema.index({ doctorId: 1, isPublished: 1, createdAt: -1 });
reviewSchema.index({ patientId: 1 });

module.exports = mongoose.model('Review', reviewSchema);
