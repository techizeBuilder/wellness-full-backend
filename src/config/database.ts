import mongoose from 'mongoose';
import logger from '../utils/logger';
import ENV from './environment';

const connectDB = async (): Promise<void> => {
  try {
    if (!ENV.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined');
    }

    const conn = await mongoose.connect(ENV.MONGODB_URI, {
      // Note: useNewUrlParser and useUnifiedTopology are defaults in Mongoose 7+
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error('Error connecting to MongoDB', error);
    process.exit(1);
  }
};

export default connectDB;

