/**
 * app.js
 * Express application — middleware stack and route mounting.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const { globalErrorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
require('dotenv').config();

// ── Route imports ────────────────────────────────────────────────────────────
const authRoutes        = require('./routes/authRoutes');
const patientRoutes     = require('./routes/patientRoutes');
const doctorRoutes      = require('./routes/doctorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const billingRoutes     = require('./routes/billingRoutes');
const reportRoutes      = require('./routes/reportRoutes');
const aiRoutes          = require('./routes/aiRoutes');
const paymentRoutes     = require('./routes/paymentRoutes');
const notificationRoutes= require('./routes/notificationRoutes');
const adminRoutes       = require('./routes/adminRoutes');
const queueRoutes       = require('./routes/queueRoutes');

const app = express();

// ── Security & utilities ─────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// ── Mount Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/patients',      patientRoutes);
app.use('/api/doctors',       doctorRoutes);
app.use('/api/appointments',  appointmentRoutes);
app.use('/api/billing',       billingRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/ai',            aiRoutes);
app.use('/api/payments',      paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/queue', queueRoutes);

// ── 404 catch-all ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use(globalErrorHandler);

module.exports = app;
