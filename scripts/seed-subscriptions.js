const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected for seeding subscriptions');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const subscriptions = [
  {
    name: 'Basic Plan',
    description: 'Perfect for individuals getting started with wellness coaching',
    price: 29.99,
    duration: 1,
    durationType: 'months',
    type: 'basic',
    features: [
      'Access to 1 expert',
      'Up to 5 sessions per month',
      'Chat support',
      'Basic wellness resources'
    ],
    maxExperts: 1,
    maxSessions: 5,
    hasVideoCall: false,
    hasChat: true,
    hasGroupSessions: false,
    priority: 1,
    isActive: true,
    isPopular: false
  },
  {
    name: 'Premium Plan',
    description: 'Most popular plan with enhanced features and more access',
    price: 59.99,
    duration: 1,
    durationType: 'months',
    type: 'premium',
    features: [
      'Access to up to 3 experts',
      'Up to 15 sessions per month',
      'Video calls included',
      'Chat support',
      'Priority booking',
      'Premium wellness resources',
      'Group session access'
    ],
    maxExperts: 3,
    maxSessions: 15,
    hasVideoCall: true,
    hasChat: true,
    hasGroupSessions: true,
    priority: 2,
    isActive: true,
    isPopular: true
  },
  {
    name: 'Enterprise Plan',
    description: 'Comprehensive plan for organizations and teams',
    price: 199.99,
    duration: 1,
    durationType: 'months',
    type: 'enterprise',
    features: [
      'Access to all experts',
      'Unlimited sessions',
      'Video calls included',
      'Chat support',
      'Priority booking',
      'Premium wellness resources',
      'Group session access',
      'Team management dashboard',
      'Custom wellness programs',
      'Dedicated account manager'
    ],
    maxExperts: 999,
    maxSessions: 999,
    hasVideoCall: true,
    hasChat: true,
    hasGroupSessions: true,
    priority: 3,
    isActive: true,
    isPopular: false
  },
  {
    name: 'Free Trial',
    description: '7-day free trial to explore our platform',
    price: 0,
    duration: 7,
    durationType: 'days',
    type: 'trial',
    features: [
      'Access to 1 expert',
      'Up to 2 sessions',
      'Chat support',
      'Basic wellness resources'
    ],
    maxExperts: 1,
    maxSessions: 2,
    hasVideoCall: false,
    hasChat: true,
    hasGroupSessions: false,
    priority: 0,
    isActive: true,
    isPopular: false
  }
];

const seedSubscriptions = async () => {
  try {
    await connectDB();
    
    console.log('Clearing existing subscriptions...');
    await Subscription.deleteMany({});
    
    console.log('Seeding subscriptions...');
    for (const subData of subscriptions) {
      const subscription = await Subscription.create(subData);
      console.log(`✓ Created subscription: ${subscription.name}`);
    }
    
    console.log(`\n🎉 Successfully seeded ${subscriptions.length} subscriptions!`);
    
    // Display summary
    const activeSubscriptions = await Subscription.find({ isActive: true });
    console.log(`\n📊 Summary:`);
    console.log(`- Total subscriptions: ${activeSubscriptions.length}`);
    console.log(`- Price range: $${Math.min(...activeSubscriptions.map(s => s.price))} - $${Math.max(...activeSubscriptions.map(s => s.price))}`);
    console.log(`- Popular plan: ${activeSubscriptions.find(s => s.isPopular)?.name || 'None'}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding subscriptions:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedSubscriptions();
}

module.exports = { seedSubscriptions, subscriptions };