const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Expert model schema (minimal version for updates)
const expertSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  verificationStatus: String,
  isActive: Boolean
}, { timestamps: true });

const Expert = mongoose.model('Expert', expertSchema);

const updateExperts = async () => {
  try {
    await connectDB();
    
    console.log('Updating all experts to approved status...');
    
    // Update all experts to have approved verification status
    const result = await Expert.updateMany(
      {},
      { 
        $set: { 
          verificationStatus: 'approved',
          isActive: true,
          isEmailVerified: true,
          isPhoneVerified: true
        } 
      }
    );
    
    console.log(`Updated ${result.modifiedCount} experts to approved status`);
    
    // List all experts
    const allExperts = await Expert.find({}, 'firstName lastName email verificationStatus isActive');
    console.log('\nAll experts in database:');
    allExperts.forEach(expert => {
      console.log(`- ${expert.firstName} ${expert.lastName} (${expert.email}) - Status: ${expert.verificationStatus}, Active: ${expert.isActive}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating experts:', error);
    process.exit(1);
  }
};

updateExperts();