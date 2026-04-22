/**
 * Seed Script — Creates 6 demo experts with verificationStatus: 'approved'
 * Run: node scripts/seed-experts.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ── DB connection (same as your backend) ─────────────────────────────────────
const MONGO_URI =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://193.203.161.214:27004/vedanovahealth?authSource=admin';

// ── Expert data ───────────────────────────────────────────────────────────────
const experts = [
    {
        firstName: 'Ananya',
        lastName: 'Sharma',
        email: 'ananya.sharma@vedanova.com',
        phone: '+919876543201',
        specialization: 'Yoga',
        experience: 8,
        bio: 'Certified Hatha & Vinyasa yoga instructor with 8 years of experience helping clients achieve mind-body balance.',
        hourlyRate: 800,
        languages: ['English', 'Hindi'],
        consultationMethods: ['video', 'chat'],
        sessionType: ['one-on-one', 'one-to-many'],
        specialties: ['Hatha Yoga', 'Vinyasa', 'Pranayama'],
        rating: { average: 4.8, count: 120 },
        totalSessions: 340,
        qualifications: [{ degree: 'B.Sc Yoga Science', institution: 'Morarji Desai National Institute', year: 2016 }],
        certifications: [{ name: 'RYT-500 Yoga Alliance', issuingOrganization: 'Yoga Alliance International', issueDate: new Date('2017-03-01') }],
    },
    {
        firstName: 'Rohan',
        lastName: 'Verma',
        email: 'rohan.verma@vedanova.com',
        phone: '+919876543202',
        specialization: 'Ayurveda',
        experience: 12,
        bio: 'Ayurvedic practitioner specialising in Panchakarma, herbal medicine and holistic wellness.',
        hourlyRate: 1200,
        languages: ['English', 'Hindi', 'Sanskrit'],
        consultationMethods: ['video', 'audio'],
        sessionType: ['one-on-one'],
        specialties: ['Panchakarma', 'Herbal Medicine', 'Detox'],
        rating: { average: 4.9, count: 95 },
        totalSessions: 280,
        qualifications: [{ degree: 'BAMS', institution: 'Rajiv Gandhi Ayurveda University', year: 2012 }],
    },
    {
        firstName: 'Priya',
        lastName: 'Nair',
        email: 'priya.nair@vedanova.com',
        phone: '+919876543203',
        specialization: 'Mental Health',
        experience: 6,
        bio: 'Certified counsellor and mindfulness coach helping individuals overcome anxiety, stress and burnout.',
        hourlyRate: 1500,
        languages: ['English', 'Malayalam'],
        consultationMethods: ['video', 'chat'],
        sessionType: ['one-on-one'],
        specialties: ['Anxiety', 'Stress Management', 'Mindfulness CBT'],
        rating: { average: 4.7, count: 80 },
        totalSessions: 210,
        qualifications: [{ degree: 'M.Sc Clinical Psychology', institution: 'NIMHANS', year: 2018 }],
    },
    {
        firstName: 'Arjun',
        lastName: 'Mehta',
        email: 'arjun.mehta@vedanova.com',
        phone: '+919876543204',
        specialization: 'Fitness',
        experience: 5,
        bio: 'Certified personal trainer focused on functional fitness, weight loss and strength conditioning.',
        hourlyRate: 700,
        languages: ['English', 'Gujarati'],
        consultationMethods: ['video'],
        sessionType: ['one-on-one', 'one-to-many'],
        specialties: ['Weight Loss', 'Strength Training', 'HIIT'],
        rating: { average: 4.6, count: 65 },
        totalSessions: 180,
        qualifications: [{ degree: 'ACE Certified Personal Trainer', institution: 'American Council on Exercise', year: 2019 }],
    },
    {
        firstName: 'Meera',
        lastName: 'Iyer',
        email: 'meera.iyer@vedanova.com',
        phone: '+919876543205',
        specialization: 'Nutrition',
        experience: 7,
        bio: 'Registered dietitian and nutrition coach helping clients build sustainable healthy eating habits.',
        hourlyRate: 900,
        languages: ['English', 'Tamil'],
        consultationMethods: ['video', 'chat'],
        sessionType: ['one-on-one'],
        specialties: ['Diet Planning', 'Weight Management', 'Sports Nutrition'],
        rating: { average: 4.8, count: 110 },
        totalSessions: 295,
        qualifications: [{ degree: 'M.Sc Clinical Nutrition', institution: 'All India Institute of Medical Sciences', year: 2017 }],
    },
    {
        firstName: 'Karan',
        lastName: 'Joshi',
        email: 'karan.joshi@vedanova.com',
        phone: '+919876543206',
        specialization: 'Astrology',
        experience: 10,
        bio: 'Vedic astrologer with a decade of experience in natal chart reading, career guidance and relationship counselling.',
        hourlyRate: 1000,
        languages: ['English', 'Hindi', 'Marathi'],
        consultationMethods: ['video', 'audio', 'chat'],
        sessionType: ['one-on-one'],
        specialties: ['Vedic Astrology', 'Natal Charts', 'Career Guidance'],
        rating: { average: 4.5, count: 75 },
        totalSessions: 220,
        qualifications: [{ degree: 'Jyotish Visharad', institution: 'Bharatiya Vidya Bhavan', year: 2014 }],
    },
];

// ── Minimal schema (mirrors Expert.ts — only fields we need) ─────────────────
const expertSchema = new mongoose.Schema({}, { strict: false });
const Expert = mongoose.models.Expert || mongoose.model('Expert', expertSchema, 'experts');

async function seed() {
    console.log('🔌  Connecting to MongoDB…');
    await mongoose.connect(MONGO_URI);
    console.log('✅  Connected.\n');

    const password = await bcrypt.hash('Expert@123', 12);

    let created = 0;
    let skipped = 0;

    for (const data of experts) {
        const exists = await Expert.findOne({ email: data.email });
        if (exists) {
            console.log(`⚠️   Skipped (already exists): ${data.email}`);
            skipped++;
            continue;
        }

        await Expert.create({
            ...data,
            password,
            userType: 'expert',
            isActive: true,
            isAvailable: true,
            isEmailVerified: true,
            isPhoneVerified: true,
            isProfileComplete: true,
            isVerified: true,
            verificationStatus: 'approved',
            availability: {
                monday: { start: '09:00', end: '18:00', available: true },
                tuesday: { start: '09:00', end: '18:00', available: true },
                wednesday: { start: '09:00', end: '18:00', available: true },
                thursday: { start: '09:00', end: '18:00', available: true },
                friday: { start: '09:00', end: '18:00', available: true },
                saturday: { start: '10:00', end: '14:00', available: true },
                sunday: { start: '00:00', end: '00:00', available: false },
            },
        });

        console.log(`✅  Created: ${data.firstName} ${data.lastName} (${data.specialization})`);
        created++;
    }

    console.log(`\n🎉  Done! Created: ${created}, Skipped: ${skipped}`);
    await mongoose.disconnect();
}

seed().catch((err) => {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
});
