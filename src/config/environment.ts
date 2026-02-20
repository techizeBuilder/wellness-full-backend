import dotenv from 'dotenv';
dotenv.config();

interface Environment {
  NODE_ENV: string;
  PORT: number;
  MONGODB_URI: string | undefined;
  JWT_SECRET: string | undefined;
  JWT_EXPIRE: string;
  JWT_REFRESH_SECRET: string | undefined;
  JWT_REFRESH_EXPIRE: string;
  EMAIL_HOST: string | undefined;
  EMAIL_PORT: string | undefined;
  EMAIL_USER: string | undefined;
  EMAIL_PASS: string | undefined;
  EMAIL_FROM: string | undefined;
  OTP_EXPIRE_MINUTES: number;
  MAX_FILE_SIZE: number;
  ALLOWED_FILE_TYPES: string;
  FRONTEND_URL: string | undefined;
  BASE_URL: string | undefined;
  BCRYPT_ROUNDS: number;
  INIT_ADMIN_EMAIL: string | undefined;
  INIT_ADMIN_NAME: string | undefined;
  INIT_ADMIN_PASSWORD: string | undefined;
  AGORA_APP_ID: string | undefined;
  AGORA_APP_CERTIFICATE: string | undefined;
  AGORA_TOKEN_EXPIRY_SECONDS: number;
  AGORA_JOIN_WINDOW_MINUTES: number;
  SESSION_REMINDER_MINUTES: number;
  
  // Razorpay
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  
  // Firebase Cloud Messaging
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_PRIVATE_KEY?: string;
  FIREBASE_CLIENT_EMAIL?: string;
}

const ENV: Environment = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  
  // Database
  MONGODB_URI: process.env.MONGODB_URI,
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE || '30d',
  
  // Email
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: process.env.EMAIL_PORT,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM,
  
  // OTP
  OTP_EXPIRE_MINUTES: parseInt(process.env.OTP_EXPIRE_MINUTES || '10', 10),
  
  // File Upload
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
  ALLOWED_FILE_TYPES: process.env.ALLOWED_FILE_TYPES || 'jpeg,jpg,png,gif',
  
  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL,
  
  // API Base URL
  BASE_URL: process.env.API_BASE_URL || process.env.BASE_URL,
  
  // Security
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  
  // Admin
  INIT_ADMIN_EMAIL: process.env.INIT_ADMIN_EMAIL || process.env.ADMIN_EMAIL,
  INIT_ADMIN_NAME: process.env.INIT_ADMIN_NAME || process.env.ADMIN_NAME,
  INIT_ADMIN_PASSWORD: process.env.INIT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD,

  // Agora
  AGORA_APP_ID: process.env.AGORA_APP_ID,
  AGORA_APP_CERTIFICATE: process.env.AGORA_APP_CERTIFICATE,
  AGORA_TOKEN_EXPIRY_SECONDS: parseInt(process.env.AGORA_TOKEN_EXPIRY_SECONDS || '7200', 10),
  AGORA_JOIN_WINDOW_MINUTES: parseInt(process.env.AGORA_JOIN_WINDOW_MINUTES || '2', 10),

  // Appointment reminders
  SESSION_REMINDER_MINUTES: parseInt(process.env.SESSION_REMINDER_MINUTES || '10', 10),
  
  // Razorpay
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  
  // Firebase Cloud Messaging
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL
};

export default ENV;

