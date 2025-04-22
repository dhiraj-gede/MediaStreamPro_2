import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { googleDriveService } from '../services/googleDrive';
import { fileProcessor } from '../services/fileProcessor';
import { jobQueue } from '../services/jobQueue';
import { chunker } from '../utils/chunker';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { fileCategories } from '@shared/schema';
import { z } from 'zod';
import { UploadModel } from 'server/models/mongoose';

const router = Router();

// Initialize Google Drive service
googleDriveService.initialize().catch(err => {
  logger.error('Failed to initialize Google Drive service:', err);
});

/**
 * Validate category against allowed values
 */
const validateCategory = (category: string): boolean => {
  return fileCategories.includes(category as any);
};

/**
 * Initialize upload - create upload record
 */
router.post('/api/upload/init', async (req: Request, res: Response) => {
  try {
    const { category, folderName, fileName, fileSize, fileType, totalChunks } = req.body;

    // Validate required fields
    if (!fileName || !fileSize || !fileType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate category
    if (!validateCategory(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Generate unique identifier
    const identifier = uuidv4();

    // Create folder if provided and doesn't exist
    let folderId: string | undefined;

    if (folderName) {
      let folder = await storage.getFolderByName(folderName);

      if (!folder) {
        folder = await storage.createFolder({ name: folderName });
      }

      folderId = folder.id.toString();
    }

    // Create file record
    const file = await storage.createFile({
      name: fileName,
      size: parseInt(fileSize, 10),
      mimeType: fileType,
    });

    // Create upload record
    const upload = await storage.createUpload({
      identifier,
      fileType,
      externalFileId: 'pending', // Will be updated when upload is complete
      source: 'upload',
      fileId: file.id,
      fileSize: parseInt(fileSize, 10),
      uploadName: fileName,
      category: category as any,
      status: 'processing',
      folderId,
      folderName,
    });

    // Create upload directory
    const uploadDir = path.join('./temp/uploads', `upload_${upload.id}`);
    await fs.mkdir(uploadDir, { recursive: true });

    res.status(200).json({
      uploadId: upload.id,
      identifier,
      totalChunks,
    });
  } catch (error) {
    logger.error('Upload initialization failed:', error);
    res.status(500).json({ error: 'Upload initialization failed' });
  }
});

/**
 * Handle chunk upload
 */
router.post('/api/upload/chunk', async (req: any, res: Response) => {
  const upload = req.app.locals.upload;

  upload.single('chunk')(req, res, async (err: any) => {
    if (err) {
      logger.error('Chunk upload failed:', err);
      return res.status(400).json({ error: err.message });
    }

    try {
      const { uploadId, chunkIndex } = req.body;

      if (!uploadId || chunkIndex === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No chunk file provided' });
      }

      // Process the chunk
      const chunkPath = await chunker.handleUploadedChunk(
        req.file,
        parseInt(uploadId, 10),
        parseInt(chunkIndex, 10),
        './temp/uploads'
      );

      res.status(200).json({
        success: true,
        uploadId,
        chunkIndex,
        path: chunkPath
      });
    } catch (error) {
      logger.error('Chunk upload failed:', error);
      res.status(500).json({ error: 'Chunk upload failed' });
    }
  });
});

/**
 * Complete upload - combine chunks and upload to Google Drive
 */
router.post('/api/upload/complete', async (req: Request, res: Response) => {
  try {
    const { uploadId } = req.body;

    if (!uploadId) {
      return res.status(400).json({ error: 'Missing upload ID' });
    }

    // Get upload record
    const upload = await storage.getUpload(parseInt(uploadId, 10));
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    // Get file record
    const file = await storage.getFile(upload.fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Combine chunks into a complete file
    const outputFilePath = path.join('./temp/uploads', `${uploadId}_${file.name}`);
    const uploadDir = path.join('./temp/uploads', `upload_${uploadId}`);

    // Get total chunks by counting files in upload directory
    const files = await fs.readdir(uploadDir);
    const totalChunks = files.length;
    console.log('total-chunks', totalChunks);

    // Combine chunks
    await chunker.combineUploadedChunks(
      parseInt(uploadId, 10),
      totalChunks,
      './temp/uploads',
      `${uploadId}_${file.name}`
    );
    console.log('uploading...');


    // Upload to Google Drive
    const externalFileId = await googleDriveService.uploadFile(
      outputFilePath,
      file.mimeType,
      file.name
    );
    console.log('externalFileId', externalFileId);

    // Update upload record with external file ID
    await UploadModel.updateOne({ uploadId: parseInt(uploadId, 10) }, {
      externalFileId,
      status: 'ready'
    });

    // Generate thumbnail/preview based on file type
    if (file.mimeType.startsWith('video/')) {
      // Schedule thumbnail generation job
      await jobQueue.addThumbnailJob(parseInt(uploadId, 10), externalFileId);
    } else if (file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf') {
      // Schedule preview generation job
      await jobQueue.addPreviewJob(parseInt(uploadId, 10), externalFileId, file.mimeType);
    }

    // Clean up temporary files
    await fs.unlink(outputFilePath);
    await fs.rm(uploadDir, { recursive: true, force: true });

    res.status(200).json({
      success: true,
      uploadId,
      externalFileId
    });
  } catch (error) {
    logger.error('Upload completion failed:', error);
    res.status(500).json({ error: 'Upload completion failed' });
  }
});

/**
 * Upload entire file in one request (for smaller files)
 */
router.post('/api/upload', async (req: any, res: Response) => {
  const upload = req.app.locals.upload;

  upload.single('file')(req, res, async (err: any) => {
    if (err) {
      logger.error('File upload failed:', err);
      return res.status(400).json({ error: err.message });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const { category, folderId, folderName } = req.body;

      // Validate category
      if (!validateCategory(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }

      // Create file record
      const file = await storage.createFile({
        name: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
      });

      // Upload to Google Drive
      const externalFileId = await googleDriveService.uploadFile(
        req.file.path,
        req.file.mimetype,
        req.file.originalname
      );

      // Create upload record
      const upload = await storage.createUpload({
        fileType: req.file.mimetype,
        externalFileId,
        source: 'upload',
        fileId: file.id,
        fileSize: req.file.size,
        uploadName: req.file.originalname,
        category: category as any,
        status: 'ready',
        folderId,
        folderName,
      });

      // Generate thumbnail/preview based on file type
      if (req.file.mimetype.startsWith('video/')) {
        // Schedule thumbnail generation job
        await jobQueue.addThumbnailJob(upload.id, externalFileId);
      } else if (req.file.mimetype.startsWith('image/') || req.file.mimetype === 'application/pdf') {
        // Schedule preview generation job
        await jobQueue.addPreviewJob(upload.id, externalFileId, req.file.mimetype);
      }

      // Clean up temporary file
      await fs.unlink(req.file.path);

      res.status(200).json({
        success: true,
        uploadId: upload.id,
        externalFileId
      });
    } catch (error) {
      logger.error('File upload failed:', error);
      res.status(500).json({ error: 'File upload failed' });
    }
  });
});

/**
 * Import file from Google Drive
 */
router.get('/api/upload/googledrive', async (req: Request, res: Response) => {
  try {
    const { fileId, uploadName, fileType, category, folderId, folderName } = req.query;

    // Validate required fields
    if (!fileId || !uploadName || !category || !fileType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate category
    if (!validateCategory(category as string)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Download the file to get metadata
    console.log('checker1')
    const tempPath = path.join('./temp', `import_${Date.now()}`);

    // Get file details from Google Drive
    const fileDetails = await googleDriveService.getFile(fileId as string);
    console.log('checker2')
    // Create file record
    const file = await storage.createFile({
      name: uploadName as string,
      size: fileDetails.size || 0,
      mimeType: fileType as string,
    });
    console.log('checker3')

    // Create upload record
    const upload = await storage.createUpload({
      fileType: fileType as string,
      externalFileId: fileId as string,
      source: 'googledrive',
      fileId: file.id,
      fileSize: fileDetails.size || 0,
      uploadName: uploadName as string,
      category: category as any,
      status: 'ready',
      folderId: folderId as string,
      folderName: folderName as string,
    });

    console.log('checker4')
    // Generate thumbnail/preview based on file type
    if ((fileType as string).startsWith('video/')) {
      // Schedule thumbnail generation job
      await jobQueue.addThumbnailJob(upload.id, fileId as string);
    } else if ((fileType as string).startsWith('image/') || fileType === 'application/pdf') {
      // Schedule preview generation job
      await jobQueue.addPreviewJob(upload.id, fileId as string, fileType as string);
    }
    console.log('checker4')

    res.status(200).json({
      success: true,
      uploadId: upload.id,
      externalFileId: fileId
    });
  } catch (error) {
    logger.error('Google Drive import failed:', error);
    res.status(500).json({ error: 'Google Drive import failed' });
  }
});

/**
 * Get all uploads with pagination
 */
router.get('/api/uploads', async (req: Request, res: Response) => {
  try {
    const {
      category,
      folderId,
      page = '1',
      limit = '10'
    } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const pageSize = parseInt(limit as string, 10);

    // Get uploads with pagination - using try/catch for all storage operations
    let uploads: any[] = [];
    try {
      if (category === 'uncategorized') {
        uploads = await googleDriveService.getAllFiles();
      }
      else {

        uploads = await storage.getUploads({
          category: category as string,
          folderId: folderId as string,
          offset: (pageNumber - 1) * pageSize,
          limit: pageSize,
        });
      }

    } catch (err) {
      logger.error('Failed to get uploads:', err);
      uploads = []; // Fallback to empty array
    }

    // Get total count of uploads - without relying on storage.count()
    let total = 0;
    try {
      const allUploads = await storage.getUploads({
        category: category as string,
        folderId: folderId as string
      });
      total = allUploads.length;
    } catch (err) {
      logger.error('Failed to get count:', err);
      total = uploads.length; // Fallback to length of current page uploads
    }

    // Return uploads as "files" to match the client expectation
    res.status(200).json({
      files: uploads,
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    logger.error('Failed to get uploads:', error);
    res.status(500).json({ error: 'Failed to get uploads' });
  }
});

/**
 * Get a specific upload by ID
 */
router.get('/api/uploads/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const upload = await storage.getUpload(parseInt(id, 10));

    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    res.status(200).json(upload);
  } catch (error) {
    logger.error(`Failed to get upload ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get upload' });
  }
});

export function registerUploadRoutes(app: any): void {
  app.use(router);
}
