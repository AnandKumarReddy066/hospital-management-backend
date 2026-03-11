/**
 * controllers/queueController.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Manages the daily patient queue.
 * - status: Get current queue stats for a patient to view.
 * - getMyQueue: For doctors to view their daily list.
 * - callNext: For doctors to advance the queue, triggering WebSocket broadcasts.
 */

const QueueStatus = require('../models/QueueStatus');
const Appointment = require('../models/Appointment');
const { AppError } = require('../middleware/errorHandler');
const wsServer = require('../websocket/wsServer');
const logger = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════════
// GET QUEUE STATUS (Public/Patient View)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/queue/status
 * @desc    Get public-facing queue stats for a specific doctor & date
 * @access  Protected
 */
exports.getQueueStatus = async (req, res, next) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) return next(new AppError('doctorId and date are required', 400));

    const queue = await QueueStatus.findOne({ doctorId, date: new Date(date) });
    
    if (!queue) {
      return res.json({ success: true, data: { currentPosition: 0, waitMinutes: 0 } });
    }

    res.json({
      success: true,
      data: {
        currentPosition: queue.currentPosition,
        waitMinutes: queue.estimatedWaitPerPatient || 15,
        isActive: queue.sessionStatus === 'active'
      }
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET DOCTOR'S QUEUE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/queue/my-queue
 * @desc    Get the full day's queue list. Optionally creates it if missing.
 * @access  Protected (Doctor)
 */
exports.getMyQueue = async (req, res, next) => {
  try {
    const doctorId = req.user.profileId; // assuming user is a Doctor
    const dateInput = req.query.date || new Date().toISOString().split('T')[0];
    const targetDate = new Date(dateInput);

    let queue = await QueueStatus.findOne({ doctorId, date: targetDate })
      .populate('entries.patientId', 'name gender age');

    // If no queue exists yet, we should technically build it from Appointments.
    // For this demonstration, we'll return an empty structure if missing,
    // though in a real app, a cron job or webhook would seed this array.
    if (!queue) {
      // Fetch today's appointments for this doctor to auto-seed
      const startOfDay = new Date(targetDate.setHours(0,0,0,0));
      const endOfDay = new Date(targetDate.setHours(23,59,59,999));
      
      const appts = await Appointment.find({
        doctorId,
        date: { $gte: startOfDay, $lte: endOfDay },
        status: { $in: ['confirmed', 'checked-in'] }
      }).populate('patientId', 'name gender age').sort({ 'time.start': 1 });

      const entries = appts.map((a, i) => ({
        appointmentId: a._id,
        patientId: a.patientId._id,
        position: i + 1,
        status: a.status === 'checked-in' ? 'waiting' : 'waiting',
        scheduledTime: a.time.start,
        priority: a.type === 'emergency' ? 'urgent' : 'normal'
      }));

      queue = await QueueStatus.create({
        doctorId,
        date: startOfDay,
        entries,
        sessionStatus: entries.length > 0 ? 'active' : 'scheduled'
      });
      
      queue = await QueueStatus.findById(queue._id).populate('entries.patientId', 'name gender age');
    }

    res.json({ success: true, data: queue });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CALL NEXT PATIENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/queue/:id/call-next
 * @desc    Advances the queue, marking the next waiting patient as 'in-consultation'
 * @access  Protected (Doctor)
 */
exports.callNextPatient = async (req, res, next) => {
  try {
    const queue = await QueueStatus.findById(req.params.id);
    if (!queue) return next(new AppError('Queue not found', 404));
    
    // Ensure caller is the owner of this queue (omitted for brevity)

    // 1. Mark current 'in-consultation' (if any) as 'completed'
    let currentCompleted = false;
    queue.entries.forEach(e => {
      if (e.status === 'in-consultation' || e.status === 'called') {
        e.status = 'completed';
        e.completedAt = new Date();
        currentCompleted = true;
      }
    });

    // 2. Find next waiting patient
    const nextEntry = queue.entries
      .filter(e => e.status === 'waiting')
      .sort((a, b) => a.position - b.position)[0];

    if (!nextEntry) {
      // Save completed state if we just finished the last one
      if (currentCompleted) await queue.save();
      return next(new AppError('No patients waiting in queue', 400));
    }

    // 3. Mark next as called
    nextEntry.status = 'called';
    nextEntry.calledAt = new Date();
    
    // 4. Update queue top-level stats
    queue.currentPosition = nextEntry.position;
    queue.currentPatientId = nextEntry.patientId;
    queue.consultationStarted = new Date();
    
    await queue.save();

    // 5. BROADCAST VIA WEBSOCKET 
    // Broadcast to the specific patient that it's their turn
    wsServer.broadcast(nextEntry.patientId.toString(), {
      type: 'QUEUE_UPDATE',
      message: `It's your turn! Please proceed to Dr. room.`,
      doctorId: queue.doctorId,
      data: {
        currentPosition: queue.currentPosition,
        waitMinutes: 0
      }
    });

    // Also broadcast a general update to ALL patients tracking this doctor
    wsServer.broadcastAll({
      type: 'QUEUE_UPDATE',
      doctorId: queue.doctorId,
      data: {
        currentPosition: queue.currentPosition,
        waitMinutes: queue.estimatedWaitPerPatient || 15
      }
    });

    logger.info(`Queue advanced. Calling position ${nextEntry.position}`);
    
    res.json({ success: true, message: 'Next patient called', data: nextEntry });
  } catch (err) { next(err); }
};
