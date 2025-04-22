import mongoose from 'mongoose';
import {
  User, InsertUser, File, InsertFile,
  Upload, InsertUpload, Chunk, InsertChunk,
  Conversion, InsertConversion, Account, InsertAccount,
  Folder, InsertFolder, FileStatus, JobStatus
} from '@shared/schema';
import {
  UserModel, FileModel, UploadModel, ChunkModel,
  ConversionModel, ServiceAccount, FolderModel
} from './models/mongoose';
import { logger } from './utils/logger';

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createFile(file: InsertFile): Promise<File>;
  getFile(id: number): Promise<File | undefined>;
  createUpload(upload: InsertUpload): Promise<Upload>;
  getUpload(id: number): Promise<Upload | undefined>;
  getUploadByIdentifier(identifier: string): Promise<Upload | undefined>;
  getUploads(options?: {
    category?: string;
    folderId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Upload[]>;
  updateUploadStatus(id: number, status: FileStatus): Promise<Upload>;
  updateUploadThumbnail(id: number, thumbnailId: string): Promise<Upload>;
  createChunk(chunk: InsertChunk): Promise<Chunk>;
  getChunksByUploadId(uploadId: number, resolution?: string): Promise<Chunk[]>;
  getChunk(id: number): Promise<Chunk | undefined>;
  createConversion(conversion: InsertConversion): Promise<Conversion>;
  getConversion(id: number): Promise<Conversion | undefined>;
  getConversionsByUploadId(uploadId: number): Promise<Conversion[]>;
  updateConversionStatus(id: number, status: JobStatus, progress?: number): Promise<Conversion>;
  updateConversionProgress(id: number, progress: number): Promise<Conversion>;
  updateConversionError(id: number, error: string): Promise<Conversion>;
  createAccount(account: InsertAccount): Promise<Account>;
  getAccount(id: number): Promise<Account | undefined>;
  getAccounts(): Promise<Account[]>;
  updateAccountUsage(id: string, storageUsed: number): Promise<Account>;
  createFolder(folder: InsertFolder): Promise<Folder>;
  getFolder(id: number): Promise<Folder | undefined>;
  getFolderByName(name: string): Promise<Folder | undefined>;
  getFolders(): Promise<Folder[]>;
  updateFolder(id: number, update: Partial<Folder>): Promise<Folder>;
  deleteFolder(id: number): Promise<boolean>;
  count(options?: { folderId?: string }): Promise<number>;
}

export class MongoStorage implements IStorage {
  private userIdCounter: number = 1;
  private fileIdCounter: number = 1;
  private uploadIdCounter: number = 1;
  private chunkIdCounter: number = 1;
  private conversionIdCounter: number = 1;
  private accountIdCounter: number = 1;
  private folderIdCounter: number = 1;

  constructor() {
    logger.debug('Starting MongoStorage constructor');
    this.initializeCounters();
    this.initializeDefaultFolders();
    logger.debug('Completed MongoStorage constructor');
  }

  private async initializeCounters() {
    logger.debug('Starting initializeCounters');
    const [maxUser, maxFile, maxUpload, maxChunk, maxConversion, maxAccount, maxFolder] = await Promise.all([
      UserModel.findOne().sort({ id: -1 }).exec(),
      FileModel.findOne().sort({ id: -1 }).exec(),
      UploadModel.findOne().sort({ id: -1 }).exec(),
      ChunkModel.findOne().sort({ id: -1 }).exec(),
      ConversionModel.findOne().sort({ id: -1 }).exec(),
      ServiceAccount.findOne().sort({ id: -1 }).exec(),
      FolderModel.findOne().sort({ id: -1 }).exec(),
    ]);

    this.userIdCounter = (maxUser?.id || 0) + 1;
    this.fileIdCounter = (maxFile?.id || 0) + 1;
    this.uploadIdCounter = (maxUpload?.id || 0) + 1;
    this.chunkIdCounter = (maxChunk?.id || 0) + 1;
    this.conversionIdCounter = (maxConversion?.id || 0) + 1;
    this.accountIdCounter = (maxAccount?.id || 0) + 1;
    this.folderIdCounter = (maxFolder?.id || 0) + 1;

    logger.debug(`Initialized counters: user=${this.userIdCounter}, file=${this.fileIdCounter}, upload=${this.uploadIdCounter}, chunk=${this.chunkIdCounter}, conversion=${this.conversionIdCounter}, account=${this.accountIdCounter}, folder=${this.folderIdCounter}`);
  }

  private async initializeDefaultFolders() {
    logger.debug('Starting initializeDefaultFolders');
    const defaultFolders = ['C++ Basics', 'Game Development', 'Full-Stack Projects'];
    for (const name of defaultFolders) {
      logger.debug(`Checking for default folder: name=${name}`);
      const existing = await FolderModel.findOne({ name }).exec();
      if (!existing) {
        logger.debug(`Creating default folder: name=${name}`);
        await this.createFolder({ name });
      } else {
        logger.debug(`Default folder already exists: name=${name}`);
      }
    }
    logger.debug('Completed initializeDefaultFolders');
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    logger.debug(`Starting getUser: id=${id}`);
    const user = await UserModel.findOne({ id }).exec();
    if (user) {
      logger.debug(`Found user: id=${id}, username=${user.username}`);
    } else {
      logger.debug(`User not found: id=${id}`);
    }
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    logger.debug(`Starting getUserByUsername: username=${username}`);
    const user = await UserModel.findOne({ username }).exec();
    if (user) {
      logger.debug(`Found user: username=${username}, id=${user.id}`);
    } else {
      logger.debug(`User not found: username=${username}`);
    }
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    logger.debug(`Starting createUser: username=${insertUser.username}`);
    const id = this.userIdCounter++;
    logger.debug(`Assigned user ID: id=${id}`);
    const user = new UserModel({ ...insertUser, id });
    await user.save();
    logger.debug(`Created user: id=${id}, username=${insertUser.username}`);
    return user.toObject();
  }

  // File operations
  async createFile(insertFile: InsertFile): Promise<File> {
    logger.debug(`Starting createFile: name=${insertFile.name}`);
    const id = this.fileIdCounter++;
    logger.debug(`Assigned file ID: id=${id}`);
    const now = new Date();
    const file = new FileModel({
      ...insertFile,
      id,
      createdAt: now,
      updatedAt: now,
    });
    await file.save();
    logger.debug(`Created file: id=${id}, name=${insertFile.name}`);
    return file.toObject();
  }

  async getFile(id: number): Promise<File | undefined> {
    logger.debug(`Starting getFile: id=${id}`);
    const file = await FileModel.findOne({ id }).exec();
    if (file) {
      logger.debug(`Found file: id=${id}, name=${file.name}`);
    } else {
      logger.debug(`File not found: id=${id}`);
    }
    return file || undefined;
  }

  // Upload operations
  async createUpload(insertUpload: InsertUpload): Promise<Upload> {
    logger.debug(`Starting createUpload: uploadName=${insertUpload.uploadName || 'Unnamed'}`);
    const id = this.uploadIdCounter++;
    logger.debug(`Assigned upload ID: id=${id}`);
    const now = new Date();
    const upload = new UploadModel({
      id,
      fileType: insertUpload.fileType,
      externalFileId: insertUpload.externalFileId,
      source: insertUpload.source,
      fileId: insertUpload.fileId,
      fileSize: insertUpload.fileSize,
      uploadName: insertUpload.uploadName ?? 'Unnamed',
      category: insertUpload.category,
      status: insertUpload.status ?? 'processing',
      identifier: insertUpload.identifier ?? null,
      folderName: insertUpload.folderName ?? null,
      thumbnail: insertUpload.thumbnail ?? null,
      folderId: insertUpload.folderId ?? null,
      createdAt: now,
      updatedAt: now,
    });
    await upload.save();
    logger.debug(`Created upload: id=${id}, uploadName=${upload.uploadName}`);
    return upload.toObject();
  }

  async getUpload(id: number): Promise<Upload | undefined> {
    logger.debug(`Starting getUpload: id=${id}`);
    const upload = await UploadModel.findOne({ id }).exec();
    if (upload) {
      logger.debug(`Found upload: id=${id}, uploadName=${upload.uploadName}`);
    } else {
      logger.debug(`Upload not found: id=${id}`);
    }
    return upload || undefined;
  }

  async getUploadByIdentifier(identifier: string): Promise<Upload | undefined> {
    logger.debug(`Starting getUploadByIdentifier: identifier=${identifier}`);
    const upload = await UploadModel.findOne({ identifier }).exec();
    if (upload) {
      logger.debug(`Found upload: identifier=${identifier}, id=${upload.id}`);
    } else {
      logger.debug(`Upload not found: identifier=${identifier}`);
    }
    return upload || undefined;
  }

  async getUploads(options?: {
    category?: string;
    folderId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Upload[]> {
    logger.debug(`Starting getUploads: options=${JSON.stringify(options)}`);
    const query: any = {};
    if (options?.category) {
      query.category = options.category;
    }
    if (options?.folderId) {
      query.folderId = options.folderId;
    }

    let uploadsQuery = UploadModel.find(query).sort({ createdAt: -1 });
    if (options?.offset !== undefined && options?.limit !== undefined) {
      uploadsQuery = uploadsQuery.skip(options.offset).limit(options.limit);
      logger.debug(`Applying pagination: offset=${options.offset}, limit=${options.limit}`);
    }

    const uploads = await uploadsQuery.exec();
    logger.debug(`Retrieved ${uploads.length} uploads`);
    return uploads.map((upload: mongoose.Document & Upload) => upload.toObject() as Upload);
  }

  async updateUploadStatus(id: number, status: FileStatus): Promise<Upload> {
    logger.debug(`Starting updateUploadStatus: id=${id}, status=${status}`);
    const upload = await UploadModel.findOneAndUpdate(
      { id },
      { status, updatedAt: new Date() },
      { new: true }
    ).exec();
    if (!upload) {
      logger.error(`Upload not found: id=${id}`);
      throw new Error(`Upload with ID ${id} not found`);
    }
    logger.debug(`Updated upload status: id=${id}, status=${status}`);
    return upload.toObject();
  }

  async updateUploadThumbnail(id: number, thumbnailId: string): Promise<Upload> {
    logger.debug(`Starting updateUploadThumbnail: id=${id}, thumbnailId=${thumbnailId}`);
    const upload = await UploadModel.findOneAndUpdate(
      { id },
      { thumbnail: thumbnailId, updatedAt: new Date() },
      { new: true }
    ).exec();
    if (!upload) {
      logger.error(`Upload not found: id=${id}`);
      throw new Error(`Upload with ID ${id} not found`);
    }
    logger.debug(`Updated upload thumbnail: id=${id}, thumbnailId=${thumbnailId}`);
    return upload.toObject();
  }

  // Chunk operations
  async createChunk(insertChunk: InsertChunk): Promise<Chunk> {
    logger.debug(`Starting createChunk: uploadId=${insertChunk.uploadId}`);
    const id = this.chunkIdCounter++;
    logger.debug(`Assigned chunk ID: id=${id}`);
    const now = new Date();
    const chunk = new ChunkModel({
      ...insertChunk,
      id,
      createdAt: now,
    });
    await chunk.save();
    logger.debug(`Created chunk: id=${id}, uploadId=${insertChunk.uploadId}`);
    return chunk.toObject();
  }

  async getChunksByUploadId(uploadId: number, resolution?: string): Promise<Chunk[]> {
    logger.debug(`Starting getChunksByUploadId: uploadId=${uploadId}, resolution=${resolution || 'none'}`);
    const query: any = { uploadId };
    if (resolution) {
      query.resolution = resolution;
    }
    const chunks = await ChunkModel.find(query).sort({ index: 1 }).exec();
    logger.debug(`Retrieved ${chunks.length} chunks for uploadId=${uploadId}`);
    return chunks.map((chunk: mongoose.Document & Chunk) => chunk.toObject() as Chunk);
  }

  async getChunk(id: number): Promise<Chunk | undefined> {
    logger.debug(`Starting getChunk: id=${id}`);
    const chunk = await ChunkModel.findOne({ id }).exec();
    if (chunk) {
      logger.debug(`Found chunk: id=${id}, uploadId=${chunk.uploadId}`);
    } else {
      logger.debug(`Chunk not found: id=${id}`);
    }
    return chunk || undefined;
  }

  // Conversion operations
  async createConversion(insertConversion: InsertConversion): Promise<Conversion> {
    logger.debug(`Starting createConversion: uploadId=${insertConversion.uploadId}, resolution=${insertConversion.resolution}`);
    const id = this.conversionIdCounter++;
    logger.debug(`Assigned conversion ID: id=${id}`);
    const now = new Date();
    const conversion = new ConversionModel({
      id,
      uploadId: insertConversion.uploadId,
      resolution: insertConversion.resolution,
      status: insertConversion.status ?? 'waiting',
      progress: 0,
      startedAt: null,
      completedAt: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    });
    await conversion.save();
    logger.debug(`Created conversion: id=${id}, uploadId=${insertConversion.uploadId}`);
    return conversion.toObject();
  }

  async getConversion(id: number): Promise<Conversion | undefined> {
    logger.debug(`Starting getConversion: id=${id}`);
    const conversion = await ConversionModel.findOne({ id }).exec();
    if (conversion) {
      logger.debug(`Found conversion: id=${id}, uploadId=${conversion.uploadId}`);
    } else {
      logger.debug(`Conversion not found: id=${id}`);
    }
    return conversion || undefined;
  }

  async getConversionsByUploadId(uploadId: number): Promise<Conversion[]> {
    logger.debug(`Starting getConversionsByUploadId: uploadId=${uploadId}`);
    const conversions = await ConversionModel.find({ uploadId }).exec();
    logger.debug(`Retrieved ${conversions.length} conversions for uploadId=${uploadId}`);
    return conversions.map((conversion: mongoose.Document & Conversion) => conversion.toObject() as Conversion);
  }

  async updateConversionStatus(id: number, status: JobStatus, progress?: number): Promise<Conversion> {
    logger.debug(`Starting updateConversionStatus: id=${id}, status=${status}, progress=${progress || 'none'}`);
    const update: any = { status, updatedAt: new Date() };
    if (progress !== undefined) {
      update.progress = progress;
    }
    if (status === 'processing') {
      update.startedAt = update.startedAt || new Date();
    }
    if (status === 'ready' || status === 'failed') {
      update.completedAt = new Date();
    }

    const conversion = await ConversionModel.findOneAndUpdate(
      { id },
      update,
      { new: true }
    ).exec();
    if (!conversion) {
      logger.error(`Conversion not found: id=${id}`);
      throw new Error(`Conversion with ID ${id} not found`);
    }
    logger.debug(`Updated conversion status: id=${id}, status=${status}`);
    return conversion.toObject();
  }

  async updateConversionProgress(id: number, progress: number): Promise<Conversion> {
    logger.debug(`Starting updateConversionProgress: id=${id}, progress=${progress}`);
    const conversion = await ConversionModel.findOneAndUpdate(
      { id },
      { progress, updatedAt: new Date() },
      { new: true }
    ).exec();
    if (!conversion) {
      logger.error(`Conversion not found: id=${id}`);
      throw new Error(`Conversion with ID ${id} not found`);
    }
    logger.debug(`Updated conversion progress: id=${id}, progress=${progress}`);
    return conversion.toObject();
  }

  async updateConversionError(id: number, error: string): Promise<Conversion> {
    logger.debug(`Starting updateConversionError: id=${id}, error=${error}`);
    const conversion = await ConversionModel.findOneAndUpdate(
      { id },
      { error, status: 'failed', updatedAt: new Date() },
      { new: true }
    ).exec();
    if (!conversion) {
      logger.error(`Conversion not found: id=${id}`);
      throw new Error(`Conversion with ID ${id} not found`);
    }
    logger.debug(`Updated conversion error: id=${id}, error=${error}`);
    return conversion.toObject();
  }

  // Account operations
  async createAccount(insertAccount: InsertAccount): Promise<Account> {
    logger.debug(`Starting createAccount: email=${insertAccount.email}`);
    const id = this.accountIdCounter++;
    logger.debug(`Assigned account ID: id=${id}`);
    const now = new Date();
    const account = new ServiceAccount({
      ...insertAccount,
      id,
      storageUsed: 0,
      isActive: insertAccount.isActive !== undefined ? insertAccount.isActive : true,
      createdAt: now,
      updatedAt: now,
      credentials: { client_email: insertAccount.email, private_key: '' },
      userId: new mongoose.Types.ObjectId(),
    });
    await account.save();
    logger.debug(`Created account: id=${id}, email=${insertAccount.email}`);
    return account.toObject();
  }

  async getAccount(id: number): Promise<Account | undefined> {
    logger.debug(`Starting getAccount: id=${id}`);
    const account = await ServiceAccount.findOne({ id }).exec();
    if (account) {
      logger.debug(`Found account: id=${id}, email=${account.email}`);
    } else {
      logger.debug(`Account not found: id=${id}`);
    }
    return account || undefined;
  }

  async getAccounts(): Promise<Account[]> {
    logger.debug('Starting getAccounts');
    const accounts = await ServiceAccount.find().exec();
    logger.debug(`Retrieved ${accounts.length} accounts`);
    return accounts.map((account: mongoose.Document & Account) => account.toObject() as Account);
  }

  async updateAccountUsage(id: string, storageUsed: number): Promise<Account> {
    logger.debug(`Starting updateAccountUsage: id=${id}, storageUsed=${storageUsed}`);
    const account = await ServiceAccount.findOneAndUpdate(
      { _id: id },
      { storageUsed, updatedAt: new Date() },
      { new: true }
    ).exec();
    if (!account) {
      logger.error(`Account not found: id=${id}`);
      throw new Error(`Account with ID ${id} not found`);
    }
    logger.debug(`Updated account usage: id=${id}, storageUsed=${storageUsed}`);
    return account.toObject();
  }

  // Folder operations
  async createFolder(insertFolder: InsertFolder): Promise<Folder> {
    logger.debug(`Starting createFolder: name=${insertFolder.name}`);
    const id = this.folderIdCounter++;
    logger.debug(`Assigned folder ID: id=${id}`);
    const now = new Date();
    const folder = new FolderModel({
      ...insertFolder,
      id,
      createdAt: now,
    });
    await folder.save();
    logger.debug(`Created folder: id=${id}, name=${insertFolder.name}`);
    return folder.toObject();
  }

  async getFolder(id: number): Promise<Folder | undefined> {
    logger.debug(`Starting getFolder: id=${id}`);
    const folder = await FolderModel.findOne({ id }).exec();
    if (folder) {
      logger.debug(`Found folder: id=${id}, name=${folder.name}`);
    } else {
      logger.debug(`Folder not found: id=${id}`);
    }
    return folder || undefined;
  }

  async getFolderByName(name: string): Promise<Folder | undefined> {
    logger.debug(`Starting getFolderByName: name=${name}`);
    const folder = await FolderModel.findOne({ name }).exec();
    if (folder) {
      logger.debug(`Found folder: name=${name}, id=${folder.id}`);
    } else {
      logger.debug(`Folder not found: name=${name}`);
    }
    return folder || undefined;
  }

  async getFolders(): Promise<Folder[]> {
    logger.debug('Starting getFolders');
    const folders = await FolderModel.find().exec();
    logger.debug(`Retrieved ${folders.length} folders`);
    return folders.map((folder: mongoose.Document & Folder) => folder.toObject() as Folder);
  }

  async updateFolder(id: number, update: Partial<Folder>): Promise<Folder> {
    logger.debug(`Starting updateFolder: id=${id}, update=${JSON.stringify(update)}`);
    const folder = await FolderModel.findOneAndUpdate(
      { id },
      { ...update, updatedAt: new Date() },
      { new: true }
    ).exec();
    if (!folder) {
      logger.error(`Folder not found: id=${id}`);
      throw new Error(`Folder with ID ${id} not found`);
    }
    logger.debug(`Updated folder: id=${id}, name=${folder.name}`);
    return folder.toObject();
  }

  async deleteFolder(id: number): Promise<boolean> {
    logger.debug(`Starting deleteFolder: id=${id}`);
    const result = await FolderModel.deleteOne({ id }).exec();
    if (result.deletedCount > 0) {
      logger.debug(`Deleted folder: id=${id}`);
    } else {
      logger.debug(`Folder not found for deletion: id=${id}`);
    }
    return result.deletedCount > 0;
  }

  async count(options?: { folderId?: string }): Promise<number> {
    logger.debug(`Starting count: options=${JSON.stringify(options)}`);
    const query: any = {};
    if (options?.folderId) {
      query.folderId = options.folderId;
    }
    const count = await UploadModel.countDocuments(query).exec();
    logger.debug(`Counted ${count} uploads for query=${JSON.stringify(query)}`);
    return count;
  }
}

export const storage = new MongoStorage();