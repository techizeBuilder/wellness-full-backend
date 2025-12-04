import { asyncHandler } from '../middlewares/errorHandler';
import UserSubscription from '../models/UserSubscription';
import Appointment from '../models/Appointment';
import Plan from '../models/Plan';
import Expert from '../models/Expert';
import User from '../models/User';
import logger from '../utils/logger';

// @desc    Get user's active subscriptions
// @route   GET /api/subscriptions/my-subscriptions
// @access  Private (User)
export const getMySubscriptions = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  
  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  // Get all active subscriptions for the user
  const subscriptions = await UserSubscription.find({
    user: currentUser._id,
    status: 'active'
  })
    .populate('expert', 'firstName lastName specialization profileImage')
    .populate('plan', 'name type description classesPerMonth monthlyPrice duration')
    .sort({ createdAt: -1 });

  // Calculate actual sessions remaining from appointments
  const subscriptionsWithDetails = await Promise.all(
    subscriptions.map(async (subscription) => {
      // Count completed/confirmed appointments for this planInstanceId
      const appointments = await Appointment.find({
        planInstanceId: subscription.planInstanceId,
        user: currentUser._id
      });

      const completedSessions = appointments.filter(
        apt => apt.status === 'completed' || apt.status === 'confirmed'
      ).length;

      const remainingSessions = subscription.totalSessions - completedSessions;

      return {
        _id: subscription._id,
        planName: subscription.planName,
        planType: subscription.planType,
        expert: {
          _id: subscription.expert._id,
          name: `${(subscription.expert as any).firstName} ${(subscription.expert as any).lastName}`,
          specialization: (subscription.expert as any).specialization,
          profileImage: (subscription.expert as any).profileImage
        },
        startDate: subscription.startDate,
        expiryDate: subscription.expiryDate,
        nextBillingDate: subscription.nextBillingDate,
        totalSessions: subscription.totalSessions,
        sessionsUsed: completedSessions,
        sessionsRemaining: Math.max(0, remainingSessions),
        monthlyPrice: subscription.monthlyPrice,
        autoRenewal: subscription.autoRenewal,
        planInstanceId: subscription.planInstanceId,
        plan: subscription.plan
      };
    })
  );

  res.status(200).json({
    success: true,
    data: {
      subscriptions: subscriptionsWithDetails,
      count: subscriptionsWithDetails.length
    }
  });
});

// @desc    Cancel a subscription
// @route   POST /api/subscriptions/:id/cancel
// @access  Private (User)
export const cancelSubscription = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { id } = req.params;
  const { reason } = req.body;

  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  // Find the subscription
  const subscription = await UserSubscription.findOne({
    _id: id,
    user: currentUser._id
  });

  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Subscription not found'
    });
  }

  if (subscription.status !== 'active') {
    return res.status(400).json({
      success: false,
      message: `Subscription is already ${subscription.status}`
    });
  }

  // Cancel the subscription
  await (subscription as any).cancel('user', reason);

  // Optionally cancel future appointments (pending/confirmed ones)
  const futureAppointments = await Appointment.find({
    planInstanceId: subscription.planInstanceId,
    user: currentUser._id,
    status: { $in: ['pending', 'confirmed'] },
    sessionDate: { $gte: new Date() }
  });

  if (futureAppointments.length > 0) {
    await Appointment.updateMany(
      {
        _id: { $in: futureAppointments.map(apt => apt._id) }
      },
      {
        $set: {
          status: 'cancelled',
          cancelledBy: 'user',
          cancellationReason: reason || 'Subscription cancelled'
        }
      }
    );
  }

  res.status(200).json({
    success: true,
    message: 'Subscription cancelled successfully',
    data: {
      subscription: {
        _id: subscription._id,
        status: subscription.status,
        cancelledAt: subscription.cancelledAt
      }
    }
  });
});

// @desc    Get subscription details by ID
// @route   GET /api/subscriptions/:id
// @access  Private (User)
export const getSubscriptionById = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { id } = req.params;

  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  const subscription = await UserSubscription.findOne({
    _id: id,
    user: currentUser._id
  })
    .populate('expert', 'firstName lastName specialization profileImage email')
    .populate('plan', 'name type description classesPerMonth monthlyPrice duration sessionClassType');

  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Subscription not found'
    });
  }

  // Get all appointments for this subscription
  const appointments = await Appointment.find({
    planInstanceId: subscription.planInstanceId,
    user: currentUser._id
  })
    .sort({ sessionDate: 1 });

  const completedSessions = appointments.filter(
    apt => apt.status === 'completed' || apt.status === 'confirmed'
  ).length;

  const remainingSessions = subscription.totalSessions - completedSessions;

  res.status(200).json({
    success: true,
    data: {
      subscription: {
        ...subscription.toObject(),
        sessionsUsed: completedSessions,
        sessionsRemaining: Math.max(0, remainingSessions),
        appointments: appointments.map(apt => ({
          _id: apt._id,
          sessionDate: apt.sessionDate,
          startTime: apt.startTime,
          duration: apt.duration,
          status: apt.status,
          consultationMethod: apt.consultationMethod,
          sessionType: apt.sessionType
        }))
      }
    }
  });
});

// @desc    Get expert's subscription statistics
// @route   GET /api/subscriptions/expert/stats
// @access  Private (Expert)
export const getExpertSubscriptionStats = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  
  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  // Verify user is an expert
  const expert = await Expert.findById(currentUser._id);
  if (!expert) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Expert account required.'
    });
  }

  // Get all active subscriptions for this expert
  const activeSubscriptions = await UserSubscription.find({
    expert: currentUser._id,
    status: 'active'
  })
    .populate('user', 'firstName lastName')
    .populate('plan', 'name type');

  // Group by specialization/category (we'll use expert's specialization)
  const category = expert.specialization || 'General';

  // Calculate total subscribers
  const uniqueUsers = new Set(activeSubscriptions.map(sub => sub.user._id.toString()));
  const totalSubscribers = uniqueUsers.size;

  // Calculate total sessions remaining across all subscriptions
  let totalSessionsRemaining = 0;
  for (const subscription of activeSubscriptions) {
    const appointments = await Appointment.find({
      planInstanceId: subscription.planInstanceId,
      user: subscription.user._id
    });

    const completedSessions = appointments.filter(
      apt => apt.status === 'completed' || apt.status === 'confirmed'
    ).length;

    const remaining = subscription.totalSessions - completedSessions;
    totalSessionsRemaining += Math.max(0, remaining);
  }

  // Get the earliest renewal date
  const renewalDates = activeSubscriptions
    .map(sub => sub.nextBillingDate || sub.expiryDate)
    .filter(date => date)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const nextRenewalDate = renewalDates.length > 0 
    ? renewalDates[0] 
    : null;

  res.status(200).json({
    success: true,
    data: {
      category,
      subscribers: totalSubscribers,
      sessionsLeft: totalSessionsRemaining,
      renewalDate: nextRenewalDate ? new Date(nextRenewalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A',
      subscriptions: activeSubscriptions.map(sub => ({
        _id: sub._id,
        planName: sub.planName,
        userName: `${(sub.user as any).firstName} ${(sub.user as any).lastName}`,
        totalSessions: sub.totalSessions,
        sessionsRemaining: sub.sessionsRemaining,
        expiryDate: sub.expiryDate,
        nextBillingDate: sub.nextBillingDate
      }))
    }
  });
});

