import { asyncHandler } from '../middlewares/errorHandler';
import Payment from '../models/Payment';
import Appointment from '../models/Appointment';
import UserSubscription from '../models/UserSubscription';
import Plan from '../models/Plan';
import Expert from '../models/Expert';
import Admin from '../models/Admin';
import { createOrder, verifyPaymentSignature, verifyWebhookSignature, fetchPaymentDetails } from '../services/razorpayService';
import { notifyParticipantsOfBooking } from './bookingController';
import notificationService from '../services/notificationService';
import pushNotificationService from '../services/pushNotificationService';
import ENV from '../config/environment';
import logger from '../utils/logger';

// @desc    Create a payment order
// @route   POST /api/payments/create-order
// @access  Private (User)
export const createPaymentOrder = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { amount, currency = 'INR', appointmentId, subscriptionId, planId, description } = req.body;

  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid amount is required'
    });
  }

  // Validate that either appointmentId or subscriptionId is provided
  if (!appointmentId && !subscriptionId && !planId) {
    return res.status(400).json({
      success: false,
      message: 'Either appointmentId, subscriptionId, or planId is required'
    });
  }

  let expertId;
  let paymentDescription = description;

  // If appointmentId is provided, validate it
  if (appointmentId) {
    const appointment = await Appointment.findById(appointmentId)
      .populate('expert', '_id');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.user.toString() !== currentUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to pay for this appointment'
      });
    }

    expertId = (appointment.expert as any)._id;
    if (!paymentDescription) {
      paymentDescription = `Payment for appointment ${appointmentId}`;
    }
  }

  // If subscriptionId is provided, validate it
  if (subscriptionId) {
    const subscription = await UserSubscription.findById(subscriptionId);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    if (subscription.user.toString() !== currentUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to pay for this subscription'
      });
    }

    expertId = subscription.expert;
    if (!paymentDescription) {
      paymentDescription = `Payment for subscription ${subscription.planName}`;
    }
  }

  // If planId is provided, validate it
  if (planId) {
    const plan = await Plan.findById(planId).populate('expert', '_id');
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    expertId = (plan.expert as any)._id;
    if (!paymentDescription) {
      paymentDescription = `Payment for plan ${plan.name}`;
    }
  }

  // Check if Razorpay is configured
  if (!ENV.RAZORPAY_KEY_ID || !ENV.RAZORPAY_KEY_SECRET) {
    logger.error('Razorpay credentials not configured');
    return res.status(500).json({
      success: false,
      message: 'Payment service is not configured. Please contact support.'
    });
  }

  try {
    // Validate amount is a valid number
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || !isFinite(numericAmount)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount value'
      });
    }

    // Razorpay minimum amount is 1 INR (100 paise)
    if (numericAmount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be at least 1 INR'
      });
    }

    // Log payment order creation attempt
    logger.info('Creating Razorpay order', {
      amount: numericAmount,
      currency,
      appointmentId,
      subscriptionId,
      planId,
      userId: currentUser._id.toString(),
      hasRazorpayKey: !!ENV.RAZORPAY_KEY_ID
    });

    // Create Razorpay order
    // Receipt must be max 40 characters (Razorpay requirement)
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits
    const userId = currentUser._id.toString().slice(-6); // Last 6 chars of ObjectId
    const receipt = `RCP${timestamp}${userId}`.slice(0, 40); // Max 40 chars
    const razorpayOrder = await createOrder(numericAmount, currency, receipt, {
      userId: currentUser._id.toString(),
      appointmentId: appointmentId || '',
      subscriptionId: subscriptionId || '',
      planId: planId || ''
    });

    // Create payment record in database
    const payment = await Payment.create({
      user: currentUser._id,
      expert: expertId,
      appointment: appointmentId || undefined,
      subscription: subscriptionId || undefined,
      plan: planId || undefined,
      razorpayOrderId: razorpayOrder.id,
      amount: numericAmount,
      currency,
      status: 'pending',
      description: paymentDescription,
      receipt: razorpayOrder.receipt
    });

    res.status(201).json({
      success: true,
      data: {
        paymentId: payment._id,
        orderId: razorpayOrder.id,
        amount: Number(razorpayOrder.amount) / 100, // Convert from paise to rupees
        currency: razorpayOrder.currency,
        key: ENV.RAZORPAY_KEY_ID // Frontend needs this for Razorpay Checkout
      },
      message: 'Payment order created successfully'
    });
  } catch (error: any) {
    logger.error('Error creating payment order', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment order'
    });
  }
});

// @desc    Verify payment
// @route   POST /api/payments/verify
// @access  Private (User)
export const verifyPayment = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { paymentId, orderId, signature, razorpayPaymentId } = req.body;

  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  if (!paymentId || !orderId || !signature) {
    return res.status(400).json({
      success: false,
      message: 'paymentId, orderId, and signature are required'
    });
  }

  // Find payment record
  const payment = await Payment.findOne({
    _id: paymentId,
    user: currentUser._id,
    razorpayOrderId: orderId
  });

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  if (payment.status === 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Payment already verified'
    });
  }

  // Verify payment signature
  const isValidSignature = verifyPaymentSignature(orderId, razorpayPaymentId || orderId, signature);

  if (!isValidSignature) {
    payment.status = 'failed';
    payment.failedAt = new Date();
    payment.notes = 'Invalid payment signature';
    await payment.save();

    return res.status(400).json({
      success: false,
      message: 'Invalid payment signature'
    });
  }

  try {
    // Fetch payment details from Razorpay to confirm
    const razorpayPayment = await fetchPaymentDetails(razorpayPaymentId || orderId);

    if (razorpayPayment.status !== 'captured' && razorpayPayment.status !== 'authorized') {
      payment.status = 'failed';
      payment.failedAt = new Date();
      payment.notes = `Payment status: ${razorpayPayment.status}`;
      await payment.save();

      return res.status(400).json({
        success: false,
        message: `Payment not successful. Status: ${razorpayPayment.status}`
      });
    }

    // Mark payment as completed
    await (payment as any).markAsCompleted(razorpayPaymentId || orderId, signature);

    // Create notification for all admins
    const admins = await Admin.find();
    if (admins.length > 0) {
      const paymentAmount = payment.amount;
      const paymentType = payment.appointment ? 'Appointment' : 'Subscription';
      logger.info(`Creating payment notifications for ${admins.length} admins: ₹${paymentAmount}`);
      
      for (const admin of admins) {
        const notif = await notificationService.createNotification(
          admin._id.toString(),
          'payment',
          'Payment Received',
          `Payment of ₹${paymentAmount} received for ${paymentType}`,
          {
            paymentId: payment._id,
            amount: paymentAmount,
            paymentType: payment.appointment ? 'appointment' : 'subscription'
          }
        );
        logger.info(`Created payment notification for admin ${admin._id}: ${notif ? notif._id : 'FAILED'}`);
      }
    } else {
      logger.warn('No admins found to send payment notification');
    }

    // Update related records and send booking confirmation emails
    if (payment.appointment) {
      const appointment = await Appointment.findByIdAndUpdate(payment.appointment, {
        $set: { 
          paymentStatus: 'paid',
          status: 'confirmed' // Update status to confirmed after payment
        }
      }).populate('user', 'firstName lastName email')
        .populate('expert', 'firstName lastName specialization profileImage email');

          // Send booking confirmation emails and push notifications after payment is successful
          if (appointment) {
            try {
              await notifyParticipantsOfBooking(appointment as any);
              logger.info(`Booking confirmation emails sent for appointment ${appointment._id} after payment verification`);

              // Send payment success push notification
              await pushNotificationService.sendPaymentSuccess(
                payment.user,
                payment.amount,
                'Appointment Booking',
                payment._id.toString()
              );

              // Send appointment confirmed push so user gets a clear booking confirmation (when we have session date/time)
              if (appointment.sessionDate && appointment.startTime) {
                const expertName = [appointment.expert?.firstName, appointment.expert?.lastName].filter(Boolean).join(' ') || 'Your expert';
                const sessionDate = new Date(appointment.sessionDate);
                const dateString = sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const [startHour, startMin] = appointment.startTime.split(':').map(Number);
                const timeDate = new Date();
                timeDate.setHours(startHour, startMin, 0, 0);
                const timeString = timeDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                await pushNotificationService.sendAppointmentConfirmed(
                  payment.user,
                  expertName,
                  dateString,
                  timeString,
                  appointment._id.toString()
                );
              }
            } catch (emailError) {
              // Log error but don't fail the payment verification
              logger.error(`Failed to send booking confirmation emails for appointment ${appointment._id}`, emailError);
            }
          }
    }

    res.status(200).json({
      success: true,
      data: {
        paymentId: payment._id,
        status: payment.status,
        amount: payment.amount
      },
      message: 'Payment verified successfully'
    });
  } catch (error: any) {
    logger.error('Error verifying payment', error);
    payment.status = 'failed';
    payment.failedAt = new Date();
    payment.notes = error.message;
    await payment.save();

    res.status(500).json({
      success: false,
      message: 'Failed to verify payment'
    });
  }
});

// @desc    Razorpay webhook handler
// @route   POST /api/payments/webhook
// @access  Public (Razorpay)
export const handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const payload = JSON.stringify(req.body);

  if (!signature) {
    return res.status(400).json({
      success: false,
      message: 'Missing webhook signature'
    });
  }

  // Verify webhook signature
  const isValidSignature = verifyWebhookSignature(payload, signature);

  if (!isValidSignature) {
    logger.warn('Invalid webhook signature received');
    return res.status(400).json({
      success: false,
      message: 'Invalid webhook signature'
    });
  }

  const event = req.body.event;
  const paymentData = req.body.payload?.payment?.entity;

  logger.info(`Razorpay webhook received: ${event}`, { paymentId: paymentData?.id });

  try {
    if (event === 'payment.captured' || event === 'payment.authorized') {
      // Find payment by Razorpay payment ID
      const payment = await Payment.findOne({
        razorpayPaymentId: paymentData.id
      });

      if (payment && payment.status !== 'completed') {
        await (payment as any).markAsCompleted(paymentData.id);

        // Create notification for all admins
        const admins = await Admin.find();
        if (admins.length > 0) {
          const paymentAmount = payment.amount;
          const paymentType = payment.appointment ? 'Appointment' : 'Subscription';
          
          for (const admin of admins) {
            await notificationService.createNotification(
              admin._id.toString(),
              'payment',
              'Payment Received',
              `Payment of ₹${paymentAmount} received for ${paymentType}`,
              {
                paymentId: payment._id,
                amount: paymentAmount,
                paymentType: payment.appointment ? 'appointment' : 'subscription'
              }
            );
          }
        }

        // Update related records and send booking confirmation emails
        if (payment.appointment) {
          const appointment = await Appointment.findByIdAndUpdate(payment.appointment, {
            $set: { 
              paymentStatus: 'paid',
              status: 'confirmed' // Update status to confirmed after payment
            }
          }).populate('user', 'firstName lastName email')
            .populate('expert', 'firstName lastName specialization profileImage email');

          // Send booking confirmation emails and push notifications after payment is successful
          if (appointment) {
            try {
              await notifyParticipantsOfBooking(appointment as any);
              logger.info(`Booking confirmation emails sent for appointment ${appointment._id} via webhook`);

              // Send push notifications so user gets booking confirmation on device
              await pushNotificationService.sendPaymentSuccess(
                payment.user,
                payment.amount,
                'Appointment Booking',
                payment._id.toString()
              );
              if (appointment.sessionDate && appointment.startTime) {
                const expertName = [appointment.expert?.firstName, appointment.expert?.lastName].filter(Boolean).join(' ') || 'Your expert';
                const sessionDate = new Date(appointment.sessionDate);
                const dateString = sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const [startHour, startMin] = appointment.startTime.split(':').map(Number);
                const timeDate = new Date();
                timeDate.setHours(startHour, startMin, 0, 0);
                const timeString = timeDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                await pushNotificationService.sendAppointmentConfirmed(
                  payment.user,
                  expertName,
                  dateString,
                  timeString,
                  appointment._id.toString()
                );
              }
            } catch (emailError) {
              // Log error but don't fail the webhook processing
              logger.error(`Failed to send booking confirmation emails for appointment ${appointment._id}`, emailError);
            }
          }
        }

        logger.info(`Payment ${payment._id} marked as completed via webhook`);
      }
    } else if (event === 'payment.failed') {
      const payment = await Payment.findOne({
        razorpayPaymentId: paymentData.id
      });

      if (payment && payment.status !== 'failed') {
        await (payment as any).markAsFailed('Payment failed via Razorpay');
        logger.info(`Payment ${payment._id} marked as failed via webhook`);
      }
    }

    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error: any) {
    logger.error('Error processing webhook', error);
    res.status(500).json({
      success: false,
      message: 'Error processing webhook'
    });
  }
});

// @desc    Get user's payment history
// @route   GET /api/payments/history
// @access  Private (User)
export const getPaymentHistory = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { page = 1, limit = 10 } = req.query;

  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 10;
  const skip = (pageNumber - 1) * limitNumber;

  const payments = await Payment.find({ user: currentUser._id })
    .populate('expert', 'firstName lastName specialization')
    .populate('appointment', 'sessionDate startTime duration')
    .populate('subscription', 'planName')
    .sort({ createdAt: -1 })
    .limit(limitNumber)
    .skip(skip);

  const total = await Payment.countDocuments({ user: currentUser._id });

  res.status(200).json({
    success: true,
    data: {
      payments,
      pagination: {
        current: pageNumber,
        pages: Math.ceil(total / limitNumber),
        total
      }
    }
  });
});

// @desc    Get expert's earnings (daily, weekly, monthly, total)
// @route   GET /api/payments/expert/earnings
// @access  Private (Expert)
export const getExpertEarnings = asyncHandler(async (req, res) => {
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

  // Get current date boundaries
  const now = new Date();
  const startOfToday = new Date(now.setHours(0, 0, 0, 0));
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Calculate earnings for different timeframes
  const [dailyEarnings, weeklyEarnings, monthlyEarnings, totalEarnings] = await Promise.all([
    // Daily earnings
    Payment.aggregate([
      {
        $match: {
          expert: expert._id,
          status: 'completed',
          paidAt: { $gte: startOfToday }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]),
    // Weekly earnings
    Payment.aggregate([
      {
        $match: {
          expert: expert._id,
          status: 'completed',
          paidAt: { $gte: startOfWeek }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]),
    // Monthly earnings
    Payment.aggregate([
      {
        $match: {
          expert: expert._id,
          status: 'completed',
          paidAt: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]),
    // Total earnings
    Payment.aggregate([
      {
        $match: {
          expert: expert._id,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ])
  ]);

  res.status(200).json({
    success: true,
    data: {
      daily: dailyEarnings[0]?.total || 0,
      weekly: weeklyEarnings[0]?.total || 0,
      monthly: monthlyEarnings[0]?.total || 0,
      total: totalEarnings[0]?.total || 0
    }
  });
});

// @desc    Get expert's payout history and next payout date
// @route   GET /api/payments/expert/payouts
// @access  Private (Expert)
export const getExpertPayouts = asyncHandler(async (req, res) => {
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

  // Get completed payments (these represent earnings that can be paid out)
  // For simplicity, we'll treat completed payments as potential payouts
  // In a real system, you'd have a separate Payout model tracking actual payouts
  const completedPayments = await Payment.find({
    expert: expert._id,
    status: 'completed'
  })
    .sort({ paidAt: -1 })
    .limit(10)
    .populate('user', 'firstName lastName')
    .populate('appointment', 'sessionDate startTime')
    .select('amount paidAt description user appointment');

  // Calculate total pending payout (all completed payments)
  const pendingPayout = await Payment.aggregate([
    {
      $match: {
        expert: expert._id,
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  // Calculate last payout (most recent completed payment)
  const lastPayout = completedPayments.length > 0 ? {
    amount: completedPayments[0].amount,
    date: completedPayments[0].paidAt || completedPayments[0].createdAt
  } : null;

  // Calculate next payout date (assuming monthly payouts on the 1st of next month)
  const now = new Date();
  const nextPayoutDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  nextPayoutDate.setHours(0, 0, 0, 0);

  res.status(200).json({
    success: true,
    data: {
      lastPayout: lastPayout ? {
        amount: lastPayout.amount,
        date: lastPayout.date.toISOString()
      } : null,
      nextPayoutDate: nextPayoutDate.toISOString(),
      pendingPayout: pendingPayout[0]?.total || 0,
      recentPayouts: completedPayments.slice(0, 5).map(payment => ({
        amount: payment.amount,
        date: (payment.paidAt || payment.createdAt).toISOString(),
        description: payment.description,
        user: payment.user ? {
          name: `${(payment.user as any).firstName} ${(payment.user as any).lastName}`
        } : null
      }))
    }
  });
});

