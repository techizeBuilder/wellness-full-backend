/**
 * DEMO SEED SCRIPT
 * Creates 1 Expert + 1 User + 5 completed bookings + 5 payments
 * so Admin panel & Expert App both show real earnings/commission data.
 *
 * Run: node scripts/seed-demo-data.js
 *
 * Credentials will be printed at the end.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const COMMISSION_RATE = 20;

// ─── Mongoose models ────────────────────────────────────────────────────────
function buildModels() {
    const { Schema, model, models } = mongoose;

    const Admin = models.Admin || model('Admin', new Schema({
        name: String, email: String,
        password: { type: String, select: false },
        role: String, isActive: Boolean, isPrimary: Boolean,
        commissionRate: { type: Number, default: 20 },
    }, { strict: false }));

    const Expert = models.Expert || model('Expert', new Schema({
        firstName: String, lastName: String, email: String, phone: String,
        password: String, specialization: String, experience: Number, bio: String,
        hourlyRate: Number, verificationStatus: String, isActive: Boolean, isVerified: Boolean,
        consultationMethods: [String], sessionType: [String], languages: [String],
    }, { strict: false }));

    const User = models.User || model('User', new Schema({
        firstName: String, lastName: String, email: String, phone: String,
        password: String, isActive: Boolean, isVerified: Boolean,
    }, { strict: false }));

    const Appointment = models.Appointment || model('Appointment', new Schema({
        user: Schema.Types.ObjectId, expert: Schema.Types.ObjectId,
        sessionDate: Date, startTime: String, endTime: String,
        duration: Number, consultationMethod: String, sessionType: String,
        status: String, price: Number, paymentStatus: String,
    }, { strict: false, timestamps: true }));

    const Payment = models.Payment || model('Payment', new Schema({
        user: Schema.Types.ObjectId, expert: Schema.Types.ObjectId,
        appointment: Schema.Types.ObjectId,
        amount: Number, currency: String, status: String,
        paymentMethod: String, razorpayOrderId: String,
        razorpayPaymentId: String, description: String, paidAt: Date,
    }, { strict: false, timestamps: true }));

    return { Admin, Expert, User, Appointment, Payment };
}

// ─── Session data ────────────────────────────────────────────────────────────
const SESSIONS = [
    { daysAgo: 30, amount: 1500, method: 'video', type: 'one-on-one', start: '09:00', end: '10:00' },
    { daysAgo: 22, amount: 1200, method: 'video', type: 'one-on-one', start: '11:00', end: '12:00' },
    { daysAgo: 15, amount: 1800, method: 'audio', type: 'one-on-one', start: '14:00', end: '15:30' },
    { daysAgo: 7, amount: 1000, method: 'chat', type: 'group', start: '10:00', end: '10:45' },
    { daysAgo: 2, amount: 2000, method: 'video', type: 'one-on-one', start: '16:00', end: '17:30' },
];

const TOTAL_GROSS = SESSIONS.reduce((s, x) => s + x.amount, 0);
const TOTAL_COMM = Math.round(TOTAL_GROSS * COMMISSION_RATE / 100);
const TOTAL_NET = TOTAL_GROSS - TOTAL_COMM;

function daysAgoDate(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
    console.log('\n========================================================');
    console.log('   WELLNESS APP - DEMO DATA SEEDER');
    console.log('========================================================\n');

    await mongoose.connect(MONGO_URI, { maxPoolSize: 5 });
    console.log('Connected to MongoDB\n');

    const { Admin, Expert, User, Appointment, Payment } = buildModels();

    // ── Update commission rate on all admins ──────────────────────────────────
    const upd = await Admin.updateMany({}, { commissionRate: COMMISSION_RATE });
    console.log('Commission rate set to ' + COMMISSION_RATE + '% on ' + upd.modifiedCount + ' admin(s)');

    // ── Create Expert ─────────────────────────────────────────────────────────
    const EXPERT_EMAIL = 'demo.expert@wellness.com';
    const EXPERT_PASS = 'Expert@123';

    let expert = await Expert.findOne({ email: EXPERT_EMAIL });
    if (expert) {
        console.log('Expert already exists: ' + EXPERT_EMAIL + ' (skipping create)');
    } else {
        const now = new Date();
        expert = await Expert.create({
            firstName: 'Priya', lastName: 'Sharma',
            email: EXPERT_EMAIL,
            phone: '+917001234567',
            password: await bcrypt.hash(EXPERT_PASS, 10),
            specialization: 'Yoga & Meditation',
            experience: 8,
            bio: 'Certified yoga instructor and meditation coach with 8+ years of experience helping clients achieve mental and physical wellness.',
            hourlyRate: 1500,
            verificationStatus: 'approved',
            isActive: true, isVerified: true,
            consultationMethods: ['video', 'audio', 'chat'],
            sessionType: ['one-on-one', 'group'],
            languages: ['English', 'Hindi'],
            createdAt: now, updatedAt: now,
        });
        console.log('Expert created: ' + expert.email);
    }

    // ── Create User ───────────────────────────────────────────────────────────
    const USER_EMAIL = 'demo.user@wellness.com';
    const USER_PASS = 'User@123';

    let user = await User.findOne({ email: USER_EMAIL });
    if (user) {
        console.log('User already exists:   ' + USER_EMAIL + ' (skipping create)');
    } else {
        const now = new Date();
        user = await User.create({
            firstName: 'Rahul', lastName: 'Verma',
            email: USER_EMAIL,
            phone: '+918001234567',
            password: await bcrypt.hash(USER_PASS, 10),
            isActive: true, isVerified: true,
            createdAt: now, updatedAt: now,
        });
        console.log('User created:   ' + user.email);
    }

    // ── Create bookings + payments ────────────────────────────────────────────
    console.log('\nCreating ' + SESSIONS.length + ' sessions...\n');

    let created = 0;
    for (let i = 0; i < SESSIONS.length; i++) {
        const s = SESSIONS[i];
        const sid = Date.now() + '_' + i;

        const appt = await Appointment.create({
            user: user._id, expert: expert._id,
            sessionDate: daysAgoDate(s.daysAgo),
            startTime: s.start, endTime: s.end,
            duration: 60, consultationMethod: s.method,
            sessionType: s.type, status: 'completed',
            price: s.amount, paymentStatus: 'paid',
        });

        await Payment.create({
            user: user._id, expert: expert._id, appointment: appt._id,
            amount: s.amount, currency: 'INR', status: 'completed',
            paymentMethod: 'upi',
            razorpayOrderId: 'demo_order_' + sid,
            razorpayPaymentId: 'demo_pay_' + sid,
            description: 'Demo - ' + s.method + ' session',
            paidAt: daysAgoDate(s.daysAgo),
        });

        const comm = Math.round(s.amount * COMMISSION_RATE / 100);
        const net = s.amount - comm;
        console.log(
            '  Session ' + (i + 1) + ': Rs.' + s.amount +
            ' | Admin Rs.' + comm +
            ' | Expert Rs.' + net +
            ' (' + s.method + ', ' + s.daysAgo + ' days ago)'
        );
        created++;
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n========================================================');
    console.log('   SEEDING COMPLETE');
    console.log('========================================================');
    console.log('\nSessions created : ' + created);
    console.log('');
    console.log('FINANCIALS (20% commission):');
    console.log('  Total Gross (users paid)  : Rs.' + TOTAL_GROSS);
    console.log('  Admin Commission (20%)    : Rs.' + TOTAL_COMM);
    console.log('  Expert Net Payout (80%)   : Rs.' + TOTAL_NET);

    console.log('\n--------------------------------------------------------');
    console.log('   LOGIN CREDENTIALS');
    console.log('--------------------------------------------------------');
    console.log('\n  EXPERT APP LOGIN:');
    console.log('    Email    : ' + EXPERT_EMAIL);
    console.log('    Password : ' + EXPERT_PASS);
    console.log('    -> Go to Earnings screen -> see Net Payout = Rs.' + TOTAL_NET);

    console.log('\n  USER APP LOGIN:');
    console.log('    Email    : ' + USER_EMAIL);
    console.log('    Password : ' + USER_PASS);
    console.log('    -> Go to Bookings -> see ' + SESSIONS.length + ' completed sessions');

    console.log('\n  ADMIN PANEL:');
    console.log('    -> Go to Experts -> see Total Revenue = Rs.' + TOTAL_GROSS);
    console.log('    -> Admin Commission = Rs.' + TOTAL_COMM);
    console.log('    -> Expert Payout   = Rs.' + TOTAL_NET);
    console.log('');
    console.log('========================================================\n');

    await mongoose.disconnect();
}

seed().catch(e => {
    console.error('\nError:', e.message);
    process.exit(1);
});
