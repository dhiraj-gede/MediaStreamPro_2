import mongoose, { Schema, model } from 'mongoose';
import { User, File, Upload, Chunk, Conversion, Account, Folder } from '@shared/schema';

const userSchema = new Schema<User>({
  id: Number,
  username: String,
}, { timestamps: true });

userSchema.index({ id: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });

const fileSchema = new Schema<File>({
  id: Number,
  name: String,
  size: Number,
  mimeType: String,
}, { timestamps: true });

const uploadSchema = new Schema<Upload>({
  id: Number,
  fileType: String,
  externalFileId: String,
  source: String,
  fileId: Number,
  fileSize: Number,
  uploadName: String,
  category: String,
  status: String,
  identifier: String,
  folderName: String,
  thumbnail: String,
  folderId: String,
}, { timestamps: true });

const chunkSchema = new Schema<Chunk>({
  id: Number,
  uploadId: Number,
  index: Number,
  path: String,
  resolution: String,
}, { timestamps: true });

const conversionSchema = new Schema<Conversion>({
  id: Number,
  uploadId: Number,
  resolution: String,
  status: String,
  progress: Number,
  startedAt: Date,
  completedAt: Date,
  error: String,
}, { timestamps: true });

const accountSchema = new Schema<Account>({
  _id: Number,
  name: String,
  email: String,
  storageLimit: Number,
  storageUsed: Number,
  isActive: Boolean,
}, { timestamps: true });

const folderSchema = new Schema<Folder>({
  id: Number,
  name: String,
}, { timestamps: true });
export interface IServiceAccount extends Document {
  id: string;
  name: string;
  email: string;
  credentials: {
    client_email: string;
    private_key: string;
  };
  storageLimit: number;
  storageUsed: number;
  isActive: boolean;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceAccountSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    credentials: { type: Object, required: true },
    storageLimit: { type: Number, required: true },
    storageUsed: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // ✅ enforce linkage
  },
  { timestamps: true }
);

export const UserModel = mongoose.models.User || model<User>('User', userSchema);
export const FileModel = mongoose.models.File || model<File>('File', fileSchema);
export const UploadModel = mongoose.models.Upload || model<Upload>('Upload', uploadSchema);
export const ChunkModel = mongoose.models.Chunk || model<Chunk>('Chunk', chunkSchema);
export const ConversionModel = mongoose.models.Conversion || model<Conversion>('Conversion', conversionSchema);
export const ServiceAccount = mongoose.models.Account || model<IServiceAccount>('Account', ServiceAccountSchema);
export const FolderModel = mongoose.models.Folder || model<Folder>('Folder', folderSchema);


// Define ServiceAccountSchema or import it from the correct module
