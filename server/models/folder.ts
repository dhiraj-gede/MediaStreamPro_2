import { InsertFolder, Folder } from '@shared/schema';
import { logger } from '../utils/logger';

// In-memory collection for testing
let folders: Folder[] = [];
let nextId = 1;

/**
 * In-memory implementation of Folder model
 */
class FolderModel {
  constructor() {
    // Initialize with default folders
    this.seed();
  }
  
  /**
   * Seed the model with default folders
   */
  private async seed(): Promise<void> {
    // Only seed if there are no folders
    if (folders.length === 0) {
      try {
        await this.create({ name: 'C++ Basics' });
        await this.create({ name: 'Game Development' });
        await this.create({ name: 'Full-Stack Projects' });
        
        logger.info('Seeded folder model with default folders');
      } catch (error) {
        logger.error('Failed to seed folder model:', error);
      }
    }
  }
  
  /**
   * Create a new folder
   */
  async create(folder: InsertFolder): Promise<Folder> {
    // Check if folder with this name already exists
    const existingFolder = await this.getByName(folder.name);
    if (existingFolder) {
      throw new Error(`Folder with name '${folder.name}' already exists`);
    }
    
    const now = new Date();
    const newFolder: Folder = {
      ...folder,
      id: nextId++,
      createdAt: now,
    };
    
    folders.push(newFolder);
    logger.debug(`Created folder: ${newFolder.id} - ${newFolder.name}`);
    return newFolder;
  }
  
  /**
   * Get a folder by ID
   */
  async getById(id: number): Promise<Folder | null> {
    const folder = folders.find(f => f.id === id);
    return folder || null;
  }
  
  /**
   * Get a folder by name
   */
  async getByName(name: string): Promise<Folder | null> {
    const folder = folders.find(f => f.name.toLowerCase() === name.toLowerCase());
    return folder || null;
  }
  
  /**
   * Get all folders
   */
  async getAll(): Promise<Folder[]> {
    return [...folders];
  }
  
  /**
   * Update a folder
   */
  async update(id: number, update: Partial<Folder>): Promise<Folder | null> {
    const index = folders.findIndex(f => f.id === id);
    
    if (index === -1) {
      return null;
    }
    
    // Check if new name already exists
    if (update.name && update.name !== folders[index].name) {
      const existingFolder = await this.getByName(update.name);
      if (existingFolder) {
        throw new Error(`Folder with name '${update.name}' already exists`);
      }
    }
    
    const updatedFolder: Folder = {
      ...folders[index],
      ...update,
      id, // Ensure ID doesn't change
    };
    
    folders[index] = updatedFolder;
    logger.debug(`Updated folder: ${id}`);
    return updatedFolder;
  }
  
  /**
   * Delete a folder
   */
  async delete(id: number): Promise<boolean> {
    const initialLength = folders.length;
    folders = folders.filter(f => f.id !== id);
    
    const deleted = folders.length < initialLength;
    if (deleted) {
      logger.debug(`Deleted folder: ${id}`);
    }
    
    return deleted;
  }
  
  /**
   * Count all folders
   */
  async count(): Promise<number> {
    return folders.length;
  }
  
  /**
   * Reset the model (for testing)
   */
  reset(): void {
    folders = [];
    nextId = 1;
  }
}

export const folderModel = new FolderModel();
