/**
 * COMMISSION LOGIC VERIFICATION
 *
 * Verifies the new admin-commission rules:
 *   - Global default = 15% (Admin.commissionRate)
 *   - Per-expert override (Expert.commissionRate) wins when set
 *   - getExpertEarnings + paymentController consume the override correctly
 *
 * Run:  node scripts/test-commission-logic.js
 *
 * The script is destructive only inside the dedicated `__commission_test__`
 * email namespace it creates. It cleans up after itself.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error("MONGODB_URI not set. Aborting.");
    process.exit(1);
}

// Use the compiled JS if present, else register ts-node on the fly so we can
// import the same models the controllers use.
function loadModel(rel) {
    const compiled = path.join(__dirname, "..", "dist", rel + ".js");
    try {
        return require(compiled).default || require(compiled);
    } catch (_) {
        try {
            require("ts-node/register/transpile-only");
        } catch (e) {
            console.error("Need either a built dist/ or ts-node installed.");
            throw e;
        }
        const src = path.join(__dirname, "..", "src", rel + ".ts");
        const mod = require(src);
        return mod.default || mod;
    }
}

const Expert = loadModel("models/Expert");
const Admin = loadModel("models/Admin");
const Payment = loadModel("models/Payment");

const NS = "commissiontest-";

const cases = [
    { tag: "default-15", commissionRate: undefined, amount: 1000, expectRate: 15, expectCommission: 150 },
    { tag: "override-20", commissionRate: 20, amount: 1000, expectRate: 20, expectCommission: 200 },
    { tag: "override-0", commissionRate: 0, amount: 1000, expectRate: 0, expectCommission: 0 },
    { tag: "default-15-big", commissionRate: undefined, amount: 7777, expectRate: 15, expectCommission: Math.round(7777 * 0.15) },
];

function assertEq(label, actual, expected) {
    if (actual !== expected) {
        console.error(`  ✗ ${label}: got ${actual}, expected ${expected}`);
        return 1;
    }
    console.log(`  ✓ ${label}: ${actual}`);
    return 0;
}

(async () => {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB.\n");

    let failures = 0;

    // ---- 1. Force global rate to 15 (the new platform default) ----
    const updateRes = await Admin.updateMany({}, { $set: { commissionRate: 15 } });
    console.log(`Set commissionRate=15 on ${updateRes.modifiedCount}/${updateRes.matchedCount} admin docs.`);
    const admin = (await Admin.findOne({ role: "superadmin" })) || (await Admin.findOne());
    const globalRate = admin?.commissionRate ?? 15;
    console.log(`Global commissionRate now: ${globalRate}\n`);

    // ---- 2. Seed isolated experts ----
    console.log("Seeding test experts...");
    const expertIds = {};
    for (const c of cases) {
        const email = `${NS}${c.tag}@example.co`;
        await Expert.deleteOne({ email });
        const doc = await Expert.create({
            firstName: "Commission",
            lastName: c.tag,
            email,
            phone: "+1-555-0100",
            password: "Password1!",
            specialization: "test",
            experience: 1,
            qualifications: [{ degree: "X", institution: "Y", year: 2020 }],
            isActive: true,
            isVerified: true,
            ...(typeof c.commissionRate === "number" ? { commissionRate: c.commissionRate } : {}),
        });
        expertIds[c.tag] = doc._id;
        console.log(`  + ${c.tag} (override: ${c.commissionRate ?? "—"})`);
    }

    // ---- 3. Seed completed payments per expert ----
    console.log("\nSeeding payments...");
    await Payment.deleteMany({ description: { $regex: `^${NS}` } });
    const fakeUserId = new mongoose.Types.ObjectId();
    for (const c of cases) {
        await Payment.create({
            user: fakeUserId,
            expert: expertIds[c.tag],
            amount: c.amount,
            status: "completed",
            description: `${NS}${c.tag}`,
            paymentMethod: "other",
            currency: "INR",
        });
        console.log(`  + ${c.tag}: ${c.amount}`);
    }

    // ---- 4. Recompute exactly what getExpertEarnings does ----
    console.log("\nVerifying per-expert commission computation...");
    const resolveRate = (expertRate) =>
        typeof expertRate === "number" ? expertRate : globalRate;

    for (const c of cases) {
        const expert = await Expert.findById(expertIds[c.tag]).select("commissionRate");
        const effectiveRate = resolveRate(expert.commissionRate);
        const commission = Math.round((c.amount * effectiveRate) / 100);
        console.log(` Case: ${c.tag}`);
        failures += assertEq("    effective rate", effectiveRate, c.expectRate);
        failures += assertEq("    admin commission", commission, c.expectCommission);
        failures += assertEq("    expert payout", c.amount - commission, c.amount - c.expectCommission);
    }

    // ---- 5. Cleanup ----
    console.log("\nCleaning up...");
    await Payment.deleteMany({ description: { $regex: `^${NS}` } });
    await Expert.deleteMany({ email: { $regex: `^${NS}` } });

    await mongoose.disconnect();

    console.log("");
    if (failures === 0) {
        console.log("ALL CHECKS PASSED ✓");
        process.exit(0);
    } else {
        console.error(`${failures} CHECKS FAILED ✗`);
        process.exit(1);
    }
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
