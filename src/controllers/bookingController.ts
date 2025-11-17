import { RtcRole, RtcTokenBuilder } from 'agora-access-token';
import ENV from '../config/environment';
import { asyncHandler } from '../middlewares/errorHandler';
import Appointment, { IAppointment } from '../models/Appointment';
import Expert from '../models/Expert';
import ExpertAvailability from '../models/ExpertAvailability';
import User from '../models/User';

const getSessionDateTimes = (appointment: IAppointment) => {
  const sessionDate = new Date(appointment.sessionDate);
  const [startHour, startMin] = appointment.startTime.split(':').map(Number);
  const [endHour, endMin] = appointment.endTime.split(':').map(Number);

  const startDateTime = new Date(sessionDate);
  startDateTime.setHours(startHour, startMin, 0, 0);

  const endDateTime = new Date(sessionDate);
  endDateTime.setHours(endHour, endMin, 0, 0);

  return { startDateTime, endDateTime };
};

const deriveAgoraUid = (id: string) => {
  if (!id) {
    return Math.floor(Math.random() * 1_000_000);
  }
  const cleanId = id.replace(/[^a-fA-F0-9]/g, '');
  const hexPart = cleanId.slice(-6) || cleanId;
  return parseInt(hexPart, 16);
};

// @desc    Get available time slots for an expert on a specific date
// @route   GET /api/bookings/availability/:expertId
// @access  Public
export const getAvailableSlots = asyncHandler(async (req, res) => {
  const { expertId } = req.params;
  const { date } = req.query; // Format: YYYY-MM-DD

  if (!expertId) {
    return res.status(400).json({
      success: false,
      message: 'Expert ID is required'
    });
  }

  if (!date) {
    return res.status(400).json({
      success: false,
      message: 'Date is required (format: YYYY-MM-DD)'
    });
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date as string)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid date format. Use YYYY-MM-DD'
    });
  }

  // Check if expert exists
  const expert = await Expert.findById(expertId);
  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert not found'
    });
  }

  // Get expert availability
  const availability = await ExpertAvailability.findOne({ expert: expertId });
  if (!availability) {
    return res.status(200).json({
      success: true,
      data: {
        availableSlots: [],
        message: 'No availability set for this expert'
      }
    });
  }

  // Parse the requested date
  const requestedDate = new Date(date as string);
  const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Find the day in availability
  const dayAvailability = availability.availability.find(
    day => day.day === dayOfWeek
  );

  if (!dayAvailability || !dayAvailability.isOpen || dayAvailability.timeRanges.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        availableSlots: [],
        message: 'Expert is not available on this day'
      }
    });
  }

  // Get existing appointments for this date
  const startOfDay = new Date(requestedDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(requestedDate);
  endOfDay.setHours(23, 59, 59, 999);

  const existingAppointments = await Appointment.find({
    expert: expertId,
    sessionDate: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    status: { $in: ['pending', 'confirmed'] }
  }).select('startTime endTime');

  // Generate available slots (30-minute intervals)
  const availableSlots: string[] = [];
  const slotDuration = 30; // minutes

  for (const timeRange of dayAvailability.timeRanges) {
    const [startHour, startMin] = timeRange.startTime.split(':').map(Number);
    const [endHour, endMin] = timeRange.endTime.split(':').map(Number);
    
    let currentHour = startHour;
    let currentMin = startMin;

    while (
      currentHour < endHour ||
      (currentHour === endHour && currentMin < endMin)
    ) {
      const slotStart = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      
      // Calculate slot end time
      let slotEndHour = currentHour;
      let slotEndMin = currentMin + slotDuration;
      if (slotEndMin >= 60) {
        slotEndHour += Math.floor(slotEndMin / 60);
        slotEndMin = slotEndMin % 60;
      }
      const slotEnd = `${String(slotEndHour).padStart(2, '0')}:${String(slotEndMin).padStart(2, '0')}`;

      // Check if slot overlaps with existing appointments
      const isAvailable = !existingAppointments.some(apt => {
        const aptStart = apt.startTime;
        const aptEnd = apt.endTime;
        
        // Check for overlap
        return (
          (slotStart >= aptStart && slotStart < aptEnd) ||
          (slotEnd > aptStart && slotEnd <= aptEnd) ||
          (slotStart <= aptStart && slotEnd >= aptEnd)
        );
      });

      // Check if slot end is within the time range
      if (
        slotEndHour < endHour ||
        (slotEndHour === endHour && slotEndMin <= endMin)
      ) {
        if (isAvailable) {
          availableSlots.push(slotStart);
        }
      }

      // Move to next slot
      currentMin += slotDuration;
      if (currentMin >= 60) {
        currentHour += Math.floor(currentMin / 60);
        currentMin = currentMin % 60;
      }
    }
  }

  res.status(200).json({
    success: true,
    data: {
      availableSlots,
      date: date as string,
      dayOfWeek
    }
  });
});

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Private (User)
export const createBooking = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  
  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  const {
    expertId,
    sessionDate,
    startTime,
    duration,
    consultationMethod,
    sessionType,
    notes
  } = req.body;

  // Validation
  if (!expertId || !sessionDate || !startTime || !duration || !consultationMethod || !sessionType) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields: expertId, sessionDate, startTime, duration, consultationMethod, sessionType'
    });
  }

  // Validate consultation method
  const validConsultationMethods = ['video', 'audio', 'chat', 'in-person'];
  if (!validConsultationMethods.includes(consultationMethod)) {
    return res.status(400).json({
      success: false,
      message: `Invalid consultation method. Must be one of: ${validConsultationMethods.join(', ')}`
    });
  }

  // Validate session type
  const validSessionTypes = ['one-on-one', 'one-to-many'];
  if (!validSessionTypes.includes(sessionType)) {
    return res.status(400).json({
      success: false,
      message: `Invalid session type. Must be one of: ${validSessionTypes.join(', ')}`
    });
  }

  // Validate duration (must be multiple of 30 minutes, between 30 and 240 minutes)
  if (duration < 30 || duration > 240 || duration % 30 !== 0) {
    return res.status(400).json({
      success: false,
      message: 'Duration must be between 30 and 240 minutes and a multiple of 30'
    });
  }

  // Check if expert exists
  const expert = await Expert.findById(expertId);
  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert not found'
    });
  }

  // Check if expert has the requested consultation method
  if (expert.consultationMethods && expert.consultationMethods.length > 0) {
    if (!expert.consultationMethods.includes(consultationMethod)) {
      return res.status(400).json({
        success: false,
        message: `Expert does not offer ${consultationMethod} consultations`
      });
    }
  }

  // Check if expert has the requested session type
  if (expert.sessionType && expert.sessionType.length > 0) {
    if (!expert.sessionType.includes(sessionType)) {
      return res.status(400).json({
        success: false,
        message: `Expert does not offer ${sessionType} sessions`
      });
    }
  }

  // Parse session date and time
  const sessionDateTime = new Date(sessionDate);
  if (isNaN(sessionDateTime.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid session date format'
    });
  }

  // Calculate end time
  const [startHour, startMin] = startTime.split(':').map(Number);
  const endTotalMinutes = startHour * 60 + startMin + duration;
  const endHour = Math.floor(endTotalMinutes / 60);
  const endMin = endTotalMinutes % 60;
  const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

  // Check if slot is available
  const startOfDay = new Date(sessionDateTime);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(sessionDateTime);
  endOfDay.setHours(23, 59, 59, 999);

  // Check for conflicting appointments by comparing time strings
  const existingAppointments = await Appointment.find({
    expert: expertId,
    sessionDate: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    status: { $in: ['pending', 'confirmed'] }
  }).select('startTime endTime');

  // Check if any existing appointment overlaps with the requested time
  const conflictingAppointment = existingAppointments.find(apt => {
    // Convert times to minutes for easier comparison
    const [aptStartHour, aptStartMin] = apt.startTime.split(':').map(Number);
    const [aptEndHour, aptEndMin] = apt.endTime.split(':').map(Number);
    const [reqStartHour, reqStartMin] = startTime.split(':').map(Number);
    const [reqEndHour, reqEndMin] = endTime.split(':').map(Number);
    
    const aptStartTotal = aptStartHour * 60 + aptStartMin;
    const aptEndTotal = aptEndHour * 60 + aptEndMin;
    const reqStartTotal = reqStartHour * 60 + reqStartMin;
    const reqEndTotal = reqEndHour * 60 + reqEndMin;
    
    // Check for overlap: appointments overlap if one starts before the other ends
    return (reqStartTotal < aptEndTotal && reqEndTotal > aptStartTotal);
  });

  if (conflictingAppointment) {
    return res.status(400).json({
      success: false,
      message: 'This time slot is already booked. Please select another time.'
    });
  }

  // Check expert availability for this day
  const dayOfWeek = sessionDateTime.toLocaleDateString('en-US', { weekday: 'long' });
  const availability = await ExpertAvailability.findOne({ expert: expertId });
  
  if (availability) {
    const dayAvailability = availability.availability.find(
      day => day.day === dayOfWeek
    );

    if (!dayAvailability || !dayAvailability.isOpen) {
      return res.status(400).json({
        success: false,
        message: `Expert is not available on ${dayOfWeek}`
      });
    }

    // Check if the requested time is within available time ranges
    const isWithinRange = dayAvailability.timeRanges.some(range => {
      return startTime >= range.startTime && endTime <= range.endTime;
    });

    if (!isWithinRange) {
      return res.status(400).json({
        success: false,
        message: 'Requested time is outside expert\'s available hours'
      });
    }
  }

  // Calculate price (based on hourly rate and duration)
  const hourlyRate = expert.hourlyRate || 0;
  const price = Math.round((hourlyRate * duration) / 60);

  // Create appointment
  const appointment = await Appointment.create({
    user: currentUser._id,
    expert: expertId,
    sessionDate: sessionDateTime,
    startTime,
    endTime,
    duration,
    consultationMethod,
    sessionType,
    price,
    notes: notes || undefined,
    status: 'pending'
  });

  // Populate user and expert details
  await appointment.populate('user', 'firstName lastName email');
  await appointment.populate('expert', 'firstName lastName specialization profileImage');

  res.status(201).json({
    success: true,
    data: {
      appointment
    },
    message: 'Booking created successfully. Waiting for expert confirmation.'
  });
});

// @desc    Get user's bookings
// @route   GET /api/bookings/user
// @access  Private (User)
export const getUserBookings = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  
  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  const { status, page = 1, limit = 10 } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const query: any = { user: currentUser._id };
  if (status) {
    query.status = status;
  }

  const appointments = await Appointment.find(query)
    .populate('expert', 'firstName lastName specialization profileImage hourlyRate')
    .sort({ sessionDate: 1, startTime: 1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Appointment.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      appointments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }
  });
});

// @desc    Get expert's bookings
// @route   GET /api/bookings/expert
// @access  Private (Expert)
export const getExpertBookings = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  
  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  // Find expert by user ID or email
  const userId = currentUser._id.toString();
  const userEmail = currentUser.email || (currentUser as any).email;
  
  let expert = await Expert.findById(userId).select('_id');
  if (!expert && userEmail) {
    expert = await Expert.findOne({ email: userEmail.toLowerCase() }).select('_id');
  }

  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert profile not found'
    });
  }

  const expertId = expert._id.toString();
  const { status, page = 1, limit = 10 } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const query: any = { expert: expertId };
  if (status) {
    query.status = status;
  }

  const appointments = await Appointment.find(query)
    .populate('user', 'firstName lastName email')
    .sort({ sessionDate: 1, startTime: 1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Appointment.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      appointments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }
  });
});

// @desc    Update booking status (confirm, cancel, etc.)
// @route   PATCH /api/bookings/:id/status
// @access  Private
export const updateBookingStatus = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { id } = req.params;
  const { status, cancellationReason } = req.body;

  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'Status is required'
    });
  }

  const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
  }

  const appointment = await Appointment.findById(id);
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found'
    });
  }

  // Check if user has permission (either the user or the expert)
  const userId = currentUser._id.toString();
  const userEmail = currentUser.email || (currentUser as any).email;
  
  const isUser = appointment.user.toString() === userId;
  
  let expert = await Expert.findById(userId).select('_id');
  if (!expert && userEmail) {
    expert = await Expert.findOne({ email: userEmail.toLowerCase() }).select('_id');
  }
  const isExpert = expert && appointment.expert.toString() === expert._id.toString();

  if (!isUser && !isExpert) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to update this appointment'
    });
  }

  // Update status
  appointment.status = status as any;

  if (status === 'cancelled') {
    appointment.cancelledBy = isUser ? 'user' : 'expert';
    if (cancellationReason) {
      appointment.cancellationReason = cancellationReason;
    }
  }

  await appointment.save();

  // Populate for response
  await appointment.populate('user', 'firstName lastName email');
  await appointment.populate('expert', 'firstName lastName specialization profileImage');

  res.status(200).json({
    success: true,
    data: {
      appointment
    },
    message: `Appointment ${status} successfully`
  });
});

// @desc    Reschedule a booking (update date/time)
// @route   PATCH /api/bookings/:id/reschedule
// @access  Private (User only)
export const rescheduleBooking = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { id } = req.params;
  const { sessionDate, startTime, duration } = req.body;

  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  if (!sessionDate || !startTime || !duration) {
    return res.status(400).json({
      success: false,
      message: 'Please provide sessionDate, startTime, and duration'
    });
  }

  // Validate duration (must be multiple of 30 minutes, between 30 and 240 minutes)
  if (duration < 30 || duration > 240 || duration % 30 !== 0) {
    return res.status(400).json({
      success: false,
      message: 'Duration must be between 30 and 240 minutes and a multiple of 30'
    });
  }

  const appointment = await Appointment.findById(id);
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found'
    });
  }

  // Only the user who owns the booking can reschedule
  const userId = currentUser._id.toString();
  if (appointment.user.toString() !== userId) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to reschedule this appointment'
    });
  }

  // Cannot reschedule cancelled or completed appointments
  if (appointment.status === 'cancelled' || appointment.status === 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Cannot reschedule a cancelled or completed appointment'
    });
  }

  // Calculate end time
  const [startHour, startMin] = startTime.split(':').map(Number);
  const startTotal = startHour * 60 + startMin;
  const endTotal = startTotal + duration;
  const endHour = Math.floor(endTotal / 60);
  const endMin = endTotal % 60;
  const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

  // Validate date format and ensure it's not in the past
  const newSessionDate = new Date(sessionDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessionDateOnly = new Date(newSessionDate);
  sessionDateOnly.setHours(0, 0, 0, 0);

  if (sessionDateOnly < today) {
    return res.status(400).json({
      success: false,
      message: 'Cannot reschedule to a past date'
    });
  }

  // If rescheduling to today, ensure time is not in the past
  if (sessionDateOnly.getTime() === today.getTime()) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTotal = currentHour * 60 + currentMin;
    
    if (startTotal < currentTotal) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reschedule to a time in the past'
      });
    }
  }

  // Check if expert exists
  const expert = await Expert.findById(appointment.expert);
  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert not found'
    });
  }

  // Check for time slot conflicts (excluding the current appointment)
  const existingAppointments = await Appointment.find({
    expert: appointment.expert,
    sessionDate: newSessionDate,
    status: { $in: ['pending', 'confirmed'] },
    _id: { $ne: appointment._id } // Exclude current appointment
  });

  const conflictingAppointment = existingAppointments.find(apt => {
    const [aptStartHour, aptStartMin] = apt.startTime.split(':').map(Number);
    const [aptEndHour, aptEndMin] = apt.endTime.split(':').map(Number);
    
    const aptStartTotal = aptStartHour * 60 + aptStartMin;
    const aptEndTotal = aptEndHour * 60 + aptEndMin;
    
    return (startTotal < aptEndTotal && endTotal > aptStartTotal);
  });

  if (conflictingAppointment) {
    return res.status(400).json({
      success: false,
      message: 'The selected time slot is already booked. Please choose another time.'
    });
  }

  // Check expert availability for the new date
  const availability = await ExpertAvailability.findOne({
    expert: appointment.expert
  });

  if (!availability) {
    return res.status(400).json({
      success: false,
      message: 'Expert has not set their availability'
    });
  }

  // Parse the requested date to get day name
  const dayOfWeek = newSessionDate.toLocaleDateString('en-US', { weekday: 'long' }); // e.g., "Tuesday"
  
  // Find the day in availability array
  const dayAvailability = availability.availability.find(
    day => day.day === dayOfWeek
  );

  if (!dayAvailability || !dayAvailability.isOpen || !dayAvailability.timeRanges || dayAvailability.timeRanges.length === 0) {
    return res.status(400).json({
      success: false,
      message: `Expert is not available on ${dayOfWeek}`
    });
  }

  // Check if the time slot falls within any of the expert's available time ranges for that day
  let isWithinAvailableHours = false;
  for (const timeRange of dayAvailability.timeRanges) {
    const [rangeStartHour, rangeStartMin] = timeRange.startTime.split(':').map(Number);
    const [rangeEndHour, rangeEndMin] = timeRange.endTime.split(':').map(Number);
    const rangeStartTotal = rangeStartHour * 60 + rangeStartMin;
    const rangeEndTotal = rangeEndHour * 60 + rangeEndMin;

    // Check if the requested time slot overlaps with this time range
    if (startTotal >= rangeStartTotal && endTotal <= rangeEndTotal) {
      isWithinAvailableHours = true;
      break;
    }
  }

  if (!isWithinAvailableHours) {
    const timeRangesStr = dayAvailability.timeRanges
      .map(range => `${range.startTime} - ${range.endTime}`)
      .join(', ');
    return res.status(400).json({
      success: false,
      message: `The selected time is outside expert's available hours on ${dayOfWeek} (${timeRangesStr})`
    });
  }

  // Update appointment
  appointment.sessionDate = newSessionDate;
  appointment.startTime = startTime;
  appointment.endTime = endTime;
  appointment.duration = duration;
  appointment.status = 'pending'; // Reset to pending for expert confirmation
  appointment.cancelledBy = undefined;
  appointment.cancellationReason = undefined;

  await appointment.save();

  // Populate for response
  await appointment.populate('user', 'firstName lastName email');
  await appointment.populate('expert', 'firstName lastName specialization profileImage');

  res.status(200).json({
    success: true,
    data: {
      appointment
    },
    message: 'Appointment rescheduled successfully. Waiting for expert confirmation.'
  });
});

// @desc    Generate Agora token for a booking
// @route   GET /api/bookings/:id/agora-token
// @access  Private (User or Expert)
export const getAgoraToken = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { id } = req.params;

  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  if (!ENV.AGORA_APP_ID || !ENV.AGORA_APP_CERTIFICATE) {
    return res.status(500).json({
      success: false,
      message: 'Agora credentials are not configured on the server'
    });
  }

  const appointment = await Appointment.findById(id).populate('user', 'firstName lastName email').populate('expert', 'firstName lastName email');

  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found'
    });
  }

  if (appointment.consultationMethod !== 'video') {
    return res.status(400).json({
      success: false,
      message: 'Video calling is only available for video consultation bookings'
    });
  }

  const userId = currentUser._id.toString();
  const userEmail = currentUser.email || (currentUser as any).email;

  const isUser = appointment.user._id.toString() === userId;

  let expertRecord = await Expert.findById(userId).select('_id');
  if (!expertRecord && userEmail) {
    expertRecord = await Expert.findOne({ email: userEmail.toLowerCase() }).select('_id');
  }
  const isExpert = expertRecord && appointment.expert._id.toString() === expertRecord._id.toString();

  if (!isUser && !isExpert) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to access this booking'
    });
  }

  if (appointment.status !== 'confirmed') {
    return res.status(400).json({
      success: false,
      message: 'Session must be confirmed before joining the call'
    });
  }

  const { startDateTime, endDateTime } = getSessionDateTimes(appointment);
  const joinWindowMinutes = ENV.AGORA_JOIN_WINDOW_MINUTES || 5;
  const joinWindowMillis = joinWindowMinutes * 60 * 1000;
  const now = new Date();

  if (now.getTime() < startDateTime.getTime() - joinWindowMillis) {
    return res.status(400).json({
      success: false,
      message: `You can join this session ${joinWindowMinutes} minutes before the scheduled start time`
    });
  }

  if (now.getTime() > endDateTime.getTime()) {
    return res.status(400).json({
      success: false,
      message: 'This session has already ended'
    });
  }

  if (!appointment.agoraChannelName) {
    appointment.agoraChannelName = `booking_${appointment._id.toString()}`;
    await appointment.save();
  }

  const channelName = appointment.agoraChannelName as string;
  const uidSource = isExpert ? appointment.expert._id.toString() : appointment.user._id.toString();
  const uid = deriveAgoraUid(uidSource);
  const role = RtcRole.PUBLISHER;
  const privilegeExpiredTs = Math.floor(Date.now() / 1000) + (ENV.AGORA_TOKEN_EXPIRY_SECONDS || 7200);

  const token = RtcTokenBuilder.buildTokenWithUid(
    ENV.AGORA_APP_ID,
    ENV.AGORA_APP_CERTIFICATE,
    channelName,
    uid,
    role,
    privilegeExpiredTs
  );

  res.status(200).json({
    success: true,
    data: {
      appId: ENV.AGORA_APP_ID,
      channelName,
      token,
      uid,
      role: 'host',
      expiresAt: privilegeExpiredTs * 1000
    }
  });
});

