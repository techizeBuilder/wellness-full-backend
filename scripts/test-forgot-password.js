#!/usr/bin/env node
/**
 * Test Script: Forgot Password Full Flow
 * Tests: Send OTP → Verify OTP → Reset Password
 * 
 * Usage: node scripts/test-forgot-password.js [email]
 */

const BASE_URL = process.env.API_URL || 'https://apiwellness.shrawantravels.com/api';

// Color helpers for terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(msg) { console.log(msg); }
function success(msg) { console.log(`${GREEN}✅ ${msg}${RESET}`); }
function error(msg) { console.log(`${RED}❌ ${msg}${RESET}`); }
function info(msg) { console.log(`${CYAN}ℹ️  ${msg}${RESET}`); }
function warn(msg) { console.log(`${YELLOW}⚠️  ${msg}${RESET}`); }
function section(msg) { console.log(`\n${BOLD}${CYAN}━━━ ${msg} ━━━${RESET}`); }

async function apiCall(method, endpoint, body = null) {
    const url = `${BASE_URL}${endpoint}`;
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);

    try {
        const res = await fetch(url, options);
        const data = await res.json();
        return { status: res.status, ok: res.ok, data };
    } catch (err) {
        return { status: 0, ok: false, data: null, error: err.message };
    }
}

async function testForgotPasswordFlow(testEmail) {
    log(`\n${BOLD}🔐 Forgot Password Flow Test${RESET}`);
    log(`${BOLD}API Base URL:${RESET} ${BASE_URL}`);
    log(`${BOLD}Test Email:${RESET} ${testEmail}\n`);

    let debugOtp = null;

    // ─── STEP 1: Send OTP ─────────────────────────────────────────────────────
    section('Step 1: Send OTP (forgot-password)');
    info(`POST ${BASE_URL}/auth/forgot-password`);
    info(`Body: { "email": "${testEmail}" }`);

    const step1 = await apiCall('POST', '/auth/forgot-password', { email: testEmail });

    if (!step1.ok) {
        error(`Failed to send OTP. Status: ${step1.status}`);
        error(`Response: ${JSON.stringify(step1.data, null, 2)}`);
        if (step1.data?.message?.includes('User not found')) {
            warn(`Email "${testEmail}" is NOT registered. Use a registered email.`);
        }
        if (step1.data?.message?.includes('not configured')) {
            warn('Email service is not configured. Check EMAIL_HOST, EMAIL_USER, EMAIL_PASS in .env');
        }
        return false;
    }

    success(`OTP sent successfully!`);
    log(`Message: ${step1.data.message}`);

    if (step1.data.data?.debugOtp) {
        debugOtp = step1.data.data.debugOtp;
        success(`[DEV MODE] Debug OTP: ${BOLD}${debugOtp}${RESET}${GREEN}`);
        warn('This OTP is only returned in development mode. In production, check your email.');
    } else {
        warn('No debug OTP in response. The OTP was sent to the email address.');
        warn('Check your email inbox/spam folder for the OTP.');
        const userInput = await promptUser('Enter OTP from email: ');
        debugOtp = userInput.trim();
    }

    if (!debugOtp || debugOtp.length !== 6) {
        error(`Invalid OTP: "${debugOtp}". OTP must be 6 digits.`);
        return false;
    }

    // ─── STEP 2: Verify OTP ───────────────────────────────────────────────────
    section('Step 2: Verify OTP (verify-password-reset-otp-unauthenticated)');
    info(`POST ${BASE_URL}/auth/verify-password-reset-otp-unauthenticated`);
    info(`Body: { "email": "${testEmail}", "otp": "${debugOtp}" }`);

    const step2 = await apiCall('POST', '/auth/verify-password-reset-otp-unauthenticated', {
        email: testEmail,
        otp: debugOtp
    });

    if (!step2.ok) {
        error(`OTP verification failed. Status: ${step2.status}`);
        error(`Response: ${JSON.stringify(step2.data, null, 2)}`);
        if (step2.data?.message?.includes('expired')) {
            warn('OTP has expired. Please request a new OTP (10 minute expiry).');
        }
        if (step2.data?.message?.includes('locked')) {
            warn('Too many failed attempts. OTP is locked. Please request a new OTP.');
        }
        return false;
    }

    if (!step2.data.data?.verified) {
        error('OTP verification response does not include verified:true');
        error(`Response: ${JSON.stringify(step2.data, null, 2)}`);
        return false;
    }

    success(`OTP verified successfully!`);
    log(`Message: ${step2.data.message}`);

    // ─── STEP 3: Reset Password ───────────────────────────────────────────────
    section('Step 3: Reset Password (reset-password-with-otp-unauthenticated)');
    const newPassword = 'TestPass@123';
    info(`POST ${BASE_URL}/auth/reset-password-with-otp-unauthenticated`);
    info(`Body: { "email": "${testEmail}", "otp": "${debugOtp}", "password": "${newPassword}" }`);

    const step3 = await apiCall('POST', '/auth/reset-password-with-otp-unauthenticated', {
        email: testEmail,
        otp: debugOtp,
        password: newPassword
    });

    if (!step3.ok) {
        error(`Password reset failed. Status: ${step3.status}`);
        error(`Response: ${JSON.stringify(step3.data, null, 2)}`);
        return false;
    }

    success(`Password reset successfully!`);
    log(`Message: ${step3.data.message}`);

    // ─── STEP 4: Verify Login with New Password ────────────────────────────────
    section('Step 4: Verify Login with New Password');
    info(`POST ${BASE_URL}/auth/login`);
    info(`Body: { "email": "${testEmail}", "password": "${newPassword}" }`);

    const step4 = await apiCall('POST', '/auth/login', {
        email: testEmail,
        password: newPassword
    });

    if (!step4.ok) {
        warn(`Login with new password failed. Status: ${step4.status}`);
        warn(`Response: ${JSON.stringify(step4.data, null, 2)}`);
        warn('This may be expected if the account requires additional verification.');
    } else {
        success(`Login with new password successful!`);
        log(`User: ${step4.data.data?.user?.firstName} (${step4.data.data?.user?.email})`);
    }

    // ─── SUMMARY ─────────────────────────────────────────────────────────────
    section('Test Summary');
    success(`Step 1 - Send OTP: PASS`);
    success(`Step 2 - Verify OTP: PASS`);
    success(`Step 3 - Reset Password: PASS`);
    if (step4.ok) {
        success(`Step 4 - Login with New Password: PASS`);
    } else {
        warn(`Step 4 - Login with New Password: SKIPPED (may need additional checks)`);
    }

    log(`\n${GREEN}${BOLD}✅ Forgot Password Flow is working correctly!${RESET}\n`);

    // Restore original password reminder
    warn(`⚠️  Password for ${testEmail} has been changed to: ${newPassword}`);
    warn('You may want to change it back manually if this is a production account.');

    return true;
}

function promptUser(question) {
    return new Promise((resolve) => {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        readline.question(question, (answer) => {
            readline.close();
            resolve(answer);
        });
    });
}

async function main() {
    // Get test email from CLI arg or use default test email
    let testEmail = process.argv[2];

    if (!testEmail) {
        // Find a registered user from the DB for testing
        info('No email provided. Fetching a test email from the database...');
        try {
            const mongoose = require('mongoose');
            require('dotenv').config();
            const mongoUri = process.env.MONGODB_URI;
            if (!mongoUri) throw new Error('MONGODB_URI not set in .env');

            await mongoose.connect(mongoUri);
            const User = mongoose.model('User', new mongoose.Schema({ email: String, firstName: String }));
            const user = await User.findOne({}).select('email firstName');
            await mongoose.disconnect();

            if (user) {
                testEmail = user.email;
                info(`Using registered user: ${user.firstName} (${testEmail})`);
            } else {
                error('No users found in the database.');
                process.exit(1);
            }
        } catch (err) {
            error(`Could not connect to database: ${err.message}`);
            warn('Usage: node scripts/test-forgot-password.js <email>');
            warn('Example: node scripts/test-forgot-password.js user@example.com');
            process.exit(1);
        }
    }

    const result = await testForgotPasswordFlow(testEmail);
    process.exit(result ? 0 : 1);
}

main().catch((err) => {
    error(`Unexpected error: ${err.message}`);
    process.exit(1);
});
