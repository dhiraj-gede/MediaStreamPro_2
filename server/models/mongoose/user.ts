import mongoose, { Document, Schema } from 'mongoose';

// Define the User interface
export interface IUser extends Document {
  username: string;
  displayName: string;
  email: string;
  avatar?: string;
  githubId?: string;
  isAdmin: boolean;
  lastLogin: Date;
  settings: {
    theme: string;
    notifications: boolean;
    defaultResolution: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Create the User schema
const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    avatar: {
      type: String,
    },
    githubId: {
      type: String,
      unique: true,
      sparse: true, // Allows null/undefined values
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    settings: {
      theme: {
        type: String,
        default: 'light',
      },
      notifications: {
        type: Boolean,
        default: true,
      },
      defaultResolution: {
        type: String,
        default: '720p',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Add indices for faster queries
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ githubId: 1 });

// Create the User model
export const User = mongoose.models.User || mongoose.model<IUser>('User', userSchema);