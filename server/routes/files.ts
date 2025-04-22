import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { insertFolderSchema, Folder, Upload } from '@shared/schema';

const router = Router();

// Validation schema for folder ID parameter
const folderIdSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)).refine((val) => !isNaN(val), {
    message: 'Folder ID must be a valid number',
  }),
});

// Validation schema for update folder request body
const updateFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required'),
});

// Validation schema for query parameters in get uploads
const uploadsQuerySchema = z.object({
  page: z.string().optional().default('1').transform((val) => parseInt(val, 10)).refine((val) => val > 0, {
    message: 'Page must be a positive number',
  }),
  limit: z.string().optional().default('10').transform((val) => parseInt(val, 10)).refine((val) => val > 0, {
    message: 'Limit must be a positive number',
  }),
});

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
        details: validationResult.error.format(),
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
    // Validate folder ID
    const idValidation = folderIdSchema.safeParse(req.params);
    if (!idValidation.success) {
      return res.status(400).json({
        error: 'Invalid folder ID',
        details: idValidation.error.format(),
      });
    }

    // Validate request body
    const bodyValidation = updateFolderSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: bodyValidation.error.format(),
      });
    }

    const { id } = idValidation.data;
    const { name } = bodyValidation.data;

    // Check if folder exists
    const folder = await storage.getFolder(id);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Check if another folder with this name already exists
    const existingFolder = await storage.getFolderByName(name);
    if (existingFolder && existingFolder.id !== id) {
      return res.status(400).json({ error: 'Another folder with this name already exists' });
    }

    // Update folder
    const updatedFolder = await storage.updateFolder(id, { name });
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
    // Validate folder ID
    const validationResult = folderIdSchema.safeParse(req.params);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid folder ID',
        details: validationResult.error.format(),
      });
    }

    const { id } = validationResult.data;

    // Check if folder exists
    const folder = await storage.getFolder(id);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Get uploads in this folder
    const uploads = await storage.getUploads({ folderId: id.toString() });
    if (uploads.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete folder with files in it',
        count: uploads.length,
      });
    }

    // Delete folder
    const deleted = await storage.deleteFolder(id);
    if (!deleted) {
      return res.status(500).json({ error: 'Failed to delete folder' });
    }

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
    // Validate folder ID
    const idValidation = folderIdSchema.safeParse(req.params);
    if (!idValidation.success) {
      return res.status(400).json({
        error: 'Invalid folder ID',
        details: idValidation.error.format(),
      });
    }

    // Validate query parameters
    const queryValidation = uploadsQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: queryValidation.error.format(),
      });
    }

    const { id } = idValidation.data;
    const { page, limit } = queryValidation.data;

    // Check if folder exists
    const folder = await storage.getFolder(id);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Get uploads in this folder
    const uploads = await storage.getUploads({
      folderId: id.toString(),
      offset: (page - 1) * limit,
      limit,
    });

    // Get total count for pagination
    const total = await storage.count({ folderId: id.toString() });

    res.status(200).json({
      files: uploads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error(`Failed to get uploads for folder ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get uploads for folder' });
  }
});

export function registerFileRoutes(app: any): void {
  app.use(router);
}