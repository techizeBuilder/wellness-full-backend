const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

// Import configuration
const connectDB = require('./config/database');
const { corsOptions } = require('./config/cors');
const { createGlobalLimiter } = require('./config/rateLimit');
const { validateEnvironment } = require('./config/validateEnv');
const ENV = require('./config/environment');

// Import utilities
const logger = require('./utils/logger');

// Import middlewares
const { errorHandler, notFound } = require('./middlewares/errorHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const expertRoutes = require('./routes/expertRoutes');
const adminRoutes = require('./routes/admin/adminRoutes');
const userRoutes = require('./routes/admin/userRoutes');
const adminExpertRoutes = require('./routes/admin/expertRoutes');
const subscriptionRoutes = require('./routes/admin/subscriptionRoutes');

// Import seeders
const { runSeeders } = require('./seeders');

// Validate environment variables
validateEnvironment();

// Connect to MongoDB
connectDB();

// Run seeders
runSeeders().catch(err => {
  logger.error('Error running seeders', err);
});

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors(corsOptions));

// Additional CORS headers for preflight requests
app.use((req, res, next) => {
  const origin = req.headers.origin;
  logger.debug(`${req.method} request to ${req.path} from origin: ${origin}`);
  
  res.header('Access-Control-Allow-Origin', origin);
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
app.get('/health', (req, res) => {
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
app.use('/api/admin', adminRoutes);
app.use('/api/admin/users', userRoutes);
app.use('/api/admin/experts', adminExpertRoutes);
app.use('/api/admin/subscriptions', subscriptionRoutes);

// Default route
app.get('/', (req, res) => {
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

const PORT = ENV.PORT;

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running in ${ENV.NODE_ENV} mode on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`API Documentation: http://localhost:${PORT}/`);
  logger.info(`Auth API: http://localhost:${PORT}/api/auth`);
  logger.info(`Expert API: http://localhost:${PORT}/api/experts`);
  logger.info(`Uploads: http://localhost:${PORT}/uploads`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Rejection', err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
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

module.exports = app;
