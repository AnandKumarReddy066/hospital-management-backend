/**
 * services/notificationService.js
 * Creates DB notifications and dispatches email / WebSocket events.
 */

const Notification = require('../models/Notification');
const emailService  = require('./emailService');
const { broadcast } = require('../websocket/wsServer');
const logger = require('../utils/logger');

const createNotification = async ({ recipient, title, message, type, link, metadata }) => {
  const notification = await Notification.create({ recipient, title, message, type, link, metadata });
  // Push real-time update via WebSocket
  broadcast(recipient.toString(), { event: 'NEW_NOTIFICATION', data: notification });
  return notification;
};

exports.sendAppointmentConfirmation = async (appointment) => {
  try {
    await createNotification({
      recipient: appointment.patient,
      title: 'Appointment Confirmed',
      message: `Your appointment on ${new Date(appointment.appointmentDate).toDateString()} at ${appointment.slot.startTime} is confirmed.`,
      type: 'appointment',
      link: `/appointments/${appointment._id}`,
    });
  } catch (err) {
    logger.error(`Notification error: ${err.message}`);
  }
};

exports.sendStatusUpdate = async (appointment) => {
  try {
    await createNotification({
      recipient: appointment.patient,
      title: `Appointment ${appointment.status}`,
      message: `Your appointment status has been updated to: ${appointment.status}.`,
      type: 'appointment',
      link: `/appointments/${appointment._id}`,
    });
  } catch (err) {
    logger.error(`Notification error: ${err.message}`);
  }
};

exports.sendBillingAlert = async (patientId, bill) => {
  await createNotification({
    recipient: patientId,
    title: 'New Bill Generated',
    message: `A bill of ₹${bill.totalAmount} has been generated. Due: ${new Date(bill.dueDate).toDateString()}.`,
    type: 'billing',
    link: `/billing/${bill._id}`,
  });
};
