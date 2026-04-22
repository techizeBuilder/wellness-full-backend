/**
 * Dev Utility — Approve all pending experts
 * Run: node scripts/approve-experts.js
 * 
 * Use this in development when you register an expert via the app
 * but don't want to go through the OTP email flow manually.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function approveExperts() {
    console.log('🔌  Connecting to MongoDB…');
    await mongoose.connect(MONGO_URI);
    console.log('✅  Connected.\n');

    const db = mongoose.connection.db;

    // Show pending experts first
    const pending = await db.collection('experts').find(
        { verificationStatus: { $ne: 'approved' } },
        { projection: { firstName: 1, lastName: 1, email: 1, specialization: 1, verificationStatus: 1 } }
    ).toArray();

    if (pending.length === 0) {
        console.log('✅  No pending experts found. All experts are already approved.');
        await mongoose.disconnect();
        return;
    }

    console.log(`Found ${pending.length} pending expert(s):`);
    pending.forEach(e => console.log(`  - ${e.firstName} ${e.lastName} (${e.email}) → ${e.specialization}, status: ${e.verificationStatus}`));
    console.log();

    // Approve all pending
    const result = await db.collection('experts').updateMany(
        { verificationStatus: { $ne: 'approved' } },
        {
            $set: {
                verificationStatus: 'approved',
                isEmailVerified: true,
                isVerified: true,
                isActive: true,
                isAvailable: true,
            }
        }
    );

    console.log(`🎉  Approved ${result.modifiedCount} expert(s) successfully!`);
    await mongoose.disconnect();
}

approveExperts().catch(err => {
    console.error('❌  Error:', err.message);
    process.exit(1);
});
