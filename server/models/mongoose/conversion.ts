import mongoose, { Document, Schema } from 'mongoose';
import { JobStatus } from '@shared/schema';

// Define the Conversion interface
export interface IConversion extends Document {
  uploadId: Schema.Types.ObjectId;
  resolution: string; // Can be standard ('1080p', '720p', '360p') or custom (e.g., '480p')
  status: JobStatus;
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  jobId?: string; // External job ID in the conversion service
  width?: number; // For custom resolutions
  height?: number; // For custom resolutions
  videoBitrate?: string;
  audioBitrate?: string;
  userId: Schema.Types.ObjectId; // Reference to the user who owns this conversion
  createdAt: Date;
  updatedAt: Date;
}

// Create the Conversion schema
const conversionSchema = new Schema<IConversion>(
  {
    uploadId: {
      type: Schema.Types.ObjectId,
      ref: 'Upload',
      required: true,
    },
    resolution: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['waiting', 'processing', 'ready', 'failed'],
      default: 'waiting',
    },
    progress: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    error: {
      type: String,
    },
    jobId: {
      type: String,
    },
    width: {
      type: Number,
    },
    height: {
      type: Number,
    },
    videoBitrate: {
      type: String,
    },
    audioBitrate: {
      type: String,
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
conversionSchema.index({ uploadId: 1 });
conversionSchema.index({ status: 1 });
conversionSchema.index({ uploadId: 1, resolution: 1 }, { unique: true });

// Create the Conversion model
export const Conversion = mongoose.model<IConversion>('Conversion', conversionSchema);