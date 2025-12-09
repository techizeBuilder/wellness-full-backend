import { RtcRole, RtcTokenBuilder } from 'agora-access-token';
import mongoose from 'mongoose';
import ENV from '../config/environment';
import { asyncHandler } from '../middlewares/errorHandler';
import Appointment, { IAppointment } from '../models/Appointment';
import Expert from '../models/Expert';
import ExpertAvailability from '../models/ExpertAvailability';
import User from '../models/User';
import Plan from '../models/Plan';
import { deleteFile, getFilePath, getFileUrl } from '../middlewares/upload';
import logger from '../utils/logger';
import { sendBookingConfirmationEmail, sendBookingStatusUpdateEmail } from '../services/emailService';

type ParticipantDetails = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

type PopulatedAppointment = IAppointment & {
  user: ParticipantDetails;
  expert: ParticipantDetails;
};

const getSessionDateTimes = async (appointment: IAppointment) => {
  // For dynamic group sessions, fetch date/time from plan
  if ((appointment as any).isDynamicGroupSession && appointment.planId) {
    const Plan = (await import('../models/Plan')).default;
    const plan = await Plan.findById(appointment.planId);
    if (plan && plan.scheduledDate && plan.scheduledTime) {
      const sessionDate = new Date(plan.scheduledDate);
      const [startHour, startMin] = plan.scheduledTime.split(':').map(Number);
      const duration = plan.duration || appointment.duration || 60;
      const endTotalMinutes = startHour * 60 + startMin + duration;
      const endHour = Math.floor(endTotalMinutes / 60);
      const endMin = endTotalMinutes % 60;

      const startDateTime = new Date(sessionDate);
      startDateTime.setHours(startHour, startMin, 0, 0);

      const endDateTime = new Date(sessionDate);
      endDateTime.setHours(endHour, endMin, 0, 0);

      return { startDateTime, endDateTime };
    }
  }

  // For regular appointments, use stored date/time
  const sessionDate = new Date(appointment.sessionDate);
  const [startHour, startMin] = appointment.startTime.split(':').map(Number);
  const [endHour, endMin] = appointment.endTime.split(':').map(Number);

  const startDateTime = new Date(sessionDate);
  startDateTime.setHours(startHour, startMin, 0, 0);

  const endDateTime = new Date(sessionDate);
  endDateTime.setHours(endHour, endMin, 0, 0);

  return { startDateTime, endDateTime };
};

const buildDisplayName = (doc?: ParticipantDetails, fallback: string = 'Wellness Member') => {
  if (!doc) {
    return fallback;
  }

  const parts = [doc.firstName, doc.lastName].filter(Boolean);
  if (parts.length === 0) {
    return fallback;
  }

  return parts.join(' ');
};

export const notifyParticipantsOfBooking = async (appointment: PopulatedAppointment) => {
  try {
    const { startDateTime } = await getSessionDateTimes(appointment);
    const tasks: Array<{ label: 'user' | 'expert'; promise: Promise<unknown> }> = [];

    if (appointment.user?.email) {
      tasks.push({
        label: 'user',
        promise: sendBookingConfirmationEmail({
          email: appointment.user.email,
          participantName: appointment.user.firstName || buildDisplayName(appointment.user, 'there'),
          counterpartyName: buildDisplayName(appointment.expert, 'Your expert'),
          role: 'user',
          sessionDateTime: startDateTime,
          duration: appointment.duration,
          consultationMethod: appointment.consultationMethod,
          sessionType: appointment.sessionType,
          planName: appointment.planName,
          planSessionNumber: appointment.planSessionNumber,
          planTotalSessions: appointment.planTotalSessions,
          price: appointment.price,
          notes: appointment.notes
        })
      });
    }

    if (appointment.expert?.email) {
      tasks.push({
        label: 'expert',
        promise: sendBookingConfirmationEmail({
          email: appointment.expert.email,
          participantName: appointment.expert.firstName || buildDisplayName(appointment.expert, 'there'),
          counterpartyName: buildDisplayName(appointment.user, 'Your client'),
          role: 'expert',
          sessionDateTime: startDateTime,
          duration: appointment.duration,
          consultationMethod: appointment.consultationMethod,
          sessionType: appointment.sessionType,
          planName: appointment.planName,
          planSessionNumber: appointment.planSessionNumber,
          planTotalSessions: appointment.planTotalSessions,
          price: appointment.price,
          notes: appointment.notes
        })
      });
    }

    if (!tasks.length) {
      return;
    }

    const results = await Promise.allSettled(tasks.map(task => task.promise));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(
          `Failed to send booking confirmation email to ${tasks[index].label} for appointment ${appointment._id}`,
          result.reason
        );
      }
    });
  } catch (error) {
    logger.error(`Error while sending booking confirmation emails for appointment ${appointment._id}`, error);
  }
};

const notifyCustomerOfStatusChange = async (appointment: PopulatedAppointment, status: 'confirmed' | 'cancelled' | 'completed' | 'pending' | 'rejected') => {
  try {
    if (!appointment.user?.email) {
      return;
    }

    const { startDateTime } = await getSessionDateTimes(appointment);

    await sendBookingStatusUpdateEmail({
      email: appointment.user.email,
      firstName: appointment.user.firstName || buildDisplayName(appointment.user, 'there'),
      counterpartyName: buildDisplayName(appointment.expert, 'Your expert'),
      status,
      sessionDateTime: startDateTime,
      consultationMethod: appointment.consultationMethod,
      sessionType: appointment.sessionType,
      planName: appointment.planName || undefined
    });
  } catch (error) {
    logger.error(`Failed to send booking status email (${status}) for appointment ${appointment._id}`, error);
  }
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
    notes,
    planId,
    planType,
    planSessions
  } = req.body;

  if (!expertId) {
    return res.status(400).json({
      success: false,
      message: 'Expert ID is required'
    });
  }

  // Fetch expert and availability once for all validation flows
  const expert = await Expert.findById(expertId);
  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert not found'
    });
  }

  const availabilityDoc = await ExpertAvailability.findOne({ expert: expertId });

  type SlotInput = {
    sessionDate?: string;
    startTime?: string;
    duration?: number;
    consultationMethod?: string;
    sessionType?: string;
    skipAvailabilityCheck?: boolean; // Skip availability check for group sessions
  };

  const validateSlotInput = async (slotInput: SlotInput) => {
    const {
      sessionDate: slotDate,
      startTime: slotStart,
      duration: slotDuration,
      consultationMethod: slotMethod,
      sessionType: slotSessionType
    } = slotInput;

    if (!slotDate || !slotStart || !slotDuration || !slotMethod || !slotSessionType) {
      res.status(400).json({
      success: false,
        message: 'Please provide sessionDate, startTime, duration, consultationMethod, and sessionType for each session'
      });
      return null;
    }

    const validConsultationMethods = ['video', 'audio', 'chat', 'in-person'];
    if (!validConsultationMethods.includes(slotMethod)) {
      res.status(400).json({
      success: false,
        message: `Invalid consultation method. Must be one of: ${validConsultationMethods.join(', ')}`
      });
      return null;
    }

    // Ensure expert supports the consultation method
    if (expert.consultationMethods && expert.consultationMethods.length > 0) {
      if (!expert.consultationMethods.includes(slotMethod)) {
        res.status(400).json({
      success: false,
          message: `Expert does not offer ${slotMethod} consultations`
        });
        return null;
      }
    }

    const validSessionTypes = ['one-on-one', 'one-to-many'];
    if (!validSessionTypes.includes(slotSessionType)) {
      res.status(400).json({
        success: false,
        message: `Invalid session type. Must be one of: ${validSessionTypes.join(', ')}`
      });
      return null;
  }

  if (expert.sessionType && expert.sessionType.length > 0) {
      if (!expert.sessionType.includes(slotSessionType)) {
        res.status(400).json({
        success: false,
          message: `Expert does not offer ${slotSessionType} sessions`
        });
        return null;
      }
    }

    if (slotDuration < 30 || slotDuration > 240 || slotDuration % 30 !== 0) {
      res.status(400).json({
        success: false,
        message: 'Duration must be between 30 and 240 minutes and a multiple of 30'
      });
      return null;
    }

    const sessionDateTime = new Date(slotDate);
  if (isNaN(sessionDateTime.getTime())) {
      res.status(400).json({
      success: false,
      message: 'Invalid session date format'
    });
      return null;
  }

    const [startHour, startMin] = slotStart.split(':').map(Number);
    const endTotalMinutes = startHour * 60 + startMin + slotDuration;
  const endHour = Math.floor(endTotalMinutes / 60);
  const endMin = endTotalMinutes % 60;
  const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

  const startOfDay = new Date(sessionDateTime);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(sessionDateTime);
  endOfDay.setHours(23, 59, 59, 999);

  // For group sessions (one-to-many), skip conflict check - multiple customers can book the same session
  // For one-on-one sessions, check for conflicts with other one-on-one sessions only
  if (slotSessionType !== 'one-to-many') {
    const existingAppointments = await Appointment.find({
      expert: expertId,
      sessionDate: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      sessionType: 'one-on-one', // Only check conflicts with other one-on-one sessions
      status: { $in: ['pending', 'confirmed'] }
    }).select('startTime endTime');

    const conflictingAppointment = existingAppointments.find(apt => {
      const [aptStartHour, aptStartMin] = apt.startTime.split(':').map(Number);
      const [aptEndHour, aptEndMin] = apt.endTime.split(':').map(Number);
      const [reqStartHour, reqStartMin] = slotStart.split(':').map(Number);
      const [reqEndHour, reqEndMin] = endTime.split(':').map(Number);
      
      const aptStartTotal = aptStartHour * 60 + aptStartMin;
      const aptEndTotal = aptEndHour * 60 + aptEndMin;
      const reqStartTotal = reqStartHour * 60 + reqStartMin;
      const reqEndTotal = reqEndHour * 60 + reqEndMin;
      
      return (reqStartTotal < aptEndTotal && reqEndTotal > aptStartTotal);
    });

    if (conflictingAppointment) {
      res.status(400).json({
        success: false,
        message: 'This time slot is already booked. Please select another time.'
      });
      return null;
    }
  }

    // Skip availability check for group sessions (one-to-many) since expert has already decided the timing
    if (!slotInput.skipAvailabilityCheck && availabilityDoc) {
  const dayOfWeek = sessionDateTime.toLocaleDateString('en-US', { weekday: 'long' });
      const dayAvailability = availabilityDoc.availability.find(
      day => day.day === dayOfWeek
    );

    if (!dayAvailability || !dayAvailability.isOpen) {
        res.status(400).json({
        success: false,
        message: `Expert is not available on ${dayOfWeek}`
      });
        return null;
    }

    const isWithinRange = dayAvailability.timeRanges.some(range => {
        return slotStart >= range.startTime && endTime <= range.endTime;
    });

    if (!isWithinRange) {
        res.status(400).json({
        success: false,
        message: 'Requested time is outside expert\'s available hours'
      });
        return null;
      }
    }

    return { sessionDateTime, endTime };
  };

  // Handle plan-based bookings
  if (planId) {
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    if (plan.expert.toString() !== expertId) {
      return res.status(400).json({
        success: false,
        message: 'Plan does not belong to this expert'
      });
    }

    if (plan.isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'This plan is no longer active'
      });
    }

    const resolvedPlanType = plan.type as 'single' | 'monthly';
    if (planType && planType !== resolvedPlanType) {
      return res.status(400).json({
        success: false,
        message: 'Plan type mismatch'
      });
    }

    if (!planSessions || planSessions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide session details for the selected plan'
      });
    }

    const planInstanceId = new mongoose.Types.ObjectId().toString();

    if (resolvedPlanType === 'single') {
      const sessionPayload = planSessions[0];
      const finalDuration = sessionPayload.duration || plan.duration || 60;

      // Skip availability check for group sessions (one-to-many) since expert has already decided the timing
      const isGroupSession = plan.sessionFormat === 'one-to-many';

      const validatedSlot = await validateSlotInput({
        sessionDate: sessionPayload.sessionDate,
        startTime: sessionPayload.startTime,
        duration: finalDuration,
        consultationMethod: sessionPayload.consultationMethod,
        sessionType: sessionPayload.sessionType,
        skipAvailabilityCheck: isGroupSession
      });

      if (!validatedSlot) {
        return;
      }

      if (plan.sessionFormat && plan.sessionFormat !== sessionPayload.sessionType) {
        return res.status(400).json({
          success: false,
          message: `Plan requires ${plan.sessionFormat} sessions`
        });
      }

      // For group sessions, check if user already has a booking for this plan
      if (isGroupSession) {
        const existingGroupBooking = await Appointment.findOne({
          user: currentUser._id,
          planId: plan._id,
          isDynamicGroupSession: true,
          status: { $in: ['pending', 'confirmed'] }
        });

        if (existingGroupBooking) {
          return res.status(400).json({
            success: false,
            message: 'You have already booked this group session. You cannot book the same session twice.'
          });
        }
      }

      const price = plan.price ?? Math.round(((expert.hourlyRate || 0) * finalDuration) / 60);

      // For dynamic group sessions (single type, one-to-many), don't store fixed date/time
      // Date/time will be fetched dynamically from the plan
      const isDynamicGroupSession = isGroupSession && plan.type === 'single';
      
      const appointment = await Appointment.create({
        user: currentUser._id,
        expert: expertId,
        // For dynamic group sessions, don't store fixed date/time - fetch from plan dynamically
        sessionDate: isDynamicGroupSession ? undefined : validatedSlot.sessionDateTime,
        startTime: isDynamicGroupSession ? undefined : sessionPayload.startTime,
        endTime: isDynamicGroupSession ? undefined : validatedSlot.endTime,
        duration: finalDuration,
        consultationMethod: sessionPayload.consultationMethod,
        sessionType: sessionPayload.sessionType,
        price,
        notes: notes || undefined,
        status: 'pending',
        paymentStatus: price > 0 ? 'pending' : undefined, // Set payment status if payment is required
        planId: plan._id,
        planType: resolvedPlanType,
        planInstanceId,
        planName: plan.name,
        planSessionNumber: 1,
        planTotalSessions: 1,
        planPrice: price,
        isDynamicGroupSession: isDynamicGroupSession
      } as any);

      await appointment.populate('user', 'firstName lastName email');
      await appointment.populate('expert', 'firstName lastName specialization profileImage email');
      
      // Only send emails if payment is not required (price is 0 or free)
      // For paid bookings, emails will be sent after payment is verified
      if (price <= 0) {
        await notifyParticipantsOfBooking(appointment as PopulatedAppointment);
      }

      return res.status(201).json({
        success: true,
        data: {
          planInstanceId,
          appointment
        },
        message: 'Plan booking created successfully. Waiting for expert confirmation.'
      });
    }

    // Monthly subscription flow
    if (!plan.classesPerMonth || !plan.monthlyPrice) {
      return res.status(400).json({
        success: false,
        message: 'Monthly plans must define classes per month and monthly price'
      });
    }

    if (planSessions.length !== plan.classesPerMonth) {
      return res.status(400).json({
        success: false,
        message: `Please schedule ${plan.classesPerMonth} classes for this subscription`
      });
    }

    // Ensure user is not scheduling duplicate slots within the same plan booking
    const uniqueKeys = new Set<string>();
    for (const sessionPayload of planSessions) {
      const key = `${sessionPayload.sessionDate}|${sessionPayload.startTime}`;
      if (uniqueKeys.has(key)) {
        return res.status(400).json({
          success: false,
          message: 'Each session in the subscription must have a unique date and start time'
        });
      }
      uniqueKeys.add(key);
    }

    const perSessionPrice = Math.round((plan.monthlyPrice / plan.classesPerMonth) * 100) / 100;
    const createdAppointments: IAppointment[] = [];

    // Skip availability check for group sessions (one-to-many) since expert has already decided the timing
    const isGroupSession = plan.sessionFormat === 'one-to-many';

    for (let i = 0; i < planSessions.length; i++) {
      const sessionPayload = planSessions[i];
      const finalDuration = sessionPayload.duration || plan.duration || 60;

      const validatedSlot = await validateSlotInput({
        sessionDate: sessionPayload.sessionDate,
        startTime: sessionPayload.startTime,
        duration: finalDuration,
        consultationMethod: sessionPayload.consultationMethod,
        sessionType: sessionPayload.sessionType,
        skipAvailabilityCheck: isGroupSession
      });

      if (!validatedSlot) {
        return;
      }

      if (plan.sessionFormat && plan.sessionFormat !== sessionPayload.sessionType) {
        return res.status(400).json({
          success: false,
          message: `Plan requires ${plan.sessionFormat} sessions`
        });
      }

      const appointment = await Appointment.create({
        user: currentUser._id,
        expert: expertId,
        sessionDate: validatedSlot.sessionDateTime,
        startTime: sessionPayload.startTime,
        endTime: validatedSlot.endTime,
        duration: finalDuration,
        consultationMethod: sessionPayload.consultationMethod,
        sessionType: sessionPayload.sessionType,
        price: perSessionPrice,
        notes: notes || undefined,
        status: 'pending',
        paymentStatus: perSessionPrice > 0 ? 'pending' : undefined, // Set payment status if payment is required
        planId: plan._id,
        planType: resolvedPlanType,
        planInstanceId,
        planName: plan.name,
        planSessionNumber: i + 1,
        planTotalSessions: plan.classesPerMonth,
        planPrice: perSessionPrice
      });

      createdAppointments.push(appointment);
    }

    // Only send emails if payment is not required (price is 0 or free)
    // For paid bookings, emails will be sent after payment is verified
    const totalPrice = plan.monthlyPrice || 0;
    if (totalPrice <= 0) {
      await Promise.all(
        createdAppointments.map(async appointment => {
          await appointment.populate('user', 'firstName lastName email');
          await appointment.populate('expert', 'firstName lastName specialization profileImage email');
          await notifyParticipantsOfBooking(appointment as PopulatedAppointment);
        })
      );
    } else {
      // Just populate for later use, but don't send emails yet
      await Promise.all(
        createdAppointments.map(async appointment => {
          await appointment.populate('user', 'firstName lastName email');
          await appointment.populate('expert', 'firstName lastName specialization profileImage email');
        })
      );
    }

    // Create UserSubscription record for monthly plans
    const UserSubscription = (await import('../models/UserSubscription')).default;
    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 month from now
    const nextBillingDate = new Date(expiryDate);

    await UserSubscription.create({
      user: currentUser._id,
      expert: expertId,
      plan: plan._id,
      planInstanceId,
      planName: plan.name,
      planType: 'monthly',
      startDate,
      expiryDate,
      nextBillingDate,
      totalSessions: plan.classesPerMonth,
      sessionsUsed: 0,
      sessionsRemaining: plan.classesPerMonth,
      monthlyPrice: plan.monthlyPrice,
      status: 'active',
      autoRenewal: true
    });

    return res.status(201).json({
      success: true,
      data: {
        planInstanceId,
        totalPrice: plan.monthlyPrice,
        totalSessions: plan.classesPerMonth,
        appointments: createdAppointments
      },
      message: 'Subscription booking created successfully. Waiting for expert confirmation.'
    });
  }

  // Validation for single ad-hoc bookings (no plan)
  if (!sessionDate || !startTime || !duration || !consultationMethod || !sessionType) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields: expertId, sessionDate, startTime, duration, consultationMethod, sessionType'
    });
  }
  const singleSlot = await validateSlotInput({
    sessionDate,
    startTime,
    duration,
    consultationMethod,
    sessionType
  });

  if (!singleSlot) {
    return;
  }

  // Calculate price (based on hourly rate and duration)
  const hourlyRate = expert.hourlyRate || 0;
  const price = Math.round((hourlyRate * duration) / 60);

  // Create appointment
  const appointment = await Appointment.create({
    user: currentUser._id,
    expert: expertId,
    sessionDate: singleSlot.sessionDateTime,
    startTime,
    endTime: singleSlot.endTime,
    duration,
    consultationMethod,
    sessionType,
    price,
    notes: notes || undefined,
    status: 'pending',
    paymentStatus: price > 0 ? 'pending' : undefined // Set payment status if payment is required
  });

  // Populate user and expert details
  await appointment.populate('user', 'firstName lastName email');
  await appointment.populate('expert', 'firstName lastName specialization profileImage email');
  
  // Only send emails if payment is not required (price is 0 or free)
  // For paid bookings, emails will be sent after payment is verified
  if (price <= 0) {
    await notifyParticipantsOfBooking(appointment as PopulatedAppointment);
  }

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
    .populate('planId', 'scheduledDate scheduledTime duration sessionFormat')
    .sort({ sessionDate: 1, startTime: 1 })
    .skip(skip)
    .limit(limitNum);

  // For dynamic group sessions, populate date/time from plan
  const appointmentsWithDynamicData = appointments.map((apt: any) => {
    if (apt.isDynamicGroupSession && apt.planId) {
      const plan = apt.planId;
      if (plan.scheduledDate && plan.scheduledTime) {
        // Calculate endTime from startTime and duration
        const [startHour, startMin] = plan.scheduledTime.split(':').map(Number);
        const duration = plan.duration || apt.duration || 60;
        const endTotalMinutes = startHour * 60 + startMin + duration;
        const endHour = Math.floor(endTotalMinutes / 60);
        const endMin = endTotalMinutes % 60;
        const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
        
        apt.sessionDate = plan.scheduledDate;
        apt.startTime = plan.scheduledTime;
        apt.endTime = endTime;
        if (plan.duration) {
          apt.duration = plan.duration;
        }
      }
    }
    return apt;
  });

  const total = await Appointment.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      appointments: appointmentsWithDynamicData,
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
    .populate('planId', 'scheduledDate scheduledTime duration sessionFormat')
    .sort({ sessionDate: 1, startTime: 1 })
    .skip(skip)
    .limit(limitNum);

  // For dynamic group sessions, populate date/time from plan
  const appointmentsWithDynamicData = appointments.map((apt: any) => {
    if (apt.isDynamicGroupSession && apt.planId) {
      const plan = apt.planId;
      if (plan.scheduledDate && plan.scheduledTime) {
        // Calculate endTime from startTime and duration
        const [startHour, startMin] = plan.scheduledTime.split(':').map(Number);
        const duration = plan.duration || apt.duration || 60;
        const endTotalMinutes = startHour * 60 + startMin + duration;
        const endHour = Math.floor(endTotalMinutes / 60);
        const endMin = endTotalMinutes % 60;
        const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
        
        apt.sessionDate = plan.scheduledDate;
        apt.startTime = plan.scheduledTime;
        apt.endTime = endTime;
        if (plan.duration) {
          apt.duration = plan.duration;
        }
      }
    }
    return apt;
  });

  const total = await Appointment.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      appointments: appointmentsWithDynamicData,
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

  if (status === 'confirmed' && (isUser || isExpert)) {
    await notifyCustomerOfStatusChange(appointment as PopulatedAppointment, 'confirmed');
  }

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

  // Check if this is a group session - prevent rescheduling group sessions
  let isGroupSession = appointment.sessionType === 'one-to-many';
  
  // Also check if the appointment is part of a group session plan
  if (!isGroupSession && appointment.planId) {
    const plan = await Plan.findById(appointment.planId);
    if (plan && plan.sessionFormat === 'one-to-many') {
      isGroupSession = true;
    }
  }

  // Prevent rescheduling group sessions - they are scheduled by the expert for all participants
  if (isGroupSession) {
    return res.status(400).json({
      success: false,
      message: 'Group sessions cannot be rescheduled. Please contact the expert if you need to change the session time.'
    });
  }

  // Check for time slot conflicts (excluding the current appointment)
  // Only check conflicts with one-on-one sessions
  const existingAppointments = await Appointment.find({
    expert: appointment.expert,
    sessionDate: newSessionDate,
    sessionType: 'one-on-one', // Only check conflicts with other one-on-one sessions
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

  // Skip availability check for group sessions since expert has already decided the timing
  if (!isGroupSession) {
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

  const appointment = await Appointment.findById(id)
    .populate('user', 'firstName lastName email')
    .populate('expert', 'firstName lastName email')
    .populate('planId', 'scheduledDate scheduledTime duration sessionFormat');

  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found'
    });
  }

  const isVideoCall = appointment.consultationMethod === 'video';
  const isAudioCall = appointment.consultationMethod === 'audio';

  if (!isVideoCall && !isAudioCall) {
    return res.status(400).json({
      success: false,
      message: 'Realtime calling is only available for audio or video consultation bookings'
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

  const { startDateTime, endDateTime } = await getSessionDateTimes(appointment);
  const joinWindowMinutes = Math.min(Math.max(ENV.AGORA_JOIN_WINDOW_MINUTES || 2, 0), 2);
  const joinWindowMillis = joinWindowMinutes * 60 * 1000;
  const now = new Date();
  const nowTime = now.getTime();
  const startTime = startDateTime.getTime();
  const endTime = endDateTime.getTime();

  // Check if session has ended
  if (nowTime > endTime) {
    return res.status(400).json({
      success: false,
      message: 'This session has already ended'
    });
  }

  // Allow joining if session has already started (regardless of join window)
  if (nowTime >= startTime) {
    // Session has started - allow joining
  } else {
    // Session hasn't started yet - check if within join window
    const earliestJoinTime = startTime - joinWindowMillis;
    if (nowTime < earliestJoinTime) {
      return res.status(400).json({
        success: false,
        message: `You can join this session ${joinWindowMinutes} minutes before the scheduled start time`
      });
    }
  }

  // Ensure agoraChannelName is set, and for group sessions, ensure shared channel
  if (!appointment.agoraChannelName) {
    if (appointment.sessionType === 'one-to-many') {
      // For group sessions, use shared channel
      const groupSessionId = (appointment as any).groupSessionId;
      const isDynamicGroupSession = (appointment as any).isDynamicGroupSession;
      
      if (groupSessionId) {
        // Monthly group session created by expert
        appointment.agoraChannelName = `group_${groupSessionId}`;
        // Update all appointments in this group to use the same channel
        await Appointment.updateMany(
          { groupSessionId: groupSessionId },
          { agoraChannelName: appointment.agoraChannelName }
        );
      } else if (appointment.planId && isDynamicGroupSession) {
        // Dynamic group session plan - use planId only (not date/time since it can change)
        appointment.agoraChannelName = `group_plan_${appointment.planId.toString()}`;
        // Update all appointments for this plan to use the same channel
        await Appointment.updateMany(
          {
            planId: appointment.planId,
            isDynamicGroupSession: true,
            sessionType: 'one-to-many'
          },
          { agoraChannelName: appointment.agoraChannelName }
        );
      } else if (appointment.planId) {
        // Legacy: Single group session plan with fixed date/time
        const sessionDate = new Date(appointment.sessionDate);
        const dateStr = sessionDate.toISOString().split('T')[0].replace(/-/g, '');
        const timeStr = appointment.startTime?.replace(':', '') || '';
        appointment.agoraChannelName = `group_plan_${appointment.planId.toString()}_${dateStr}_${timeStr}`;
        // Update all appointments for this plan/date/time to use the same channel
        const startOfDay = new Date(sessionDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(sessionDate);
        endOfDay.setHours(23, 59, 59, 999);
        await Appointment.updateMany(
          {
            planId: appointment.planId,
            sessionDate: { $gte: startOfDay, $lte: endOfDay },
            startTime: appointment.startTime,
            sessionType: 'one-to-many'
          },
          { agoraChannelName: appointment.agoraChannelName }
        );
      } else {
        appointment.agoraChannelName = `booking_${appointment._id.toString()}`;
      }
    } else {
      appointment.agoraChannelName = `booking_${appointment._id.toString()}`;
    }
    await appointment.save();
  } else if (appointment.sessionType === 'one-to-many') {
    // If channel name exists but this is a group session, ensure all participants use the same channel
    const groupSessionId = (appointment as any).groupSessionId;
    const isDynamicGroupSession = (appointment as any).isDynamicGroupSession;
    
    if (groupSessionId) {
      // Update all appointments in this group to use the same channel
      await Appointment.updateMany(
        { groupSessionId: groupSessionId },
        { agoraChannelName: appointment.agoraChannelName }
      );
    } else if (appointment.planId && isDynamicGroupSession) {
      // For dynamic group sessions, ensure all appointments for same plan use same channel
      await Appointment.updateMany(
        {
          planId: appointment.planId,
          isDynamicGroupSession: true,
          sessionType: 'one-to-many'
        },
        { agoraChannelName: appointment.agoraChannelName }
      );
    } else if (appointment.planId) {
      // Legacy: For single group session plans with fixed date/time, ensure all appointments for same plan/date/time use same channel
      const sessionDate = new Date(appointment.sessionDate);
      const startOfDay = new Date(sessionDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(sessionDate);
      endOfDay.setHours(23, 59, 59, 999);
      await Appointment.updateMany(
        {
          planId: appointment.planId,
          sessionDate: { $gte: startOfDay, $lte: endOfDay },
          startTime: appointment.startTime,
          sessionType: 'one-to-many'
        },
        { agoraChannelName: appointment.agoraChannelName }
      );
    }
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
      expiresAt: privilegeExpiredTs * 1000,
      mediaType: isAudioCall ? 'audio' : 'video'
    }
  });
});

// @desc    Submit feedback for a completed booking
// @route   POST /api/bookings/:id/feedback
// @access  Private (User)
export const submitFeedback = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { id } = req.params;
  const { rating, comment } = req.body || {};

  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  const parsedRating = Number(rating);
  if (!parsedRating || Number.isNaN(parsedRating)) {
    return res.status(400).json({
      success: false,
      message: 'Rating is required'
    });
  }

  if (parsedRating < 1 || parsedRating > 5) {
    return res.status(400).json({
      success: false,
      message: 'Rating must be between 1 and 5'
    });
  }

  const appointment = await Appointment.findById(id).populate('expert', 'firstName lastName specialization profileImage');
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found'
    });
  }

  if (appointment.user.toString() !== currentUser._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to review this appointment'
    });
  }

  if (appointment.status !== 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Feedback can only be submitted after the session is completed'
    });
  }

  const trimmedComment = typeof comment === 'string' ? comment.trim() : undefined;
  if (trimmedComment && trimmedComment.length > 1000) {
    return res.status(400).json({
      success: false,
      message: 'Feedback cannot exceed 1000 characters'
    });
  }

  const previousRating = typeof appointment.feedbackRating === 'number'
    ? appointment.feedbackRating
    : null;

  appointment.feedbackRating = parsedRating;
  appointment.feedbackComment = trimmedComment || undefined;
  appointment.feedbackSubmittedAt = new Date();
  await appointment.save();

  const expertId = (appointment.expert as any)?._id || appointment.expert;
  if (expertId) {
    const expert = await Expert.findById(expertId);
    if (expert) {
      const currentAverage = expert.rating?.average || 0;
      const currentCount = expert.rating?.count || 0;
      let totalScore = currentAverage * currentCount;
      let newCount = currentCount;

      if (typeof previousRating === 'number') {
        totalScore = totalScore - previousRating + parsedRating;
      } else {
        totalScore += parsedRating;
        newCount = currentCount + 1;
      }

      const newAverage = newCount > 0 ? totalScore / newCount : 0;
      expert.rating = {
        average: Number(newAverage.toFixed(2)),
        count: newCount
      };

      await expert.save();
    }
  }

  res.status(200).json({
    success: true,
    data: {
      appointment
    },
    message: 'Feedback submitted successfully'
  });
});

// @desc    Upload or replace prescription PDF for an appointment
// @route   POST /api/bookings/:id/prescription
// @access  Private (Expert)
export const uploadPrescription = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { id } = req.params;

  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  const appointment = await Appointment.findById(id);
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found'
    });
  }

  const userId = currentUser._id.toString();
  const userEmail = currentUser.email || (currentUser as any).email;

  let expertRecord = await Expert.findById(userId).select('_id');
  if (!expertRecord && userEmail) {
    expertRecord = await Expert.findOne({ email: userEmail.toLowerCase() }).select('_id');
  }

  if (!expertRecord || appointment.expert.toString() !== expertRecord._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to upload a prescription for this appointment'
    });
  }

  if (appointment.status !== 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Prescriptions can only be uploaded after the session is completed'
    });
  }

  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    return res.status(400).json({
      success: false,
      message: 'Prescription PDF is required'
    });
  }

  if (!file.mimetype.includes('pdf')) {
    return res.status(400).json({
      success: false,
      message: 'Only PDF files are allowed'
    });
  }

  if (appointment.prescription?.fileName) {
    const currentFilePath = getFilePath(appointment.prescription.fileName, 'prescriptions');
    if (currentFilePath) {
      deleteFile(currentFilePath);
    }
  }

  appointment.prescription = {
    fileName: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    url: getFileUrl(file.filename, 'prescriptions') || '',
    uploadedAt: new Date()
  };

  await appointment.save();

  res.status(200).json({
    success: true,
    data: {
      prescription: appointment.prescription
    },
    message: 'Prescription uploaded successfully'
  });
});

// @desc    Get user details by ID (for experts viewing their patients)
// @route   GET /api/bookings/user/:userId/details
// @access  Private (Expert)
export const getUserDetailsForExpert = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { userId } = req.params;

  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  // Verify that the current user is an expert
  const expertId = currentUser._id.toString();
  const expert = await Expert.findById(expertId).select('_id');
  
  if (!expert) {
    return res.status(403).json({
      success: false,
      message: 'Only experts can access patient details'
    });
  }

  // Verify that this user has an appointment with the expert
  const hasAppointment = await Appointment.findOne({
    expert: expertId,
    user: userId
  });

  if (!hasAppointment) {
    return res.status(403).json({
      success: false,
      message: 'You can only view details of users who have appointments with you'
    });
  }

  // Fetch user details including health information
  const user = await User.findById(userId).select(
    '-password -resetPasswordToken -resetPasswordExpire -otpCode -otpExpire -loginAttempts -lockUntil'
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      user: user.toObject()
    }
  });
});

