import mongoose, { Document, Schema } from 'mongoose';

// Define the Chunk interface
export interface IChunk extends Document {
  uploadId: Schema.Types.ObjectId;
  index: number;
  duration: number;
  resolution: string;
  filename: string;
  path: string;
  externalFileId?: string; // Google Drive file ID
  serviceAccountId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Create the Chunk schema
const chunkSchema = new Schema<IChunk>(
  {
    uploadId: {
      type: Schema.Types.ObjectId,
      ref: 'Upload',
      required: true,
    },
    index: {
      type: Number,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    resolution: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    externalFileId: {
      type: String,
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
  },
  {
    timestamps: true,
  }
);

// Add indices for faster queries
chunkSchema.index({ uploadId: 1 });
chunkSchema.index({ uploadId: 1, index: 1 });
chunkSchema.index({ uploadId: 1, resolution: 1 });
chunkSchema.index({ serviceAccountId: 1 });
chunkSchema.index({ userId: 1 });

// Create the Chunk model
export const Chunk = mongoose.model<IChunk>('Chunk', chunkSchema);