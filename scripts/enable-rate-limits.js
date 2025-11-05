#!/usr/bin/env node

/**
 * Development helper script to re-enable rate limiting
 * Usage: node scripts/enable-rate-limits.js
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

try {
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Disable the flags
  envContent = envContent.replace(
    /DISABLE_AUTH_RATE_LIMIT=true/g,
    '# DISABLE_AUTH_RATE_LIMIT=false'
  );
  
  envContent = envContent.replace(
    /DISABLE_OTP_RATE_LIMIT=true/g,
    '# DISABLE_OTP_RATE_LIMIT=false'
  );
  
  fs.writeFileSync(envPath, envContent);
  
  console.log('✅ Rate limiting re-enabled');
  console.log('🔄 Restart your server for changes to take effect');
  
} catch (error) {
  console.error('❌ Error updating .env file:', error.message);
}