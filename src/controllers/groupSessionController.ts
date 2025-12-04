import mongoose from 'mongoose';
import { asyncHandler } from '../middlewares/errorHandler';
import Plan from '../models/Plan';
import UserSubscription from '../models/UserSubscription';
import Appointment, { IAppointment } from '../models/Appointment';
import Expert from '../models/Expert';

/**
 * @desc    Expert schedules a one-to-many group session for a monthly plan.
 *          Creates one appointment per active subscriber.
 * @route   POST /api/bookings/expert/group-session
 * @access  Private (Expert)
 */
export const createGroupSessionForPlan = asyncHandler(async (req, res) => {
  const currentUser = req.user;

  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  const expertId = currentUser._id.toString();
  const {
    planId,
    sessionDate,
    startTime,
    duration,
    consultationMethod,
    notes
  } = req.body as {
    planId?: string;
    sessionDate?: string;
    startTime?: string;
    duration?: number;
    consultationMethod?: string;
    notes?: string;
  };

  if (!planId || !sessionDate || !startTime || !duration || !consultationMethod) {
    return res.status(400).json({
      success: false,
      message:
        'Please provide planId, sessionDate, startTime, duration, and consultationMethod'
    });
  }

  const plan = await Plan.findById(planId);
  if (!plan) {
    return res.status(404).json({
      success: false,
      message: 'Plan not found'
    });
  }

  if (plan.expert.toString() !== expertId) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to schedule sessions for this plan'
    });
  }

  if (plan.type !== 'monthly') {
    return res.status(400).json({
      success: false,
      message: 'Group sessions are currently supported only for monthly plans'
    });
  }

  if (plan.sessionFormat !== 'one-to-many') {
    return res.status(400).json({
      success: false,
      message: 'This plan is not configured as a one-to-many (group) plan'
    });
  }

  const validConsultationMethods = ['video', 'audio', 'chat', 'in-person'];
  if (!validConsultationMethods.includes(consultationMethod)) {
    return res.status(400).json({
      success: false,
      message: `Invalid consultation method. Must be one of: ${validConsultationMethods.join(', ')}`
    });
  }

  const expert = await Expert.findById(expertId);
  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert profile not found'
    });
  }

  if (
    expert.consultationMethods &&
    expert.consultationMethods.length > 0 &&
    !expert.consultationMethods.includes(consultationMethod)
  ) {
    return res.status(400).json({
      success: false,
      message: `Expert does not offer ${consultationMethod} consultations`
    });
  }

  // Compute endTime string (HH:MM) based on duration and startTime
  const [startHour, startMin] = startTime.split(':').map(Number);
  const endTotalMinutes = startHour * 60 + startMin + duration;
  const endHour = Math.floor(endTotalMinutes / 60);
  const endMin = endTotalMinutes % 60;
  const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

  const sessionDateTime = new Date(sessionDate);
  if (isNaN(sessionDateTime.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid session date format'
    });
  }

  // Fetch all active subscribers for this plan with remaining sessions
  const subscriptions = await UserSubscription.find({
    expert: expertId,
    plan: plan._id,
    status: 'active',
    sessionsRemaining: { $gt: 0 },
    startDate: { $lte: sessionDateTime },
    expiryDate: { $gte: sessionDateTime }
  }).select('user planInstanceId');

  if (subscriptions.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No active subscribers found for this plan at the selected time'
    });
  }

  // Use a new groupSessionId to link all appointments created for this group session
  const groupSessionId = new mongoose.Types.ObjectId().toString();
  
  // Create shared channel name for all participants in this group session
  const sharedChannelName = `group_${groupSessionId}`;

  const pricePerSession =
    plan.monthlyPrice && plan.classesPerMonth
      ? Math.round((plan.monthlyPrice / plan.classesPerMonth) * 100) / 100
      : 0;

  const createdAppointments: IAppointment[] = [];

  for (const subscription of subscriptions) {
    const appointment = await Appointment.create({
      user: subscription.user,
      expert: expertId,
      sessionDate: sessionDateTime,
      startTime,
      endTime,
      duration,
      consultationMethod,
      sessionType: 'one-to-many',
      price: pricePerSession,
      notes: notes || undefined,
      status: 'confirmed',
      paymentStatus: pricePerSession > 0 ? 'paid' : undefined,
      planId: plan._id,
      planType: plan.type,
      planInstanceId: subscription.planInstanceId,
      planName: plan.name,
      planSessionNumber: undefined,
      planTotalSessions: plan.classesPerMonth,
      planPrice: pricePerSession,
      // Set shared channel name for group sessions
      agoraChannelName: (consultationMethod === 'video' || consultationMethod === 'audio') ? sharedChannelName : undefined,
      // Extra field to logically group the session across users
      groupSessionId
    } as any);

    createdAppointments.push(appointment);
  }

  return res.status(201).json({
    success: true,
    message: `Group session scheduled for ${subscriptions.length} active subscribers`,
    data: {
      groupSessionId,
      appointmentsCreated: createdAppointments.length
    }
  });
});


