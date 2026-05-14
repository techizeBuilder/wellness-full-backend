#!/usr/bin/env node

/**
 * Test Script for Email Time/Date Fix
 * Tests that booking emails show correct IST time
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
};

const log = {
    success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
    info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
    header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
};

const appointmentSchema = new mongoose.Schema({
    sessionDate: Date,
    startTime: String,
    endTime: String,
    duration: Number,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expert: { type: mongoose.Schema.Types.ObjectId, ref: 'Expert' },
}, { collection: 'appointments' });

const Appointment = mongoose.model('Appointment', appointmentSchema);

// Simulate the getSessionDateTimes function (fixed version)
const getSessionDateTimes = (appointment) => {
    const sessionDate = new Date(appointment.sessionDate);
    const [startHour, startMin] = appointment.startTime.split(":").map(Number);
    const [endHour, endMin] = appointment.endTime.split(":").map(Number);

    const year = sessionDate.getUTCFullYear();
    const month = sessionDate.getUTCMonth();
    const day = sessionDate.getUTCDate();

    // Create local datetime (which represents IST)
    const startDateTime = new Date(year, month, day, startHour, startMin, 0, 0);
    const endDateTime = new Date(year, month, day, endHour, endMin, 0, 0);

    return { startDateTime, endDateTime };
};

// Simulate formatSessionDateTime (fixed version)
const formatSessionDateTime = (date) => {
    return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
    }).format(date);
};

async function testTimeConversion() {
    log.header('Email Time/Date Fix Test');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        log.success('Connected to MongoDB');

        // Find the most recent appointment
        const appointment = await Appointment.findOne()
            .sort({ createdAt: -1 })
            .limit(1);

        if (!appointment) {
            log.error('No appointments found');
            await mongoose.connection.close();
            return;
        }

        log.info(`\nTesting with appointment ID: ${appointment._id}`);
        log.info(`Session Date (stored): ${appointment.sessionDate}`);
        log.info(`Start Time (stored): ${appointment.startTime}`);
        log.info(`End Time (stored): ${appointment.endTime}`);

        const { startDateTime, endDateTime } = getSessionDateTimes(appointment);

        log.info(`\nAfter getSessionDateTimes conversion:`);
        log.info(`Start DateTime object: ${startDateTime}`);
        log.info(`End DateTime object: ${endDateTime}`);

        const formattedDate = formatSessionDateTime(startDateTime);

        log.header('Email will show:');
        log.success(`Date & time: ${formattedDate}`);

        log.info(`\nExpected behavior:`);
        log.info(`- If booking is for 3:30 PM, email should show 3:30 PM`);
        log.info(`- If booking is for 3:15 PM, email should show 3:15 PM`);
        log.info(`- Time zone: Asia/Kolkata (IST)`);

        // Test with a specific time
        log.header('Test Case: Booking at 3:30 PM');
        const testDate = new Date('2026-05-08');
        const testAppointment = {
            sessionDate: testDate,
            startTime: '15:30',
            endTime: '16:30',
        };

        const { startDateTime: testStart } = getSessionDateTimes(testAppointment);
        const testFormatted = formatSessionDateTime(testStart);

        log.info(`Input: Session at 15:30 (3:30 PM)`);
        log.success(`Output: ${testFormatted}`);

        if (testFormatted.includes('3:30 PM')) {
            log.success('\n✓ TEST PASSED: Time is displayed correctly!');
        } else {
            log.error(`\n✗ TEST FAILED: Expected 3:30 PM but got ${testFormatted}`);
        }

        await mongoose.connection.close();
        log.success('\nDatabase connection closed');
    } catch (error) {
        log.error(`Test failed: ${error.message}`);
        console.error(error);
    }
}

testTimeConversion();
