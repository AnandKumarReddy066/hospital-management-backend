/**
 * controllers/adminController.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Advanced analytics and metrics aggregations for the Admin Dashboard.
 */

const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');

exports.getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // ── 1. Top-Level Cards ────────────────────────────────────────────────────
    const [
      totalPatients,
      totalDoctors,
      todayAppointments,
      totalRevenueToday,
    ] = await Promise.all([
      User.countDocuments({ role: 'patient' }),
      User.countDocuments({ role: 'doctor' }),
      Appointment.countDocuments({ date: { $gte: today } }),
      // Calculate today's revenue from successful payments
      Payment.aggregate([
        { $match: { status: 'success', paidAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$netAmount' } } },
      ]),
    ]);

    // ── 2. Department Statistics ──────────────────────────────────────────────
    // Group doctors by department
    const deptStats = await User.aggregate([
      { $match: { role: 'doctor', isActive: true } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $project: { department: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } }
    ]);

    // ── 3. Doctor Performance (Appointments per doctor this month) ────────────
    const doctorPerformance = await Appointment.aggregate([
      { $match: { date: { $gte: firstDayOfMonth }, status: 'completed' } },
      { $group: { _id: '$doctorId', completedCount: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'doctor' } },
      { $unwind: '$doctor' },
      { $project: {
          doctorId: '$_id',
          name: { $concat: ['$doctor.name.first', ' ', '$doctor.name.last'] },
          department: '$doctor.department',
          completedCount: 1,
          _id: 0
      }},
      { $sort: { completedCount: -1 } },
      { $limit: 10 }
    ]);

    // ── 4. Daily Reports (Revenue & Appointments over last 7 days) ────────────
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const dailyRevenue = await Payment.aggregate([
      { $match: { status: 'success', paidAt: { $gte: sevenDaysAgo } } },
      { $group: { 
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } }, 
          revenue: { $sum: '$netAmount' } 
      }},
      { $sort: { _id: 1 } }
    ]);

    const dailyAppointments = await Appointment.aggregate([
      { $match: { date: { $gte: sevenDaysAgo } } },
      { $group: { 
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, 
          count: { $sum: 1 } 
      }},
      { $sort: { _id: 1 } }
    ]);

    // Format final response
    res.json({
      success: true,
      data: {
        summary: {
          totalPatients,
          totalDoctors,
          todayAppointments,
          todayRevenue: totalRevenueToday[0]?.total || 0,
        },
        departmentStats: deptStats,
        doctorPerformance,
        charts: {
          dailyRevenue,
          dailyAppointments
        }
      }
    });

  } catch (err) {
    next(err);
  }
};
