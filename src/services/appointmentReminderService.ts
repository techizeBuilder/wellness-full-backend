import ENV from '../config/environment';
import Appointment, { IAppointment } from '../models/Appointment';
import logger from '../utils/logger';
import { sendSessionReminderEmail } from './emailService';
import pushNotificationService from './pushNotificationService';

const REMINDER_CHECK_INTERVAL_MS = 60 * 1000;
const JOIN_WINDOW_MINUTES = Math.min(Math.max(ENV.AGORA_JOIN_WINDOW_MINUTES || 2, 0), 2);
const REMINDER_LEAD_MINUTES = Math.max(ENV.SESSION_REMINDER_MINUTES || 10, 1);

let reminderInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

type PopulatedAppointment = IAppointment & {
  user: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  expert: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
};

const combineStartDateTime = (appointment: IAppointment) => {
  const sessionDate = new Date(appointment.sessionDate);
  const [startHour, startMinute] = appointment.startTime.split(':').map(Number);
  sessionDate.setHours(startHour, startMinute, 0, 0);
  return sessionDate;
};

const buildDisplayName = (doc?: { firstName?: string; lastName?: string }) => {
  if (!doc) {
    return 'your session partner';
  }
  const parts = [doc.firstName, doc.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : 'your session partner';
};

const shouldSendReminderForAppointment = (startDateTime: Date, windowStart: Date, windowEnd: Date) => {
  return startDateTime.getTime() >= windowStart.getTime() && startDateTime.getTime() <= windowEnd.getTime();
};

const sendReminderForParticipant = async (
  appointment: PopulatedAppointment,
  participant: 'user' | 'expert',
  startDateTime: Date
) => {
  const participantDoc = appointment[participant];
  const alreadySent =
    participant === 'user' ? appointment.userReminderSentAt : appointment.expertReminderSentAt;

  if (!participantDoc?.email || alreadySent) {
    return false;
  }

  const counterpartyName = buildDisplayName(participant === 'user' ? appointment.expert : appointment.user);

  // Send email reminder
  await sendSessionReminderEmail({
    email: participantDoc.email,
    firstName: participantDoc.firstName || '',
    counterpartyName,
    startDateTime,
    consultationMethod: appointment.consultationMethod,
    leadMinutes: REMINDER_LEAD_MINUTES,
    joinWindowMinutes: JOIN_WINDOW_MINUTES
  });

  // Send push notification reminder (only to users for now)
  if (participant === 'user') {
    try {
      const timeString = startDateTime.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
      
      await pushNotificationService.sendAppointmentReminder(
        appointment.user,
        counterpartyName,
        timeString,
        appointment._id.toString()
      );
    } catch (error) {
      logger.error('Failed to send push notification reminder:', error);
      // Don't fail the whole reminder if push notification fails
    }
  }

  if (participant === 'user') {
    appointment.userReminderSentAt = new Date();
  } else {
    appointment.expertReminderSentAt = new Date();
  }

  return true;
};

const processReminders = async () => {
  if (isProcessing) {
    return;
  }

  isProcessing = true;
  try {
    const now = new Date();
    const leadMillis = REMINDER_LEAD_MINUTES * 60 * 1000;
    const windowStart = new Date(now.getTime() + leadMillis - REMINDER_CHECK_INTERVAL_MS);
    const windowEnd = new Date(now.getTime() + leadMillis + REMINDER_CHECK_INTERVAL_MS);

    const sessionDateStart = new Date(windowStart);
    sessionDateStart.setHours(0, 0, 0, 0);
    const sessionDateEnd = new Date(windowEnd);
    sessionDateEnd.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      status: 'confirmed',
      sessionDate: { $gte: sessionDateStart, $lte: sessionDateEnd },
      $or: [
        { userReminderSentAt: { $exists: false } },
        { expertReminderSentAt: { $exists: false } }
      ]
    })
      .populate('user', 'firstName lastName email')
      .populate('expert', 'firstName lastName email') as PopulatedAppointment[];

    for (const appointment of appointments) {
      const startDateTime = combineStartDateTime(appointment);

      if (!shouldSendReminderForAppointment(startDateTime, windowStart, windowEnd)) {
        continue;
      }

      let updated = false;
      try {
        const userUpdated = await sendReminderForParticipant(appointment, 'user', startDateTime);
        const expertUpdated = await sendReminderForParticipant(appointment, 'expert', startDateTime);
        updated = Boolean(userUpdated || expertUpdated);
      } catch (error: any) {
        logger.error(`Failed to send session reminder email for appointment ${appointment._id}`, error);
      }

      if (updated) {
        await appointment.save();
      }
    }
  } catch (error) {
    logger.error('Error while processing appointment reminders', error);
  } finally {
    isProcessing = false;
  }
};

export const startAppointmentReminderScheduler = () => {
  if (REMINDER_LEAD_MINUTES <= 0) {
    logger.warn('Session reminder scheduler disabled because SESSION_REMINDER_MINUTES is not configured');
    return;
  }

  if (reminderInterval) {
    return;
  }

  logger.info('Starting appointment reminder scheduler', {
    leadMinutes: REMINDER_LEAD_MINUTES,
    joinWindowMinutes: JOIN_WINDOW_MINUTES,
    intervalSeconds: REMINDER_CHECK_INTERVAL_MS / 1000
  });

  const runCheck = () => {
    processReminders().catch(error => {
      logger.error('Unexpected error during appointment reminder run', error);
    });
  };

  runCheck();
  reminderInterval = setInterval(runCheck, REMINDER_CHECK_INTERVAL_MS);
};

export const stopAppointmentReminderScheduler = () => {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
};

