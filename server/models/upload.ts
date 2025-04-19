import { InsertUpload, Upload, FileStatus } from '@shared/schema';
import { logger } from '../utils/logger';

// In-memory collection for testing
let uploads: Upload[] = [];
let nextId = 1;

/**
 * In-memory implementation of Upload model
 */
class UploadModel {
  /**
   * Create a new upload
   */
  async create(upload: InsertUpload): Promise<Upload> {
    const now = new Date();
    const newUpload: Upload = {
      ...upload,
      id: nextId++,
      status: upload.status || 'processing',
      createdAt: now,
      updatedAt: now,
    };
    
    uploads.push(newUpload);
    logger.debug(`Created upload: ${newUpload.id} - ${newUpload.uploadName}`);
    return newUpload;
  }
  
  /**
   * Get an upload by ID
   */
  async getById(id: number): Promise<Upload | null> {
    const upload = uploads.find(u => u.id === id);
    return upload || null;
  }
  
  /**
   * Get an upload by identifier
   */
  async getByIdentifier(identifier: string): Promise<Upload | null> {
    const upload = uploads.find(u => u.identifier === identifier);
    return upload || null;
  }
  
  /**
   * Get an upload by external file ID
   */
  async getByExternalFileId(externalFileId: string): Promise<Upload | null> {
    const upload = uploads.find(u => u.externalFileId === externalFileId);
    return upload || null;
  }
  
  /**
   * Get all uploads
   */
  async getAll(options?: {
    category?: string;
    folderId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Upload[]> {
    let result = [...uploads];
    
    // Apply filters
    if (options?.category) {
      result = result.filter(u => u.category === options.category);
    }
    
    if (options?.folderId) {
      result = result.filter(u => u.folderId === options.folderId);
    }
    
    // Sort by created date (newest first)
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // Apply pagination
    if (options?.offset !== undefined && options?.limit !== undefined) {
      result = result.slice(options.offset, options.offset + options.limit);
    }
    
    return result;
  }
  
  /**
   * Update an upload
   */
  async update(id: number, update: Partial<Upload>): Promise<Upload | null> {
    const index = uploads.findIndex(u => u.id === id);
    
    if (index === -1) {
      return null;
    }
    
    const updatedUpload: Upload = {
      ...uploads[index],
      ...update,
      id, // Ensure ID doesn't change
      updatedAt: new Date(),
    };
    
    uploads[index] = updatedUpload;
    logger.debug(`Updated upload: ${id}`);
    return updatedUpload;
  }
  
  /**
   * Update upload status
   */
  async updateStatus(id: number, status: FileStatus): Promise<Upload | null> {
    return this.update(id, { status });
  }
  
  /**
   * Update upload thumbnail
   */
  async updateThumbnail(id: number, thumbnail: string): Promise<Upload | null> {
    return this.update(id, { thumbnail });
  }
  
  /**
   * Delete an upload
   */
  async delete(id: number): Promise<boolean> {
    const initialLength = uploads.length;
    uploads = uploads.filter(u => u.id !== id);
    
    const deleted = uploads.length < initialLength;
    if (deleted) {
      logger.debug(`Deleted upload: ${id}`);
    }
    
    return deleted;
  }
  
  /**
   * Count uploads
   */
  async count(options?: {
    category?: string;
    folderId?: string;
  }): Promise<number> {
    let count = uploads.length;
    
    // Apply filters
    if (options?.category) {
      count = uploads.filter(u => u.category === options.category).length;
    }
    
    if (options?.folderId) {
      count = uploads.filter(u => u.folderId === options.folderId).length;
    }
    
    return count;
  }
  
  /**
   * Reset the model (for testing)
   */
  reset(): void {
    uploads = [];
    nextId = 1;
  }
}

export const uploadModel = new UploadModel();
