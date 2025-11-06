const ALLOWED_ORIGINS = [
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

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development, be more permissive
    if (process.env.NODE_ENV === 'development') {
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
        return callback(null, true);
      }
    }

    // Check if origin is in allowed list
    const normalizedOrigin = origin.replace(/\/$/, ''); // Remove trailing slash
    const isAllowed = ALLOWED_ORIGINS.some(allowedOrigin => 
      allowedOrigin.replace(/\/$/, '') === normalizedOrigin
    );
    
    if (isAllowed) {
      callback(null, true);
    } else {
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

module.exports = {
  corsOptions,
  ALLOWED_ORIGINS
};

