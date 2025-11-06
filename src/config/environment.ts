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
  BCRYPT_ROUNDS: number;
  INIT_ADMIN_EMAIL: string | undefined;
  INIT_ADMIN_NAME: string | undefined;
  INIT_ADMIN_PASSWORD: string | undefined;
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
  
  // Security
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  
  // Admin
  INIT_ADMIN_EMAIL: process.env.INIT_ADMIN_EMAIL || process.env.ADMIN_EMAIL,
  INIT_ADMIN_NAME: process.env.INIT_ADMIN_NAME || process.env.ADMIN_NAME,
  INIT_ADMIN_PASSWORD: process.env.INIT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD
};

export default ENV;

