import ENV from './environment';

const requiredEnvVars: (keyof typeof ENV)[] = [
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'EMAIL_HOST',
  'EMAIL_USER',
  'EMAIL_PASS',
  'EMAIL_FROM'
];

export const validateEnvironment = (): void => {
  const missing: string[] = [];
  
  requiredEnvVars.forEach(varName => {
    if (!ENV[varName]) {
      missing.push(varName);
    }
  });
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    process.exit(1);
  }
  
  console.log('✅ Environment variables validated');
};

