/**
 * services/queueService.js
 * Manages real-time appointment queue numbers using Bull + Redis.
 * Bull queues can also be used for background jobs (email sending, report generation, etc.)
 */

const Bull = require('bull');
const logger = require('../utils/logger');

// ── Queue definitions ──────────────────────────────────────────────────────────
const appointmentQueue = new Bull('appointments', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD || undefined,
  },
});

const emailQueue = new Bull('emails', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

const reportQueue = new Bull('reports', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

// ── Processors ─────────────────────────────────────────────────────────────────
emailQueue.process(async (job) => {
  const emailService = require('./emailService');
  await emailService.sendMail(job.data);
  logger.info(`Email job ${job.id} processed`);
});

// ── Queue number assignment ────────────────────────────────────────────────────
/**
 * Assigns the next queue number for a given doctor on a given date.
 * Uses the total count of appointments already in the queue + 1.
 */
exports.assignQueueNumber = async (doctorId, date) => {
  const Appointment = require('../models/Appointment');
  const count = await Appointment.countDocuments({
    doctor: doctorId,
    appointmentDate: new Date(date),
    status: { $nin: ['cancelled', 'no-show'] },
  });
  return count + 1;
};

// ── Enqueue background jobs ────────────────────────────────────────────────────
exports.enqueueEmail = async (emailData) => {
  await emailQueue.add(emailData, { attempts: 3, backoff: { type: 'fixed', delay: 5000 } });
};

exports.enqueueReportGeneration = async (reportData) => {
  await reportQueue.add(reportData, { attempts: 2 });
};

exports.appointmentQueue = appointmentQueue;
exports.emailQueue       = emailQueue;
exports.reportQueue      = reportQueue;
