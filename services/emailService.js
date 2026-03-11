/**
 * services/emailService.js
 * Nodemailer-based transactional email service.
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendMail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Hospital Management" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`Email failed to ${to}: ${err.message}`);
    throw err;
  }
};

exports.sendWelcomeEmail = (user) =>
  sendMail({
    to: user.email,
    subject: 'Welcome to Hospital Management Platform',
    html: `<h2>Welcome, ${user.firstName}!</h2><p>Your account has been created successfully.</p>`,
  });

exports.sendOTPEmail = (user, otp) =>
  sendMail({
    to: user.email,
    subject: 'Password Reset OTP',
    html: `<h2>Password Reset</h2><p>Your OTP is: <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
  });

exports.sendAppointmentEmail = (user, appointment) =>
  sendMail({
    to: user.email,
    subject: 'Appointment Confirmation',
    html: `<h2>Appointment Confirmed</h2>
           <p>Your appointment is scheduled for ${new Date(appointment.appointmentDate).toDateString()} 
           at ${appointment.slot.startTime}.</p>`,
  });
