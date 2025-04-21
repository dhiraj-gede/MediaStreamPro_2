import mongoose from 'mongoose';
import { logger } from '../utils/logger';

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/content-delivery-system';

/**
 * Mock memory storage for development without MongoDB
 */
class MemoryMongoStore {
  private collections: Map<string, any[]>;

  constructor() {
    this.collections = new Map();
    logger.info('Initialized Memory MongoDB Store');
  }

  getCollection(name: string): any[] {
    if (!this.collections.has(name)) {
      this.collections.set(name, []);
    }
    return this.collections.get(name) || [];
  }

  addToCollection(name: string, document: any): any {
    const collection = this.getCollection(name);
    const id = new mongoose.Types.ObjectId();
    const newDoc = { ...document, _id: id };
    collection.push(newDoc);
    this.collections.set(name, collection);
    return newDoc;
  }

  findInCollection(name: string, query: any): any[] {
    const collection = this.getCollection(name);
    // Very simple query implementation
    return collection.filter(doc => {
      for (const key in query) {
        if (doc[key] !== query[key]) {
          return false;
        }
      }
      return true;
    });
  }

  updateInCollection(name: string, query: any, update: any): number {
    const collection = this.getCollection(name);
    let count = 0;
    
    collection.forEach((doc, index) => {
      let match = true;
      for (const key in query) {
        if (doc[key] !== query[key]) {
          match = false;
          break;
        }
      }
      
      if (match) {
        collection[index] = { ...doc, ...update };
        count++;
      }
    });
    
    this.collections.set(name, collection);
    return count;
  }

  deleteFromCollection(name: string, query: any): number {
    const collection = this.getCollection(name);
    const initialLength = collection.length;
    
    const filtered = collection.filter(doc => {
      for (const key in query) {
        if (doc[key] === query[key]) {
          return false;
        }
      }
      return true;
    });
    
    this.collections.set(name, filtered);
    return initialLength - filtered.length;
  }

  clear(): void {
    this.collections.clear();
  }
}

// Create the in-memory store
const memoryStore = new MemoryMongoStore();

/**
 * Configure mongoose to use the in-memory store
 */
function setupMemoryServer(): void {
  logger.warn('Using in-memory MongoDB mock - data will not persist between restarts');
  
  // Define types to satisfy TypeScript
  type ModelMethodThis = {
    constructor: { modelName: string };
    toObject: () => any;
  };
  
  type QueryReturn = {
    exec: () => Promise<any>;
    lean: () => QueryReturn;
    select: (fields: string) => QueryReturn;
    sort: (options: any) => QueryReturn;
    limit: (n: number) => QueryReturn;
    skip: (n: number) => QueryReturn;
  };
  
  // A safe way to mock methods on objects we don't control
  const safeOverride = <T extends object, K extends keyof T>(
    obj: T, 
    key: K, 
    value: any
  ): void => {
    // Use defineProperty to override methods safely
    Object.defineProperty(obj, key, {
      value,
      writable: true,
      configurable: true
    });
  };
  
  // Mock save method
  safeOverride(mongoose.Model.prototype, 'save', function(this: ModelMethodThis) {
    const modelName = this.constructor.modelName;
    const document = this.toObject();
    
    if (document._id) {
      memoryStore.updateInCollection(modelName, { _id: document._id }, document);
    } else {
      const saved = memoryStore.addToCollection(modelName, document);
      Object.assign(this, saved);
    }
    
    return Promise.resolve(this);
  });
  
  // Create a basic query object factory
  const createQueryObject = (resultPromise: Promise<any>): QueryReturn => {
    const queryObj: Partial<QueryReturn> = {
      exec: () => resultPromise
    };
    
    // Add chainable methods that return the same query object
    const chainableMethods = ['lean', 'select', 'sort', 'limit', 'skip'];
    chainableMethods.forEach(method => {
      queryObj[method as keyof QueryReturn] = (() => queryObj) as any;
    });
    
    return queryObj as QueryReturn;
  };
  
  // Type for model context
  interface ModelContext {
    modelName: string;
  }

  // Mock findOne
  safeOverride(mongoose.Model, 'findOne', function(this: ModelContext, query: any) {
    const modelName = this.modelName;
    const results = memoryStore.findInCollection(modelName, query);
    return createQueryObject(Promise.resolve(results[0] || null));
  });
  
  // Mock find
  safeOverride(mongoose.Model, 'find', function(this: ModelContext, query: any) {
    const modelName = this.modelName;
    const results = memoryStore.findInCollection(modelName, query);
    return createQueryObject(Promise.resolve(results));
  });
  
  // Mock findByIdAndUpdate
  safeOverride(mongoose.Model, 'findByIdAndUpdate', function(this: ModelContext, id: any, update: any) {
    const modelName = this.modelName;
    const results = memoryStore.findInCollection(modelName, { _id: id });
    if (results.length === 0) return createQueryObject(Promise.resolve(null));
    
    const updated = { ...results[0], ...update };
    memoryStore.updateInCollection(modelName, { _id: id }, updated);
    return createQueryObject(Promise.resolve(updated));
  });
  
  // Mock findByIdAndDelete
  safeOverride(mongoose.Model, 'findByIdAndDelete', function(this: ModelContext, id: any) {
    const modelName = this.modelName;
    const results = memoryStore.findInCollection(modelName, { _id: id });
    if (results.length === 0) return createQueryObject(Promise.resolve(null));
    
    memoryStore.deleteFromCollection(modelName, { _id: id });
    return createQueryObject(Promise.resolve(results[0]));
  });
  
  // Mock deleteOne
  safeOverride(mongoose.Model, 'deleteOne', function(this: ModelContext, query: any) {
    const modelName = this.modelName;
    const deleted = memoryStore.deleteFromCollection(modelName, query);
    return createQueryObject(Promise.resolve({ deletedCount: deleted }));
  });
  
  // Mock deleteMany
  safeOverride(mongoose.Model, 'deleteMany', function(this: ModelContext, query: any) {
    const modelName = this.modelName;
    const deleted = memoryStore.deleteFromCollection(modelName, query);
    return createQueryObject(Promise.resolve({ deletedCount: deleted }));
  });
  
  // Mock connect
  const originalConnect = mongoose.connect;
  safeOverride(mongoose, 'connect', function(uri?: string, options?: any) {
    if (uri && uri !== MONGODB_URI) {
      // If someone is trying to connect to a specific URI that's not our mock one,
      // we'll fall back to the real implementation
      return originalConnect.call(mongoose, uri, options);
    }
    return Promise.resolve(mongoose);
  });
  
  // Mock disconnect
  safeOverride(mongoose, 'disconnect', function() {
    return Promise.resolve(mongoose);
  });
}

/**
 * Connect to the MongoDB database
 */
export async function connectToDatabase(): Promise<void> {
  try {
    // Check if we're in a testing environment and use a mock if needed
    if (process.env.NODE_ENV === 'test') {
      logger.info('Using mock MongoDB for testing');
      setupMemoryServer();
      return;
    }

    // Use memory server for development if real MongoDB is not available
    if (process.env.NODE_ENV === 'development' && !process.env.MONGODB_URI) {
      setupMemoryServer();
      return;
    }
    
    // Connect to a real MongoDB database
    const options = {
      autoIndex: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    };
    
    await mongoose.connect(MONGODB_URI);
    logger.info(`Connected to MongoDB: ${MONGODB_URI}`);
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    // Don't throw the error, just log it and continue with in-memory
    setupMemoryServer();
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
  }
}