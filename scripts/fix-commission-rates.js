/**
 * Dev Utility — Fix / Audit Expert Commission Rates
 *
 * Platform rule:
 *   - Global default: 15% (stored on Admin.commissionRate)
 *   - Per-expert override: Expert.commissionRate (e.g. 20 for select experts)
 *   - If Expert.commissionRate is null/undefined, the global rate applies.
 *
 * Modes (safe by default — no writes unless --apply is passed):
 *   node scripts/fix-commission-rates.js
 *      → Report-only. Shows current Admin.commissionRate and every expert's rate.
 *
 *   node scripts/fix-commission-rates.js --apply
 *      → Sets Admin.commissionRate = 15 on all admin docs (does not touch experts).
 *
 *   node scripts/fix-commission-rates.js --apply --twenty=a@x.com,b@x.com
 *      → Same as above + sets the listed experts (by email) to commissionRate = 20.
 *
 *   node scripts/fix-commission-rates.js --apply --reset-overrides
 *      → DANGEROUS: clears every Expert.commissionRate so all experts fall back to 15.
 *        Use only if you want to wipe all per-expert overrides.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error('❌  MONGODB_URI not set in env. Aborting.');
    process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const RESET_OVERRIDES = args.includes('--reset-overrides');
const twentyArg = args.find(a => a.startsWith('--twenty='));
const TWENTY_EMAILS = twentyArg
    ? twentyArg.replace('--twenty=', '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : [];

const GLOBAL_RATE = 15;
const OVERRIDE_RATE = 20;

(async () => {
    console.log('🔌  Connecting to MongoDB…');
    await mongoose.connect(MONGO_URI);
    console.log('✅  Connected.\n');

    const db = mongoose.connection.db;
    const admins = db.collection('admins');
    const experts = db.collection('experts');

    // ---- 1. Audit current state ----
    console.log('── Current Admin commissionRate ──');
    const adminDocs = await admins.find({}, { projection: { email: 1, role: 1, commissionRate: 1 } }).toArray();
    if (adminDocs.length === 0) {
        console.log('  (no admin documents found)');
    } else {
        adminDocs.forEach(a => {
            console.log(`  - ${a.role || 'admin'}  ${a.email || '(no email)'}  → ${a.commissionRate ?? '(unset, falls back to 15)'}`);
        });
    }

    console.log('\n── Per-expert commissionRate (overrides) ──');
    const allExperts = await experts.find(
        {},
        { projection: { firstName: 1, lastName: 1, email: 1, commissionRate: 1 } }
    ).toArray();

    const withOverride = allExperts.filter(e => typeof e.commissionRate === 'number');
    const withoutOverride = allExperts.filter(e => typeof e.commissionRate !== 'number');

    console.log(`  Total experts: ${allExperts.length}`);
    console.log(`  With explicit commissionRate: ${withOverride.length}`);
    console.log(`  Using global default: ${withoutOverride.length}`);

    if (withOverride.length > 0) {
        console.log('\n  Explicit overrides:');
        withOverride
            .sort((a, b) => (b.commissionRate || 0) - (a.commissionRate || 0))
            .forEach(e => {
                console.log(`    • ${e.commissionRate}%  ${e.firstName || ''} ${e.lastName || ''}  <${e.email}>`);
            });
    }

    if (!APPLY) {
        console.log('\nℹ️   Report-only mode. Re-run with --apply to write changes.');
        await mongoose.disconnect();
        return;
    }

    // ---- 2. Set global Admin.commissionRate = 15 ----
    console.log(`\n✏️   Setting Admin.commissionRate = ${GLOBAL_RATE} on all admin docs…`);
    const adminRes = await admins.updateMany({}, { $set: { commissionRate: GLOBAL_RATE } });
    console.log(`    matched: ${adminRes.matchedCount}, modified: ${adminRes.modifiedCount}`);

    // ---- 3. Optionally clear all per-expert overrides ----
    if (RESET_OVERRIDES) {
        console.log('\n⚠️   --reset-overrides passed: clearing Expert.commissionRate on ALL experts…');
        const clearRes = await experts.updateMany(
            { commissionRate: { $exists: true } },
            { $unset: { commissionRate: '' } }
        );
        console.log(`    cleared overrides on ${clearRes.modifiedCount} expert(s).`);
    }

    // ---- 4. Set the listed emails to 20% ----
    if (TWENTY_EMAILS.length > 0) {
        console.log(`\n✏️   Setting commissionRate = ${OVERRIDE_RATE} for ${TWENTY_EMAILS.length} expert(s)…`);
        const r = await experts.updateMany(
            { email: { $in: TWENTY_EMAILS } },
            { $set: { commissionRate: OVERRIDE_RATE } }
        );
        console.log(`    matched: ${r.matchedCount}, modified: ${r.modifiedCount}`);
        if (r.matchedCount < TWENTY_EMAILS.length) {
            const found = await experts
                .find({ email: { $in: TWENTY_EMAILS } }, { projection: { email: 1 } })
                .toArray();
            const foundSet = new Set(found.map(f => f.email));
            const missing = TWENTY_EMAILS.filter(e => !foundSet.has(e));
            if (missing.length) console.log(`    ⚠️   not found: ${missing.join(', ')}`);
        }
    }

    // ---- 5. Final state ----
    console.log('\n── Final state ──');
    const finalAdmins = await admins.find({}, { projection: { email: 1, role: 1, commissionRate: 1 } }).toArray();
    finalAdmins.forEach(a => {
        console.log(`  Admin ${a.role || ''} ${a.email || ''} → ${a.commissionRate}%`);
    });
    const finalOverrides = await experts
        .find({ commissionRate: { $exists: true } }, { projection: { email: 1, commissionRate: 1 } })
        .toArray();
    console.log(`  Experts with explicit override: ${finalOverrides.length}`);
    finalOverrides.forEach(e => console.log(`    • ${e.commissionRate}%  <${e.email}>`));

    await mongoose.disconnect();
    console.log('\n✅  Done.');
})().catch(err => {
    console.error('❌  Error:', err);
    process.exit(1);
});
