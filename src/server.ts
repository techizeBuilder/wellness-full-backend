import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';

// Import configuration
import connectDB from './config/database';
import { corsOptions } from './config/cors';
import { createGlobalLimiter } from './config/rateLimit';
import { validateEnvironment } from './config/validateEnv';
import ENV from './config/environment';

// Import utilities
import logger from './utils/logger';

// Import middlewares
import { errorHandler, notFound } from './middlewares/errorHandler';

// Import routes
import authRoutes from './routes/authRoutes';
import expertRoutes from './routes/expertRoutes';
import bookingRoutes from './routes/bookingRoutes';
import planRoutes from './routes/planRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import paymentRoutes from './routes/paymentRoutes';
import contentRoutes from './routes/contentRoutes';
import adminRoutes from './routes/admin/adminRoutes';
import userRoutes from './routes/admin/userRoutes';
import adminExpertRoutes from './routes/admin/expertRoutes';
import adminSubscriptionRoutes from './routes/admin/subscriptionRoutes';
import adminBookingRoutes from './routes/admin/bookingRoutes';
import adminPaymentRoutes from './routes/admin/paymentRoutes';
import adminContentRoutes from './routes/admin/contentRoutes';
import adminDashboardRoutes from './routes/admin/dashboardRoutes';
import adminReportsRoutes from './routes/admin/reportsRoutes';
import notificationRoutes from './routes/notificationRoutes';
import userNotificationRoutes from './routes/userNotificationRoutes';

// Import seeders
import { runSeeders } from './seeders';
import { startAppointmentReminderScheduler } from './services/appointmentReminderService';
import { startSubscriptionReminderScheduler } from './services/subscriptionReminderService';
import { startSubscriptionExpiryScheduler } from './services/subscriptionExpiryService';
import { initializeFirebase } from './services/fcmService';

// Validate environment variables
validateEnvironment();

// Connect to MongoDB
connectDB();

// Initialize Firebase
initializeFirebase();

// Run seeders
runSeeders().catch((err: Error) => {
  logger.error('Error running seeders', err);
});

const app: Express = express();

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
})); 

// CORS configuration
app.use(cors(corsOptions));

// Additional CORS headers for preflight requests
app.use((req: Request, res: Response, next) => {
  const origin = req.headers.origin;
  logger.debug(`${req.method} request to ${req.path} from origin: ${origin}`);
  
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,DELETE,PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,X-Access-Token');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  if (req.method === 'OPTIONS') {
    logger.debug('Handling OPTIONS preflight request');
    res.sendStatus(200);
  } else {
    next();
  }
});

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (ENV.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Global rate limiting
app.use(createGlobalLimiter());

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    environment: ENV.NODE_ENV
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/experts', expertRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/contents', contentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/users', userRoutes);
app.use('/api/admin/experts', adminExpertRoutes);
app.use('/api/admin/subscriptions', adminSubscriptionRoutes);
app.use('/api/admin/bookings', adminBookingRoutes);
app.use('/api/admin/payments', adminPaymentRoutes);
app.use('/api/admin/contents', adminContentRoutes);
app.use('/api/admin/reports', adminReportsRoutes);
app.use('/api/admin/notifications', notificationRoutes);
app.use('/api/user/notifications', userNotificationRoutes);

// Default route
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Wellness App API',
    version: '1.0.0',
    documentation: {
      authentication: '/api/auth',
      experts: '/api/experts'
    }
  });
});

// Handle undefined routes
app.use(notFound);

// Global error handler
app.use(errorHandler);

const PORT: number = ENV.PORT;

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running in ${ENV.NODE_ENV} mode on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`API Documentation: http://localhost:${PORT}/`);
  logger.info(`Auth API: http://localhost:${PORT}/api/auth`);
  logger.info(`Expert API: http://localhost:${PORT}/api/experts`);
  logger.info(`Uploads: http://localhost:${PORT}/uploads`);
});

startAppointmentReminderScheduler();
startSubscriptionReminderScheduler();
startSubscriptionExpiryScheduler();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error, promise: Promise<any>) => {
  logger.error('Unhandled Rejection', err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception', err);
  logger.error('Shutting down the server due to Uncaught Exception');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  logger.info('Shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated!');
  });
});

export default app;
