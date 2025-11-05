const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import database connection
const connectDB = require('./config/database');

// Import middlewares
const { errorHandler, notFound } = require('./middlewares/errorHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const expertRoutes = require('./routes/expertRoutes');
const adminRoutes = require('./routes/admin/adminRoutes');
const userRoutes = require('./routes/admin/userRoutes');
const adminExpertRoutes = require('./routes/admin/expertRoutes');
const subscriptionRoutes = require('./routes/admin/subscriptionRoutes');

// Connect to MongoDB
connectDB();

// Seed initial superadmin if env provided
const seedInitialAdmin = async () => {
  try {
    const Admin = require('./models/Admin');
    const email = process.env.INIT_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
    const name = process.env.INIT_ADMIN_NAME || process.env.ADMIN_NAME || 'Super Admin';
    const password = process.env.INIT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

    if (!email || !password) return;

    const existing = await Admin.findOne({ email });
    if (existing) {
      console.log('Initial admin already exists:', email);
      return;
    }

      const admin = await Admin.create({ name, email, password, role: 'superadmin', isPrimary: true });
      console.log('Seeded initial superadmin:', admin.email);
  } catch (err) {
    console.error('Failed to seed initial admin:', err.message);
  }
};

seedInitialAdmin();

  // In development, if no env-provided admin was seeded, create a demo admin for convenience
  const seedDevDemoAdmin = async () => {
    try {
      if (process.env.NODE_ENV !== 'development') return;
      const Admin = require('./models/Admin');
      const demoEmail = 'admin@zenovia.com';
      const demoPassword = 'admin123';

      const existing = await Admin.findOne({ email: demoEmail });
      if (existing) return;

      const admin = await Admin.create({ name: 'Demo Admin', email: demoEmail, password: demoPassword, role: 'superadmin', isPrimary: false });
      console.log('Seeded development demo admin:', admin.email);
    } catch (err) {
      console.error('Failed to seed dev demo admin:', err.message);
    }
  };

  seedDevDemoAdmin();

// Seed default permissions
const seedDefaultPermissions = async () => {
  try {
    const Permission = require('./models/Permission');
    
    const defaultPermissions = [
      { key: 'manage_users', label: 'Manage Users' },
      { key: 'manage_experts', label: 'Manage Experts' },
      { key: 'manage_admins', label: 'Manage Admins' },
      { key: 'manage_bookings', label: 'Manage Bookings' },
      { key: 'manage_payments', label: 'Manage Payments' },
      { key: 'manage_subscriptions', label: 'Manage Subscriptions' },
      { key: 'view_reports', label: 'View Reports' },
      { key: 'manage_settings', label: 'Manage Settings' },
      { key: 'view_analytics', label: 'View Analytics' }
    ];
    
    for (const perm of defaultPermissions) {
      const existing = await Permission.findOne({ key: perm.key });
      if (!existing) {
        await Permission.create(perm);
        console.log(`Seeded permission: ${perm.label}`);
      }
    }
  } catch (err) {
    console.error('Failed to seed default permissions:', err.message);
  }
};

seedDefaultPermissions();

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    console.log('🌐 CORS request from origin:', origin);
    console.log('🔧 Environment:', process.env.NODE_ENV);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('✅ No origin, allowing request');
      return callback(null, true);
    }
    
    const allowedOrigins = [
      ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(url => url.trim()) : []),
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8081',
      'http://localhost:19000',
      'http://localhost:19001',
      'http://localhost:19002',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:8081',
      'http://127.0.0.1:19000',
      'http://10.0.2.2:3001',
      'http://10.0.2.2:3000',
      'http://10.0.2.2:8081',
      'http://10.0.2.2:19000',
      'http://192.168.1.3:8081',
      'http://192.168.1.3:19000',
      'http://192.168.1.3:19001',
      'http://192.168.1.3:19002',
      'http://192.168.1.3:3001',
      'http://192.168.1.4:8081',
      'http://192.168.1.4:3001',
      'http://192.168.1.4:19000',
      'https://apiwellness.shrawantravels.com',
      'http://apiwellness.shrawantravels.com',
      'https://adminwellness.shrawantravels.com',
      'http://adminwellness.shrawantravels.com',
      'exp://localhost:8081',
      'exp://localhost:19000',
      'exp://10.0.2.2:8081',
      'exp://192.168.1.3:8081',
      'exp://192.168.1.3:19000',
      'exp://192.168.1.4:8081'
    ];

    // In development, be more permissive
    if (process.env.NODE_ENV === 'development') {
      // Allow any localhost, 127.0.0.1, 10.0.2.2, exp://, or local network origins
      if (origin && (
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') || 
        origin.includes('10.0.2.2') || 
        origin.includes('192.168.') ||
        origin.includes('exp://') ||
        origin.includes('capacitor://') ||
        origin.startsWith('http://192.168.') ||
        origin.startsWith('https://192.168.')
      )) {
        console.log('Development mode: allowing origin', origin);
        return callback(null, true);
      }
    }

    // Check if origin is in allowed list
    const normalizedOrigin = origin.replace(/\/$/, ''); // Remove trailing slash
    const isAllowed = allowedOrigins.some(allowedOrigin => 
      allowedOrigin.replace(/\/$/, '') === normalizedOrigin
    );
    
    if (isAllowed) {
      console.log('✅ Origin found in allowed list:', origin);
      callback(null, true);
    } else {
      console.log('❌ Origin NOT allowed:', origin);
      console.log('📋 Allowed origins:', allowedOrigins);
      console.log('🔍 Normalized origin:', normalizedOrigin);
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin',
    'Cache-Control',
    'X-Access-Token',
    'X-HTTP-Method-Override'
  ]
};

app.use(cors(corsOptions));

// Additional CORS headers for preflight requests
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log(`🚀 ${req.method} request to ${req.path} from origin: ${origin}`);
  
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,DELETE,PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,X-Access-Token');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling OPTIONS preflight request');
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
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(globalLimiter);

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
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

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running in', process.env.NODE_ENV, 'mode on port', PORT);
  console.log('Health check: http://localhost:' + PORT + '/health');
  console.log('Health check (network): http://192.168.1.3:' + PORT + '/health');
  console.log('API Documentation: http://localhost:' + PORT + '/');
  console.log('Auth API: http://localhost:' + PORT + '/api/auth');
  console.log('Auth API (network): http://192.168.1.3:' + PORT + '/api/auth');
  console.log('Expert API: http://localhost:' + PORT + '/api/experts');
  console.log('Uploads: http://localhost:' + PORT + '/uploads');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log('Unhandled Rejection:', err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log('Uncaught Exception:', err.message);
  console.log('Shutting down the server due to Uncaught Exception');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  console.log('Shutting down gracefully');
  server.close(() => {
    console.log('Process terminated!');
  });
});

module.exports = app;
