import { asyncHandler } from '../../middlewares/errorHandler';
import Appointment from '../../models/Appointment';
import Expert from '../../models/Expert';
import User from '../../models/User';

// @desc    Get all bookings (Admin)
// @route   GET /api/admin/bookings
// @access  Private (Admin)
export const getAllBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10, search } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const query: any = {};
  
  if (status && status !== 'All') {
    query.status = status.toLowerCase();
  }

  // Search functionality - we'll filter after populating
  // Note: MongoDB text search on populated fields is complex, so we'll do client-side filtering
  // For better performance, you could use aggregation pipeline with $lookup

  const appointments = await Appointment.find(query)
    .populate('user', 'firstName lastName email')
    .populate('expert', 'firstName lastName specialization profileImage')
    .sort({ sessionDate: -1, startTime: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Appointment.countDocuments(query);

  // Get stats
  const totalBookings = await Appointment.countDocuments();
  const confirmedBookings = await Appointment.countDocuments({ status: 'confirmed' });
  const pendingBookings = await Appointment.countDocuments({ status: 'pending' });
  const cancelledBookings = await Appointment.countDocuments({ status: 'cancelled' });
  const completedBookings = await Appointment.countDocuments({ status: 'completed' });

  res.status(200).json({
    success: true,
    data: {
      appointments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      stats: {
        total: totalBookings,
        confirmed: confirmedBookings,
        pending: pendingBookings,
        cancelled: cancelledBookings,
        completed: completedBookings
      }
    }
  });
});

// @desc    Get booking by ID (Admin)
// @route   GET /api/admin/bookings/:id
// @access  Private (Admin)
export const getBookingById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const appointment = await Appointment.findById(id)
    .populate('user', 'firstName lastName email phone')
    .populate('expert', 'firstName lastName specialization profileImage email phone');

  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      appointment
    }
  });
});

// @desc    Cancel booking (Admin) - Emergency/Dispute only
// @route   PATCH /api/admin/bookings/:id/status
// @access  Private (Admin)
// @note    Admin can only cancel bookings, not confirm them. Only experts can confirm bookings.
export const updateBookingStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, cancellationReason } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'Status is required'
    });
  }

  // Admin can only cancel bookings, not confirm or change to other statuses
  if (status !== 'cancelled') {
    return res.status(403).json({
      success: false,
      message: 'Admin can only cancel bookings. Only experts can confirm bookings.'
    });
  }

  const appointment = await Appointment.findById(id);
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Require cancellation reason for admin cancellations
  if (!cancellationReason || cancellationReason.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Cancellation reason is required for admin cancellations'
    });
  }

  appointment.status = 'cancelled';
  appointment.cancelledBy = 'expert'; // Mark as expert cancellation (admin acts on behalf)
  appointment.cancellationReason = cancellationReason;

  await appointment.save();

  // Populate for response
  await appointment.populate('user', 'firstName lastName email');
  await appointment.populate('expert', 'firstName lastName specialization profileImage');

  res.status(200).json({
    success: true,
    data: {
      appointment
    },
    message: 'Booking cancelled successfully by admin'
  });
});

