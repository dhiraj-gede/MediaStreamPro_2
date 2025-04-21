import mongoose, { Document, Schema } from 'mongoose';

// Define the Folder interface
export interface IFolder extends Document {
  name: string;
  description?: string;
  parentId?: Schema.Types.ObjectId; // For nested folders
  path: string[]; // Array of folder IDs that make up the path to this folder
  userId: Schema.Types.ObjectId; // Reference to the user who owns this folder
  isShared: boolean; // Whether this folder is shared with other users
  sharedWith?: Schema.Types.ObjectId[]; // References to users this folder is shared with
  createdAt: Date;
  updatedAt: Date;
}

// Create the Folder schema
const folderSchema = new Schema<IFolder>(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Folder',
    },
    path: [{
      type: Schema.Types.ObjectId,
      ref: 'Folder'
    }],
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isShared: {
      type: Boolean,
      default: false,
    },
    sharedWith: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
  },
  {
    timestamps: true,
  }
);

// Add indices for faster queries
folderSchema.index({ userId: 1 });
folderSchema.index({ parentId: 1 });
folderSchema.index({ path: 1 });
folderSchema.index({ userId: 1, name: 1, parentId: 1 }, { unique: true });

// Create the Folder model
export const Folder = mongoose.model<IFolder>('Folder', folderSchema);