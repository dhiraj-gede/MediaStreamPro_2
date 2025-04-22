import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import config from '../config';

// MongoDB connection string
const MONGODB_URI = config.db.uri || 'mongodb://localhost:27017/content-delivery-system';

/**
 * Connect to the MongoDB database
 */
export async function connectToDatabase(): Promise<void> {
  try {
    const options = {
      dbName: 'new_hls',
      autoIndex: true,
      maxPoolSize: 50, // Increased maxPoolSize
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000, // Added connectTimeoutMS
      socketTimeoutMS: 45000,
      family: 4,
      retryWrites: true // Added retryWrites
    };

    await mongoose.connect(MONGODB_URI, options);
    logger.info(`Connected to MongoDB: ${MONGODB_URI}`);
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    throw error;
  }
}

/**
 * Disconnect from the MongoDB database
 */
export async function disconnectFromDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error('MongoDB disconnection error:', error);
    throw error;
  }
}