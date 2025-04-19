import { InsertFile, File } from '@shared/schema';
import { logger } from '../utils/logger';

// Use in-memory collection for testing
let files: File[] = [];
let nextId = 1;

/**
 * In-memory implementation of File model
 */
class FileModel {
  /**
   * Create a new file
   */
  async create(file: InsertFile): Promise<File> {
    const now = new Date();
    const newFile: File = {
      ...file,
      id: nextId++,
      createdAt: now,
      updatedAt: now,
    };
    
    files.push(newFile);
    logger.debug(`Created file: ${newFile.id} - ${newFile.name}`);
    return newFile;
  }
  
  /**
   * Get a file by ID
   */
  async getById(id: number): Promise<File | null> {
    const file = files.find(f => f.id === id);
    return file || null;
  }
  
  /**
   * Get all files
   */
  async getAll(): Promise<File[]> {
    return [...files];
  }
  
  /**
   * Update a file
   */
  async update(id: number, update: Partial<File>): Promise<File | null> {
    const index = files.findIndex(f => f.id === id);
    
    if (index === -1) {
      return null;
    }
    
    const updatedFile: File = {
      ...files[index],
      ...update,
      id, // Ensure ID doesn't change
      updatedAt: new Date(),
    };
    
    files[index] = updatedFile;
    logger.debug(`Updated file: ${id}`);
    return updatedFile;
  }
  
  /**
   * Delete a file
   */
  async delete(id: number): Promise<boolean> {
    const initialLength = files.length;
    files = files.filter(f => f.id !== id);
    
    const deleted = files.length < initialLength;
    if (deleted) {
      logger.debug(`Deleted file: ${id}`);
    }
    
    return deleted;
  }
  
  /**
   * Search files by name
   */
  async searchByName(query: string): Promise<File[]> {
    const lowerQuery = query.toLowerCase();
    return files.filter(f => f.name.toLowerCase().includes(lowerQuery));
  }
  
  /**
   * Count all files
   */
  async count(): Promise<number> {
    return files.length;
  }
  
  /**
   * Reset the model (for testing)
   */
  reset(): void {
    files = [];
    nextId = 1;
  }
}

export const fileModel = new FileModel();
