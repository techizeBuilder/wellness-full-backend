import ENV from '../config/environment';
import UserSubscription from '../models/UserSubscription';
import User from '../models/User';
import Expert from '../models/Expert';
import logger from '../utils/logger';
import { sendSubscriptionRenewalReminderEmail } from './emailService';

const RENEWAL_REMINDER_DAYS = 3; // Remind 3 days before expiry
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour

let reminderInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

type PopulatedSubscription = InstanceType<typeof UserSubscription> & {
  user: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  expert: {
    firstName?: string;
    lastName?: string;
    specialization?: string;
  };
};

const buildDisplayName = (doc?: { firstName?: string; lastName?: string }) => {
  if (!doc) {
    return 'there';
  }
  const parts = [doc.firstName, doc.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : 'there';
};

const shouldSendRenewalReminder = (expiryDate: Date) => {
  const now = new Date();
  const reminderDate = new Date(expiryDate);
  reminderDate.setDate(reminderDate.getDate() - RENEWAL_REMINDER_DAYS);
  
  // Check if we're within the reminder window (3 days before expiry)
  // Compare dates only (ignore time)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const reminderDay = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
  
  return today.getTime() === reminderDay.getTime();
};

const sendRenewalReminder = async (subscription: PopulatedSubscription) => {
  const user = subscription.user as any;
  const expert = subscription.expert as any;

  if (!user?.email) {
    return false;
  }

  const userName = buildDisplayName(user);
  const expertName = buildDisplayName(expert);

  await sendSubscriptionRenewalReminderEmail({
    email: user.email,
    firstName: user.firstName || userName,
    planName: subscription.planName,
    expertName: expertName,
    expiryDate: subscription.expiryDate,
    nextBillingDate: subscription.nextBillingDate || subscription.expiryDate,
    sessionsRemaining: subscription.sessionsRemaining,
    monthlyPrice: subscription.monthlyPrice,
    autoRenewal: subscription.autoRenewal
  });

  return true;
};

const processRenewalReminders = async () => {
  if (isProcessing) {
    return;
  }

  isProcessing = true;
  try {
    const now = new Date();
    const reminderDate = new Date(now);
    reminderDate.setDate(reminderDate.getDate() + RENEWAL_REMINDER_DAYS);
    
    // Calculate date range for subscriptions expiring in exactly 3 days
    const reminderDateStart = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
    const reminderDateEnd = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate() + 1);
    
    // Find subscriptions expiring in 3 days
    const subscriptions = await UserSubscription.find({
      status: 'active',
      expiryDate: {
        $gte: reminderDateStart,
        $lt: reminderDateEnd
      }
    })
      .populate('user', 'firstName lastName email')
      .populate('expert', 'firstName lastName specialization') as PopulatedSubscription[];

    logger.info(`Found ${subscriptions.length} subscriptions expiring in ${RENEWAL_REMINDER_DAYS} days`);

    for (const subscription of subscriptions) {
      if (!shouldSendRenewalReminder(subscription.expiryDate)) {
        continue;
      }

      try {
        const sent = await sendRenewalReminder(subscription);
        if (sent) {
          logger.info(`Renewal reminder sent for subscription ${subscription._id}`);
        }
      } catch (error: any) {
        logger.error(`Failed to send renewal reminder for subscription ${subscription._id}`, error);
      }
    }
  } catch (error) {
    logger.error('Error while processing renewal reminders', error);
  } finally {
    isProcessing = false;
  }
};

export const startSubscriptionReminderScheduler = () => {
  if (reminderInterval) {
    return;
  }

  logger.info('Starting subscription renewal reminder scheduler', {
    reminderDays: RENEWAL_REMINDER_DAYS,
    intervalHours: CHECK_INTERVAL_MS / (60 * 60 * 1000)
  });

  const runCheck = () => {
    processRenewalReminders().catch(error => {
      logger.error('Unexpected error during subscription reminder run', error);
    });
  };

  runCheck();
  reminderInterval = setInterval(runCheck, CHECK_INTERVAL_MS);
};

export const stopSubscriptionReminderScheduler = () => {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
};

