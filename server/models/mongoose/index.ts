
import { Schema, model } from 'mongoose';
import { User, File, Upload, Chunk, Conversion, Account, Folder } from '@shared/schema';

const userSchema = new Schema<User>({
  id: Number,
  username: String,
}, { timestamps: true });

const fileSchema = new Schema<File>({
  id: Number,
  name: String,
  size: Number,
  type: String,
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
  id: Number,
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

export const UserModel = model<User>('User', userSchema);
export const FileModel = model<File>('File', fileSchema);
export const UploadModel = model<Upload>('Upload', uploadSchema);
export const ChunkModel = model<Chunk>('Chunk', chunkSchema);
export const ConversionModel = model<Conversion>('Conversion', conversionSchema);
export const AccountModel = model<Account>('Account', accountSchema);
export const FolderModel = model<Folder>('Folder', folderSchema);
