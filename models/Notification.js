/**
 * models/Notification.js
 * In-app + push notification records.
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:     { type: String, required: true },
    message:   { type: String, required: true },
    type: {
      type: String,
      enum: ['appointment', 'billing', 'report', 'alert', 'system', 'reminder'],
      default: 'system',
    },
    channel:   { type: String, enum: ['in-app', 'email', 'sms', 'push'], default: 'in-app' },
    isRead:    { type: Boolean, default: false },
    readAt:    Date,
    link:      String,   // Deep link inside the app
    metadata:  mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
