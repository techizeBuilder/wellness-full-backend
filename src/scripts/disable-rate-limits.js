#!/usr/bin/env node

/**
 * Development helper script to temporarily disable rate limiting
 * Usage: node scripts/disable-rate-limits.js
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

try {
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Enable the disable flags
  envContent = envContent.replace(
    /# DISABLE_AUTH_RATE_LIMIT=false/g,
    'DISABLE_AUTH_RATE_LIMIT=true'
  );
  
  envContent = envContent.replace(
    /# DISABLE_OTP_RATE_LIMIT=false/g,
    'DISABLE_OTP_RATE_LIMIT=true'
  );
  
  // If the flags don't exist, add them
  if (!envContent.includes('DISABLE_AUTH_RATE_LIMIT')) {
    envContent += '\n# Temporarily disable rate limiting for development\n';
    envContent += 'DISABLE_AUTH_RATE_LIMIT=true\n';
    envContent += 'DISABLE_OTP_RATE_LIMIT=true\n';
  }
  
  fs.writeFileSync(envPath, envContent);
  
  console.log('✅ Rate limiting disabled for development');
  console.log('⚠️  Remember to re-enable before production!');
  console.log('🔄 Restart your server for changes to take effect');
  
} catch (error) {
  console.error('❌ Error updating .env file:', error.message);
}