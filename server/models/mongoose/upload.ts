import mongoose, { Document, Schema } from 'mongoose';
import { FileCategory, FileStatus } from '@shared/schema';

// Define the Upload interface
export interface IUpload extends Document {
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  category: FileCategory;
  status: FileStatus;
  identifier: string;
  path: string;
  thumbnail?: string; 
  duration?: number; // For video files in seconds
  width?: number; // For video/image files
  height?: number; // For video/image files
  metadata?: Record<string, any>;
  folderId?: Schema.Types.ObjectId;
  serviceAccountId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  externalFileId?: string; // Google Drive file ID
  externalThumbnailId?: string; // Google Drive thumbnail ID
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Create the Upload schema
const uploadSchema = new Schema<IUpload>(
  {
    filename: {
      type: String,
      required: true,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['video', 'image', 'document', 'code'],
    },
    status: {
      type: String,
      required: true,
      enum: ['processing', 'ready', 'failed'],
      default: 'processing',
    },
    identifier: {
      type: String,
      required: true,
      unique: true,
    },
    path: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
    },
    duration: {
      type: Number,
    },
    width: {
      type: Number,
    },
    height: {
      type: Number,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    folderId: {
      type: Schema.Types.ObjectId,
      ref: 'Folder',
    },
    serviceAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceAccount',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    externalFileId: {
      type: String,
    },
    externalThumbnailId: {
      type: String,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Add indices for faster queries
uploadSchema.index({ userId: 1 });
uploadSchema.index({ identifier: 1 }, { unique: true });
uploadSchema.index({ folderId: 1 });
uploadSchema.index({ category: 1 });
uploadSchema.index({ status: 1 });
uploadSchema.index({ serviceAccountId: 1 });

// Create the Upload model
export const Upload = mongoose.model<IUpload>('Upload', uploadSchema);