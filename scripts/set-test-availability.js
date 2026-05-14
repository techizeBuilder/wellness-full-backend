/**
 * Set Test Availability for Expert
 * Creates availability schedule for testing real-time status calculation
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://193.203.161.214:27004/vedanovahealth?authSource=admin';

const expertSchema = new mongoose.Schema({}, { strict: false, collection: 'experts' });
const Expert = mongoose.model('Expert', expertSchema);

const availabilitySchema = new mongoose.Schema({}, { strict: false, collection: 'expertavailabilities' });
const ExpertAvailability = mongoose.model('ExpertAvailability', availabilitySchema);

async function setTestAvailability() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get first active expert
        const expert = await Expert.findOne({
            isActive: true,
            verificationStatus: 'approved'
        });

        if (!expert) {
            console.log('❌ No active expert found');
            return;
        }

        const expertName = `${expert.firstName || ''} ${expert.lastName || ''}`.trim();
        console.log(`📍 Setting availability for: ${expertName}`);

        // Current time info
        const now = new Date();
        const currentHour = now.getHours();

        // Set availability that includes current time
        // If current time is 14:30, set availability from 9:00 to 18:00
        const startHour = Math.max(9, currentHour - 2);
        const endHour = Math.min(20, currentHour + 3);

        const availability = [
            {
                day: 'Sunday',
                dayName: 'S',
                isOpen: false,
                timeRanges: []
            },
            {
                day: 'Monday',
                dayName: 'M',
                isOpen: true,
                timeRanges: [{ startTime: `${startHour}:00`, endTime: `${endHour}:00` }]
            },
            {
                day: 'Tuesday',
                dayName: 'T',
                isOpen: true,
                timeRanges: [{ startTime: `${startHour}:00`, endTime: `${endHour}:00` }]
            },
            {
                day: 'Wednesday',
                dayName: 'W',
                isOpen: true,
                timeRanges: [{ startTime: `${startHour}:00`, endTime: `${endHour}:00` }]
            },
            {
                day: 'Thursday',
                dayName: 'T',
                isOpen: true,
                timeRanges: [{ startTime: `${startHour}:00`, endTime: `${endHour}:00` }]
            },
            {
                day: 'Friday',
                dayName: 'F',
                isOpen: true,
                timeRanges: [{ startTime: `${startHour}:00`, endTime: `${endHour}:00` }]
            },
            {
                day: 'Saturday',
                dayName: 'S',
                isOpen: true,
                timeRanges: [{ startTime: `${startHour}:00`, endTime: `${endHour}:00` }]
            }
        ];

        await ExpertAvailability.findOneAndUpdate(
            { expert: expert._id },
            {
                expert: expert._id,
                availability: availability
            },
            { upsert: true, new: true }
        );

        console.log(`\n✅ Availability set successfully!`);
        console.log(`   Days: Monday - Saturday`);
        console.log(`   Time: ${startHour}:00 - ${endHour}:00 (includes current time)`);
        console.log(`\n   Expert should show as "Available Today" if current time is between ${startHour}:00 and ${endHour}:00`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB\n');
    }
}

setTestAvailability();
