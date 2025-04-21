import mongoose from 'mongoose';
import { logger } from '../utils/logger';

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/content-delivery-system';

/**
 * Connect to the MongoDB database
 */
export async function connectToDatabase(): Promise<void> {
  try {
    const options = {
      autoIndex: true, // Build indexes
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4 // Use IPv4, skip trying IPv6
    };

    // Check if we're in a testing environment and use a mock if needed
    if (process.env.NODE_ENV === 'test') {
      logger.info('Using mock MongoDB for testing');
      return;
    }

    // Use memory server for development if real MongoDB is not available
    if (process.env.NODE_ENV === 'development' && !process.env.MONGODB_URI) {
      logger.warn('No MongoDB URI provided, using memory server for development');
      // In a real application, you might use mongodb-memory-server here
    }
    
    // Connect to the database
    await mongoose.connect(MONGODB_URI);
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