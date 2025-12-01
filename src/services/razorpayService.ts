import Razorpay from 'razorpay';
import crypto from 'crypto';
import ENV from '../config/environment';
import logger from '../utils/logger';

// Initialize Razorpay instance
let razorpayInstance: Razorpay | null = null;

export const getRazorpayInstance = (): Razorpay => {
  if (!razorpayInstance) {
    if (!ENV.RAZORPAY_KEY_ID || !ENV.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables.');
    }

    razorpayInstance = new Razorpay({
      key_id: ENV.RAZORPAY_KEY_ID,
      key_secret: ENV.RAZORPAY_KEY_SECRET
    });

    logger.info('Razorpay instance initialized');
  }

  return razorpayInstance;
};

// Create a Razorpay order
export const createOrder = async (amount: number, currency: string = 'INR', receipt?: string, notes?: Record<string, string>) => {
  try {
    const razorpay = getRazorpayInstance();
    
    const options = {
      amount: amount * 100, // Razorpay expects amount in paise (smallest currency unit)
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      notes: notes || {}
    };

    const order = await razorpay.orders.create(options);
    
    logger.info(`Razorpay order created: ${order.id}`, { amount, currency });
    
    return {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
      createdAt: order.created_at
    };
  } catch (error: any) {
    // Razorpay errors have a nested structure: error.error.description
    let errorMessage = 'Unknown error occurred';
    
    if (error?.error?.description) {
      errorMessage = error.error.description;
    } else if (error?.error?.reason) {
      errorMessage = error.error.reason;
    } else if (error?.description) {
      errorMessage = error.description;
    } else if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    // Log full error details for debugging
    logger.error('Error creating Razorpay order', {
      message: errorMessage,
      error: error?.error || error,
      statusCode: error?.statusCode,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
    
    throw new Error(`Failed to create payment order: ${errorMessage}`);
  }
};

// Verify payment signature
export const verifyPaymentSignature = (orderId: string, paymentId: string, signature: string): boolean => {
  try {
    const razorpay = getRazorpayInstance();
    const text = `${orderId}|${paymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', razorpay.key_secret || '')
      .update(text)
      .digest('hex');

    return generatedSignature === signature;
  } catch (error: any) {
    logger.error('Error verifying payment signature', error);
    return false;
  }
};

// Verify webhook signature
export const verifyWebhookSignature = (payload: string, signature: string): boolean => {
  try {
    if (!ENV.RAZORPAY_WEBHOOK_SECRET) {
      logger.warn('RAZORPAY_WEBHOOK_SECRET not configured, skipping webhook signature verification');
      return true; // Allow in development if not configured
    }

    const generatedSignature = crypto
      .createHmac('sha256', ENV.RAZORPAY_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    return generatedSignature === signature;
  } catch (error: any) {
    logger.error('Error verifying webhook signature', error);
    return false;
  }
};

// Fetch payment details from Razorpay
export const fetchPaymentDetails = async (paymentId: string) => {
  try {
    const razorpay = getRazorpayInstance();
    const payment = await razorpay.payments.fetch(paymentId);
    
    return {
      id: payment.id,
      amount: payment.amount / 100, // Convert from paise to rupees
      currency: payment.currency,
      status: payment.status,
      method: payment.method,
      description: payment.description,
      createdAt: payment.created_at,
      captured: payment.captured,
      email: payment.email,
      contact: payment.contact
    };
  } catch (error: any) {
    logger.error(`Error fetching payment details for ${paymentId}`, error);
    throw new Error(`Failed to fetch payment details: ${error.message}`);
  }
};

// Refund a payment
export const refundPayment = async (paymentId: string, amount?: number, notes?: Record<string, string>) => {
  try {
    const razorpay = getRazorpayInstance();
    
    const options: any = {
      notes: notes || {}
    };

    if (amount) {
      options.amount = amount * 100; // Convert to paise
    }

    const refund = await razorpay.payments.refund(paymentId, options);
    
    logger.info(`Refund processed for payment ${paymentId}`, { refundId: refund.id, amount: refund.amount });
    
    return {
      id: refund.id,
      amount: refund.amount / 100,
      status: refund.status,
      createdAt: refund.created_at
    };
  } catch (error: any) {
    logger.error(`Error processing refund for payment ${paymentId}`, error);
    throw new Error(`Failed to process refund: ${error.message}`);
  }
};
