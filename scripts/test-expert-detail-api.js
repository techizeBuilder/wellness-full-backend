/**
 * Test Script — Verify Expert Detail API returns all required fields
 * Run: node scripts/test-expert-detail-api.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const BASE_URL = 'http://127.0.0.1:3010/api';
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function fetchJSON(url) {
    const res = await fetch(url);
    const text = await res.text();
    try {
        return { status: res.status, data: JSON.parse(text) };
    } catch {
        return { status: res.status, data: null, raw: text.slice(0, 300) };
    }
}

function check(label, value, required = false) {
    const hasValue =
        value !== null &&
        value !== undefined &&
        value !== '' &&
        !(Array.isArray(value) && value.length === 0);
    const status = hasValue ? '✅' : required ? '❌' : '⚠️ ';
    console.log(`  ${status}  ${label}: ${JSON.stringify(value)}`);
    return hasValue;
}

async function run() {
    // 1. Get all approved experts
    console.log('\n══════════════════════════════════════════');
    console.log(' STEP 1: GET /api/experts (list)');
    console.log('══════════════════════════════════════════');

    const listRes = await fetchJSON(`${BASE_URL}/experts?limit=10`);
    if (!listRes.data?.success) {
        console.error('❌  List API failed:', listRes);
        process.exit(1);
    }

    const experts = listRes.data.data?.experts || [];
    console.log(`✅  Total experts returned: ${experts.length}`);
    console.log('   Experts:', experts.map(e => `${e.firstName} ${e.lastName} (${e.specialization})`).join(', '));

    if (experts.length === 0) {
        console.error('❌  No experts returned. Check verificationStatus/isActive filters in backend.');
        process.exit(1);
    }

    // 2. Test detail API for each expert
    for (const expertSummary of experts) {
        const id = expertSummary._id;
        console.log(`\n══════════════════════════════════════════`);
        console.log(` STEP 2: GET /api/experts/${id}`);
        console.log(` Expert: ${expertSummary.firstName} ${expertSummary.lastName}`);
        console.log('══════════════════════════════════════════');

        const detailRes = await fetchJSON(`${BASE_URL}/experts/${id}`);
        if (!detailRes.data?.success) {
            console.error('❌  Detail API failed:', detailRes);
            continue;
        }

        const e = detailRes.data.data?.expert;

        console.log('\n  — Basic Info —');
        check('firstName', e.firstName, true);
        check('lastName', e.lastName, true);
        check('specialization', e.specialization, true);
        check('experience', e.experience);
        check('hourlyRate', e.hourlyRate);
        check('rating.average', e.rating?.average);
        check('rating.count', e.rating?.count);
        check('verificationStatus', e.verificationStatus, true);
        check('isActive', e.isActive, true);
        check('isEmailVerified', e.isEmailVerified, true);

        console.log('\n  — Detail Fields (shown in Expert Details modal) —');
        check('bio (About)', e.bio);
        check('education', e.education);
        check('languages', e.languages);
        check('consultationMethods (Session Types)', e.consultationMethods);
        check('specialties[]', e.specialties);
        check('qualifications[]', e.qualifications);
        check('certifications[] (structured)', e.certifications);
        check('certificates[] (uploaded files)', e.certificates);

        // Which certifications will show?
        const structuredCerts = (e.certifications || []).filter(c => c.name || c.issuingOrganization);
        const uploadedCerts = (e.certificates || []).filter(c => c.originalName || c.filename);
        if (structuredCerts.length > 0) {
            console.log(`  ✅  Will show ${structuredCerts.length} structured certification(s): ${structuredCerts.map(c => c.name || c.issuingOrganization).join(', ')}`);
        } else if (uploadedCerts.length > 0) {
            console.log(`  ✅  Will show ${uploadedCerts.length} uploaded certificate file(s): ${uploadedCerts.map(c => c.originalName || c.filename).join(', ')}`);
        } else {
            console.log(`  ⚠️   Certifications: will show "Not available"`);
        }

        console.log('\n  — Availability —');
        check('availability', e.availability);
    }

    console.log('\n══════════════════════════════════════════');
    console.log(' DONE');
    console.log('══════════════════════════════════════════\n');
}

run().catch(err => {
    console.error('\n❌  Test script error:', err.message);
    process.exit(1);
});
