/**
 * END-TO-END EARNINGS & COMMISSION TEST
 * Run: node scripts/test-earnings-flow.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const http = require('http');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const PORT = process.env.PORT || 3010;
const COMMISSION_RATE = 20;
const PAYMENT_AMOUNT = 1000;

function apiCall(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const opts = {
            hostname: 'localhost', port: PORT, path, method,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: 'Bearer ' + token } : {}),
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
            },
        };
        const req = http.request(opts, (res) => {
            let raw = '';
            res.on('data', c => (raw += c));
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
                catch { resolve({ status: res.statusCode, body: raw }); }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

let passCount = 0, failCount = 0;
const ok = (m) => { passCount++; console.log('  OK   ' + m); };
const fail = (m) => { failCount++; console.log('  FAIL ' + m); };
const sep = () => console.log('-'.repeat(60));
function assert(cond, label) { cond ? ok(label) : fail(label); }

function buildModels() {
    const { Schema, model, models } = mongoose;

    const Admin = models.Admin || model('Admin', new Schema({
        name: String, email: String,
        password: { type: String, select: false },
        role: String, isActive: Boolean, isPrimary: Boolean,
        commissionRate: { type: Number, default: 20 }
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
        appointment: Schema.Types.ObjectId, amount: Number, currency: String,
        status: String, paymentMethod: String, razorpayOrderId: String,
        razorpayPaymentId: String, description: String, paidAt: Date,
    }, { strict: false, timestamps: true }));

    return { Admin, Expert, User, Appointment, Payment };
}

async function run() {
    console.log('\nEARNINGS & COMMISSION - END-TO-END TEST');
    console.log('Server: http://localhost:' + PORT + '  Commission: ' + COMMISSION_RATE + '%  Payment: Rs.' + PAYMENT_AMOUNT);
    sep();

    // 1. Connect
    console.log('\n[1] Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, { maxPoolSize: 5 });
    ok('Connected');

    const { Admin, Expert, User, Appointment, Payment } = buildModels();

    // 2. Set commission rate
    console.log('\n[2] Setting commission rate to 20%...');
    const upd = await Admin.updateMany({}, { commissionRate: COMMISSION_RATE });
    ok('Updated ' + upd.modifiedCount + ' admin(s)');

    // 3. Create expert
    sep();
    console.log('\n[3] Creating test expert (approved, active)...');
    const ts = Date.now();
    const EXPERT_EMAIL = 'test.expert.' + ts + '@wellness-test.com';
    const EXPERT_PASS = 'Test@12345';
    const hash = await bcrypt.hash(EXPERT_PASS, 10);

    const testExpert = await Expert.create({
        firstName: 'TestExpert', lastName: 'Demo', email: EXPERT_EMAIL,
        phone: '+91700' + ts.toString().slice(-7), password: hash,
        specialization: 'Yoga', experience: 5, bio: 'Test expert', hourlyRate: 1000,
        verificationStatus: 'approved', isActive: true, isVerified: true,
        consultationMethods: ['video'], sessionType: ['one-on-one'], languages: ['English'],
    });
    ok('Expert -> ' + testExpert.email + '  (ID: ' + testExpert._id + ')');
    assert(testExpert.verificationStatus === 'approved', 'Expert is approved');
    assert(testExpert.isActive === true, 'Expert is active');

    // 4. Create user
    sep();
    console.log('\n[4] Creating test user...');
    const USER_EMAIL = 'test.user.' + ts + '@wellness-test.com';
    const testUser = await User.create({
        firstName: 'TestUser', lastName: 'Demo', email: USER_EMAIL,
        phone: '+91800' + ts.toString().slice(-7), password: hash,
        isActive: true, isVerified: true,
    });
    ok('User -> ' + testUser.email + '  (ID: ' + testUser._id + ')');

    // 5. Admin login (create fresh test admin)
    sep();
    console.log('\n[5] Creating test admin and logging in...');
    const adminPass = 'TestAdmin@' + ts.toString().slice(-4);
    const adminEmail = 'test.admin.' + ts + '@wellness-test.com';
    await Admin.create({
        name: 'TestAdmin', email: adminEmail,
        password: await bcrypt.hash(adminPass, 10),
        role: 'superadmin', isActive: true, isPrimary: false,
        commissionRate: COMMISSION_RATE,
    });
    ok('Admin created: ' + adminEmail);

    let adminToken = null;
    const loginR = await apiCall('POST', '/api/admin/auth/login', { email: adminEmail, password: adminPass });
    if (loginR.status === 200 && loginR.body.success) {
        adminToken = loginR.body.data && loginR.body.data.token;
        ok('Admin logged in');
    } else {
        fail('Admin login failed: ' + JSON.stringify(loginR.body));
    }
    assert(!!adminToken, 'Admin token obtained');

    // 6. Expert login
    sep();
    console.log('\n[6] Expert login...');
    let expertToken = null;
    const loginPaths = ['/api/auth/login', '/api/experts/login', '/api/auth/unified-login'];
    for (const ep of loginPaths) {
        const r = await apiCall('POST', ep, { email: EXPERT_EMAIL, password: EXPERT_PASS });
        if (r.status === 200 && r.body.success) {
            expertToken = (r.body.data && r.body.data.token) || r.body.token;
            ok('Expert logged in via ' + ep);
            break;
        }
    }
    assert(!!expertToken, 'Expert token obtained');

    // 7. Create appointment
    sep();
    console.log('\n[7] Creating completed appointment in DB...');
    const appt = await Appointment.create({
        user: testUser._id, expert: testExpert._id,
        sessionDate: new Date(Date.now() - 86400000),
        startTime: '10:00', endTime: '11:00', duration: 60,
        consultationMethod: 'video', sessionType: 'one-on-one',
        status: 'completed', price: PAYMENT_AMOUNT, paymentStatus: 'paid',
    });
    ok('Appointment -> ' + appt._id + '  price: Rs.' + appt.price);
    assert(appt.status === 'completed', 'Appointment status = completed');

    // 8. Create payment
    sep();
    console.log('\n[8] Creating completed payment (Rs.' + PAYMENT_AMOUNT + ')...');
    const payment = await Payment.create({
        user: testUser._id, expert: testExpert._id, appointment: appt._id,
        amount: PAYMENT_AMOUNT, currency: 'INR', status: 'completed',
        paymentMethod: 'upi',
        razorpayOrderId: 'order_test_' + ts,
        razorpayPaymentId: 'pay_test_' + ts,
        description: 'Test session payment',
        paidAt: new Date(),
    });
    ok('Payment -> ' + payment._id + '  Rs.' + payment.amount + '  status: ' + payment.status);
    assert(payment.status === 'completed', 'Payment status = completed');

    // 9. Expert earnings API
    sep();
    console.log('\n[9] Testing GET /api/payments/expert/earnings...');
    if (expertToken) {
        const r = await apiCall('GET', '/api/payments/expert/earnings', null, expertToken);
        console.log('    HTTP ' + r.status);
        if (r.status === 200 && r.body.success) {
            const d = r.body.data;
            const expComm = Math.round(PAYMENT_AMOUNT * COMMISSION_RATE / 100);
            const expNet = PAYMENT_AMOUNT - expComm;
            console.log('\n    EXPERT EARNINGS:');
            console.log('    Gross Total    : Rs.' + d.total);
            console.log('    Net Total      : Rs.' + d.netTotal + '  <-- expert gets this');
            console.log('    Commission Rate: ' + d.commissionRate + '%');
            console.log('    Commission Ded : Rs.' + d.totalCommissionDeducted);
            console.log('    Net This Month : Rs.' + d.netMonthly);
            console.log('    Net This Week  : Rs.' + d.netWeekly);
            assert(d.total >= PAYMENT_AMOUNT, 'Gross >= Rs.' + PAYMENT_AMOUNT);
            assert(d.netTotal >= expNet, 'Net >= Rs.' + expNet);
            assert(d.commissionRate === COMMISSION_RATE, 'commissionRate = ' + COMMISSION_RATE + '%');
            assert(d.totalCommissionDeducted >= expComm, 'commission >= Rs.' + expComm);
            const calcNet = d.total - Math.round(d.total * d.commissionRate / 100);
            assert(d.netTotal === calcNet,
                'Net = Gross - Commission: Rs.' + d.total + ' - Rs.' + d.totalCommissionDeducted + ' = Rs.' + d.netTotal);
        } else {
            fail('Expert earnings API: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
        }
    } else {
        fail('No expert token - skipping expert earnings test');
    }

    // 10. Admin earnings API
    sep();
    console.log('\n[10] Testing GET /api/admin/experts/earnings...');
    if (adminToken) {
        const r = await apiCall('GET', '/api/admin/experts/earnings', null, adminToken);
        console.log('    HTTP ' + r.status);
        if (r.status === 200 && r.body.success) {
            const list = r.body.data.experts;
            const summary = r.body.data.summary;
            console.log('\n    ADMIN EARNINGS SUMMARY:');
            console.log('    Total Revenue   : Rs.' + summary.totalRevenue);
            console.log('    Admin Commission: Rs.' + summary.totalCommission);
            console.log('    Expert Payouts  : Rs.' + summary.totalExpertPayouts);
            console.log('    Commission Rate : ' + summary.commissionRate + '%');
            console.log('    Experts in list : ' + list.length);

            const mine = list.find(function (e) {
                return e.expertId && e.expertId.toString() === testExpert._id.toString();
            });

            if (mine) {
                console.log('\n    TEST EXPERT IN ADMIN TABLE:');
                console.log('    Name            : ' + mine.name);
                console.log('    Gross Amount    : Rs.' + mine.totalAmount);
                console.log('    Admin Commission: Rs.' + mine.adminCommission);
                console.log('    Expert Payout   : Rs.' + mine.expertPayout);
                console.log('    Sessions        : ' + mine.sessionCount);
                assert(mine.totalAmount >= PAYMENT_AMOUNT, 'Admin sees gross >= Rs.' + PAYMENT_AMOUNT);
                assert(mine.adminCommission === Math.round(mine.totalAmount * COMMISSION_RATE / 100),
                    'adminCommission = ' + COMMISSION_RATE + '% of gross');
                assert(mine.expertPayout === mine.totalAmount - mine.adminCommission,
                    'expertPayout = gross - commission');
                assert(mine.sessionCount >= 1, 'sessionCount >= 1');
            } else {
                fail('Test expert not found in admin earnings list');
            }

            assert(summary.totalRevenue > 0, 'summary totalRevenue > 0');
            assert(summary.totalCommission > 0, 'summary totalCommission > 0');
            assert(summary.commissionRate === COMMISSION_RATE,
                'summary commissionRate = ' + COMMISSION_RATE + '%');
            assert(
                summary.totalRevenue === summary.totalCommission + summary.totalExpertPayouts,
                'Revenue = Commission + ExpertPayouts'
            );
        } else {
            fail('Admin earnings: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
        }
    } else {
        fail('No admin token - skipping admin earnings test');
    }

    // 11. Admin stats API
    sep();
    console.log('\n[11] Testing GET /api/admin/experts/stats...');
    if (adminToken) {
        const r = await apiCall('GET', '/api/admin/experts/stats', null, adminToken);
        console.log('    HTTP ' + r.status);
        if (r.status === 200 && r.body.success) {
            const s = r.body.data.stats;
            console.log('\n    ADMIN STATS:');
            console.log('    Total Experts   : ' + s.totalExperts);
            console.log('    Total Revenue   : Rs.' + s.totalRevenue);
            console.log('    Total Commission: Rs.' + s.totalCommission);
            console.log('    Commission Rate : ' + s.commissionRate + '%');
            assert(s.totalRevenue > 0, 'stats.totalRevenue > 0');
            assert(s.totalCommission > 0, 'stats.totalCommission > 0');
            assert(s.commissionRate === COMMISSION_RATE, 'stats.commissionRate = ' + COMMISSION_RATE + '%');
        } else {
            fail('Stats API: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
        }
    }

    // 12. Cleanup
    sep();
    console.log('\n[12] Cleaning up test data...');
    await Payment.deleteOne({ _id: payment._id });
    await Appointment.deleteOne({ _id: appt._id });
    await User.deleteOne({ _id: testUser._id });
    await Expert.deleteOne({ _id: testExpert._id });
    await Admin.deleteOne({ email: adminEmail });
    ok('All test data removed from DB');

    // Summary
    sep();
    console.log('\nTEST SUMMARY');
    console.log('Passed : ' + passCount);
    console.log('Failed : ' + failCount);
    console.log('Total  : ' + (passCount + failCount));
    if (failCount === 0) {
        console.log('\nALL TESTS PASSED!\n');
    } else {
        console.log('\n' + failCount + ' test(s) FAILED - see above.\n');
    }

    await mongoose.disconnect();
    process.exit(failCount > 0 ? 1 : 0);
}

run().catch(function (e) {
    console.error('\nFatal error:', e.message);
    console.error(e.stack);
    process.exit(1);
});
