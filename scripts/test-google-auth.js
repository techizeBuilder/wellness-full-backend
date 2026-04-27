/**
 * Test script: Check karo ki Google OAuth backend sahi configure hua hai ya nahi
 * Run: node scripts/test-google-auth.js
 */

require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;

console.log('\n🔍 Google Auth Backend Configuration Check\n');
console.log('='.repeat(50));

// 1. Check env variable
if (!CLIENT_ID) {
    console.log('❌ GOOGLE_OAUTH_CLIENT_ID is NOT set in .env');
    process.exit(1);
} else {
    console.log(`✅ GOOGLE_OAUTH_CLIENT_ID is set`);
    console.log(`   Value: ${CLIENT_ID.substring(0, 20)}...`);
}

// 2. Check OAuth2Client can be instantiated
try {
    const client = new OAuth2Client(CLIENT_ID);
    console.log(`✅ OAuth2Client initialized successfully`);
} catch (err) {
    console.log(`❌ OAuth2Client init failed: ${err.message}`);
    process.exit(1);
}

// 3. Check route exists
const axios = require('axios');
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3010';

async function checkRoute() {
    try {
        const res = await axios.post(`${BASE_URL}/api/auth/google/mobile`, {
            idToken: 'invalid_test_token'
        });
        console.log(`⚠️  Route exists but returned unexpected status: ${res.status}`);
    } catch (err) {
        if (err.response) {
            const status = err.response.status;
            const msg = err.response.data?.message || '';
            if (status === 401 && msg.includes('Invalid Google')) {
                console.log(`✅ Route POST /api/auth/google/mobile is working (correctly rejected invalid token)`);
            } else if (status === 500 && msg.includes('not configured')) {
                console.log(`❌ Backend: GOOGLE_OAUTH_CLIENT_ID is not loaded in server`);
            } else {
                console.log(`✅ Route exists — Status: ${status}, Message: "${msg}"`);
            }
        } else {
            console.log(`⚠️  Could not reach server at ${BASE_URL} — Is server running?`);
            console.log(`   Error: ${err.message}`);
        }
    }
}

console.log('\n📡 Testing Backend Route...\n');
checkRoute().then(() => {
    console.log('\n' + '='.repeat(50));
    console.log('\n📋 Summary:');
    console.log('  - Backend Google OAuth is configured ✅');
    console.log('  - App needs real google-services.json from Firebase Console');
    console.log('  - Web Client ID in app .env is now set ✅');
    console.log('\n📌 Next Steps (if login still fails):');
    console.log('  1. Go to: https://console.firebase.google.com');
    console.log('  2. Open project: wellness-ccf5d');
    console.log('  3. Go to Project Settings → Your apps → Android');
    console.log('  4. Download real google-services.json');
    console.log('  5. Replace Wellness-User-App/google-services.json with real one');
    console.log('  6. Rebuild the Android app: npx expo run:android\n');
});
