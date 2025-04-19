import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { insertFolderSchema } from '@shared/schema';

const router = Router();

/**
 * Get all folders
 */
router.get('/api/folders', async (req: Request, res: Response) => {
  try {
    const folders = await storage.getFolders();
    res.status(200).json(folders);
  } catch (error) {
    logger.error('Failed to get folders:', error);
    res.status(500).json({ error: 'Failed to get folders' });
  }
});

/**
 * Create a new folder
 */
router.post('/api/folders', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = insertFolderSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validationResult.error.format() 
      });
    }
    
    const { name } = validationResult.data;
    
    // Check if folder with this name already exists
    const existingFolder = await storage.getFolderByName(name);
    
    if (existingFolder) {
      return res.status(400).json({ error: 'Folder with this name already exists' });
    }
    
    // Create folder
    const folder = await storage.createFolder({ name });
    
    res.status(201).json(folder);
  } catch (error) {
    logger.error('Failed to create folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

/**
 * Update a folder
 */
router.put('/api/folders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    // Validate name
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    // Check if folder exists
    const folder = await storage.getFolder(parseInt(id, 10));
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Check if another folder with this name already exists
    const existingFolder = await storage.getFolderByName(name);
    
    if (existingFolder && existingFolder.id !== parseInt(id, 10)) {
      return res.status(400).json({ error: 'Another folder with this name already exists' });
    }
    
    // Update folder
    const updatedFolder = await storage.updateFolder(parseInt(id, 10), { name });
    
    res.status(200).json(updatedFolder);
  } catch (error) {
    logger.error(`Failed to update folder ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

/**
 * Delete a folder
 */
router.delete('/api/folders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if folder exists
    const folder = await storage.getFolder(parseInt(id, 10));
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Get uploads in this folder
    const uploads = await storage.getUploads({ folderId: id });
    
    if (uploads.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete folder with files in it', 
        count: uploads.length 
      });
    }
    
    // Delete folder
    await storage.deleteFolder(parseInt(id, 10));
    
    res.status(204).send();
  } catch (error) {
    logger.error(`Failed to delete folder ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

/**
 * Get uploads by folder
 */
router.get('/api/folders/:id/uploads', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = '1', limit = '10' } = req.query;
    
    // Check if folder exists
    const folder = await storage.getFolder(parseInt(id, 10));
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    const pageNumber = parseInt(page as string, 10);
    const pageSize = parseInt(limit as string, 10);
    
    // Get uploads in this folder
    const uploads = await storage.getUploads({
      folderId: id,
      offset: (pageNumber - 1) * pageSize,
      limit: pageSize,
    });
    
    // Get total count for pagination
    const total = await storage.count({ folderId: id });
    
    res.status(200).json({
      files: uploads,
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    logger.error(`Failed to get uploads for folder ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get uploads for folder' });
  }
});

export function registerFileRoutes(app: any): void {
  app.use(router);
}
