import mongoose, { Document, Schema } from 'mongoose';

// Define the ServiceAccount interface
export interface IServiceAccount extends Document {
  name: string;
  email: string;
  credentials: Record<string, any>; // Google service account credentials JSON
  storageLimit: number; // Storage limit in bytes
  storageUsed: number; // Storage used in bytes
  isActive: boolean;
  userId: Schema.Types.ObjectId; // Reference to the user who owns this account
  createdAt: Date;
  updatedAt: Date;
}

// Create the ServiceAccount schema
const serviceAccountSchema = new Schema<IServiceAccount>(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    credentials: {
      type: Schema.Types.Mixed, // For storing the JSON credentials
      required: true,
    },
    storageLimit: {
      type: Number,
      default: 15 * 1024 * 1024 * 1024, // Default to 15GB
    },
    storageUsed: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Add indices for faster queries
serviceAccountSchema.index({ userId: 1 });
serviceAccountSchema.index({ email: 1 });
serviceAccountSchema.index({ userId: 1, email: 1 }, { unique: true });

// Create the ServiceAccount model
export const ServiceAccount = mongoose.model<IServiceAccount>('ServiceAccount', serviceAccountSchema);