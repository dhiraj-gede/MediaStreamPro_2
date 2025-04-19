import { 
  User, InsertUser, File, InsertFile, 
  Upload, InsertUpload, Chunk, InsertChunk,
  Conversion, InsertConversion, Account, InsertAccount,
  Folder, InsertFolder,
  FileStatus, JobStatus
} from "@shared/schema";

// Storage interface for all CRUD operations
export interface IStorage {
  // User operations (keeping from template)
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // File operations
  createFile(file: InsertFile): Promise<File>;
  getFile(id: number): Promise<File | undefined>;
  
  // Upload operations
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
  
  // Chunk operations
  createChunk(chunk: InsertChunk): Promise<Chunk>;
  getChunksByUploadId(uploadId: number, resolution?: string): Promise<Chunk[]>;
  getChunk(id: number): Promise<Chunk | undefined>;
  
  // Conversion operations
  createConversion(conversion: InsertConversion): Promise<Conversion>;
  getConversion(id: number): Promise<Conversion | undefined>;
  getConversionsByUploadId(uploadId: number): Promise<Conversion[]>;
  updateConversionStatus(id: number, status: JobStatus, progress?: number): Promise<Conversion>;
  updateConversionProgress(id: number, progress: number): Promise<Conversion>;
  updateConversionError(id: number, error: string): Promise<Conversion>;
  
  // Account operations
  createAccount(account: InsertAccount): Promise<Account>;
  getAccount(id: number): Promise<Account | undefined>;
  getAccounts(): Promise<Account[]>;
  updateAccountUsage(id: number, storageUsed: number): Promise<Account>;
  
  // Folder operations
  createFolder(folder: InsertFolder): Promise<Folder>;
  getFolder(id: number): Promise<Folder | undefined>;
  getFolderByName(name: string): Promise<Folder | undefined>;
  getFolders(): Promise<Folder[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private files: Map<number, File>;
  private uploads: Map<number, Upload>;
  private chunks: Map<number, Chunk>;
  private conversions: Map<number, Conversion>;
  private accounts: Map<number, Account>;
  private folders: Map<number, Folder>;
  
  // ID counters for each entity
  private userIdCounter: number;
  private fileIdCounter: number;
  private uploadIdCounter: number;
  private chunkIdCounter: number;
  private conversionIdCounter: number;
  private accountIdCounter: number;
  private folderIdCounter: number;

  constructor() {
    this.users = new Map();
    this.files = new Map();
    this.uploads = new Map();
    this.chunks = new Map();
    this.conversions = new Map();
    this.accounts = new Map();
    this.folders = new Map();
    
    this.userIdCounter = 1;
    this.fileIdCounter = 1;
    this.uploadIdCounter = 1;
    this.chunkIdCounter = 1;
    this.conversionIdCounter = 1;
    this.accountIdCounter = 1;
    this.folderIdCounter = 1;
    
    // Initialize with some default folders
    this.createFolder({ name: "C++ Basics" });
    this.createFolder({ name: "Game Development" });
    this.createFolder({ name: "Full-Stack Projects" });
  }

  // User operations (keeping from template)
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // File operations
  async createFile(insertFile: InsertFile): Promise<File> {
    const id = this.fileIdCounter++;
    const now = new Date();
    const file: File = { 
      ...insertFile, 
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.files.set(id, file);
    return file;
  }
  
  async getFile(id: number): Promise<File | undefined> {
    return this.files.get(id);
  }
  
  // Upload operations
  async createUpload(insertUpload: InsertUpload): Promise<Upload> {
    const id = this.uploadIdCounter++;
    const now = new Date();
    const upload: Upload = { 
      ...insertUpload, 
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.uploads.set(id, upload);
    return upload;
  }
  
  async getUpload(id: number): Promise<Upload | undefined> {
    return this.uploads.get(id);
  }
  
  async getUploadByIdentifier(identifier: string): Promise<Upload | undefined> {
    return Array.from(this.uploads.values()).find(
      (upload) => upload.identifier === identifier
    );
  }
  
  async getUploads(options?: {
    category?: string;
    folderId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Upload[]> {
    let uploads = Array.from(this.uploads.values());
    
    if (options?.category) {
      uploads = uploads.filter(upload => upload.category === options.category);
    }
    
    if (options?.folderId) {
      uploads = uploads.filter(upload => upload.folderId === options.folderId);
    }
    
    // Sort by createdAt (newest first)
    uploads.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    if (options?.offset !== undefined && options?.limit !== undefined) {
      return uploads.slice(options.offset, options.offset + options.limit);
    }
    
    return uploads;
  }
  
  async updateUploadStatus(id: number, status: FileStatus): Promise<Upload> {
    const upload = this.uploads.get(id);
    if (!upload) throw new Error(`Upload with ID ${id} not found`);
    
    const updatedUpload = { 
      ...upload, 
      status, 
      updatedAt: new Date() 
    };
    this.uploads.set(id, updatedUpload);
    return updatedUpload;
  }
  
  async updateUploadThumbnail(id: number, thumbnailId: string): Promise<Upload> {
    const upload = this.uploads.get(id);
    if (!upload) throw new Error(`Upload with ID ${id} not found`);
    
    const updatedUpload = { 
      ...upload, 
      thumbnail: thumbnailId, 
      updatedAt: new Date() 
    };
    this.uploads.set(id, updatedUpload);
    return updatedUpload;
  }
  
  // Chunk operations
  async createChunk(insertChunk: InsertChunk): Promise<Chunk> {
    const id = this.chunkIdCounter++;
    const now = new Date();
    const chunk: Chunk = { 
      ...insertChunk, 
      id, 
      createdAt: now 
    };
    this.chunks.set(id, chunk);
    return chunk;
  }
  
  async getChunksByUploadId(uploadId: number, resolution?: string): Promise<Chunk[]> {
    let chunks = Array.from(this.chunks.values())
      .filter(chunk => chunk.uploadId === uploadId);
    
    if (resolution) {
      chunks = chunks.filter(chunk => chunk.resolution === resolution);
    }
    
    // Sort by index
    return chunks.sort((a, b) => a.index - b.index);
  }
  
  async getChunk(id: number): Promise<Chunk | undefined> {
    return this.chunks.get(id);
  }
  
  // Conversion operations
  async createConversion(insertConversion: InsertConversion): Promise<Conversion> {
    const id = this.conversionIdCounter++;
    const now = new Date();
    const conversion: Conversion = { 
      ...insertConversion, 
      id, 
      progress: 0,
      createdAt: now, 
      updatedAt: now 
    };
    this.conversions.set(id, conversion);
    return conversion;
  }
  
  async getConversion(id: number): Promise<Conversion | undefined> {
    return this.conversions.get(id);
  }
  
  async getConversionsByUploadId(uploadId: number): Promise<Conversion[]> {
    return Array.from(this.conversions.values())
      .filter(conversion => conversion.uploadId === uploadId);
  }
  
  async updateConversionStatus(id: number, status: JobStatus, progress?: number): Promise<Conversion> {
    const conversion = this.conversions.get(id);
    if (!conversion) throw new Error(`Conversion with ID ${id} not found`);
    
    const now = new Date();
    const updatedConversion = { 
      ...conversion, 
      status, 
      updatedAt: now 
    };
    
    if (progress !== undefined) {
      updatedConversion.progress = progress;
    }
    
    if (status === 'processing' && !conversion.startedAt) {
      updatedConversion.startedAt = now;
    }
    
    if (status === 'ready' || status === 'failed') {
      updatedConversion.completedAt = now;
    }
    
    this.conversions.set(id, updatedConversion);
    return updatedConversion;
  }
  
  async updateConversionProgress(id: number, progress: number): Promise<Conversion> {
    const conversion = this.conversions.get(id);
    if (!conversion) throw new Error(`Conversion with ID ${id} not found`);
    
    const updatedConversion = { 
      ...conversion, 
      progress, 
      updatedAt: new Date() 
    };
    this.conversions.set(id, updatedConversion);
    return updatedConversion;
  }
  
  async updateConversionError(id: number, error: string): Promise<Conversion> {
    const conversion = this.conversions.get(id);
    if (!conversion) throw new Error(`Conversion with ID ${id} not found`);
    
    const updatedConversion = { 
      ...conversion, 
      error, 
      status: 'failed' as JobStatus, 
      updatedAt: new Date() 
    };
    this.conversions.set(id, updatedConversion);
    return updatedConversion;
  }
  
  // Account operations
  async createAccount(insertAccount: InsertAccount): Promise<Account> {
    const id = this.accountIdCounter++;
    const now = new Date();
    const account: Account = { 
      ...insertAccount, 
      id, 
      storageUsed: 0,
      createdAt: now, 
      updatedAt: now 
    };
    this.accounts.set(id, account);
    return account;
  }
  
  async getAccount(id: number): Promise<Account | undefined> {
    return this.accounts.get(id);
  }
  
  async getAccounts(): Promise<Account[]> {
    return Array.from(this.accounts.values());
  }
  
  async updateAccountUsage(id: number, storageUsed: number): Promise<Account> {
    const account = this.accounts.get(id);
    if (!account) throw new Error(`Account with ID ${id} not found`);
    
    const updatedAccount = { 
      ...account, 
      storageUsed, 
      updatedAt: new Date() 
    };
    this.accounts.set(id, updatedAccount);
    return updatedAccount;
  }
  
  // Folder operations
  async createFolder(insertFolder: InsertFolder): Promise<Folder> {
    const id = this.folderIdCounter++;
    const now = new Date();
    const folder: Folder = { 
      ...insertFolder, 
      id, 
      createdAt: now 
    };
    this.folders.set(id, folder);
    return folder;
  }
  
  async getFolder(id: number): Promise<Folder | undefined> {
    return this.folders.get(id);
  }
  
  async getFolderByName(name: string): Promise<Folder | undefined> {
    return Array.from(this.folders.values()).find(
      (folder) => folder.name === name
    );
  }
  
  async getFolders(): Promise<Folder[]> {
    return Array.from(this.folders.values());
  }
}

export const storage = new MemStorage();
