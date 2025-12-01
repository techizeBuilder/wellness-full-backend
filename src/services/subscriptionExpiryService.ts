import ENV from '../config/environment';
import UserSubscription from '../models/UserSubscription';
import logger from '../utils/logger';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour

let expiryInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

const processExpiredSubscriptions = async () => {
  if (isProcessing) {
    return;
  }

  isProcessing = true;
  try {
    const now = new Date();
    
    // Find active subscriptions that have passed their expiry date
    const expiredSubscriptions = await UserSubscription.find({
      status: 'active',
      expiryDate: { $lt: now }
    });

    if (expiredSubscriptions.length === 0) {
      return;
    }

    logger.info(`Found ${expiredSubscriptions.length} expired subscriptions to process`);

    for (const subscription of expiredSubscriptions) {
      try {
        subscription.status = 'expired';
        subscription.autoRenewal = false;
        await subscription.save();
        logger.info(`Subscription ${subscription._id} expired successfully`);
      } catch (error: any) {
        logger.error(`Failed to expire subscription ${subscription._id}`, error);
      }
    }
  } catch (error) {
    logger.error('Error while processing expired subscriptions', error);
  } finally {
    isProcessing = false;
  }
};

export const startSubscriptionExpiryScheduler = () => {
  if (expiryInterval) {
    return;
  }

  logger.info('Starting subscription expiry scheduler', {
    intervalHours: CHECK_INTERVAL_MS / (60 * 60 * 1000)
  });

  const runCheck = () => {
    processExpiredSubscriptions().catch(error => {
      logger.error('Unexpected error during subscription expiry run', error);
    });
  };

  runCheck();
  expiryInterval = setInterval(runCheck, CHECK_INTERVAL_MS);
};

export const stopSubscriptionExpiryScheduler = () => {
  if (expiryInterval) {
    clearInterval(expiryInterval);
    expiryInterval = null;
  }
};

