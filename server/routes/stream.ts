import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { googleDriveService } from '../services/googleDrive';
import { hlsConverter } from '../services/hlsConverter';
import { fileProcessor } from '../services/fileProcessor';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';

const router = Router();

/**
 * Generate and serve HLS playlist for a video
 */
router.get('/api/stream/playlist/:uploadId', async (req: Request, res: Response) => {
  try {
    const { uploadId } = req.params;
    const { resolution } = req.query;
    
    // Validate upload ID
    if (!uploadId) {
      return res.status(400).json({ error: 'Missing upload ID' });
    }
    
    // Get upload
    const upload = await storage.getUpload(parseInt(uploadId, 10));
    
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }
    
    // Check if file is a video
    if (!upload.fileType.startsWith('video/')) {
      return res.status(400).json({ error: 'File is not a video' });
    }
    
    try {
      // Generate playlist
      const playlist = await hlsConverter.generatePlaylist(
        parseInt(uploadId, 10), 
        resolution as string
      );
      
      // Set Content-Type header
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      res.send(playlist);
    } catch (error) {
      // If no HLS chunks found, return error
      logger.error(`No HLS chunks found for upload ${uploadId}:`, error);
      return res.status(404).json({ error: 'No HLS chunks found for this video' });
    }
  } catch (error) {
    logger.error('Failed to generate HLS playlist:', error);
    res.status(500).json({ error: 'Failed to generate HLS playlist' });
  }
});

/**
 * Generate and serve HLS master playlist for a video
 */
router.get('/api/stream/master/:uploadId', async (req: Request, res: Response) => {
  try {
    const { uploadId } = req.params;
    
    // Validate upload ID
    if (!uploadId) {
      return res.status(400).json({ error: 'Missing upload ID' });
    }
    
    // Get upload
    const upload = await storage.getUpload(parseInt(uploadId, 10));
    
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }
    
    // Check if file is a video
    if (!upload.fileType.startsWith('video/')) {
      return res.status(400).json({ error: 'File is not a video' });
    }
    
    try {
      // Generate master playlist
      const masterPlaylistPath = await hlsConverter.generateMasterPlaylist(parseInt(uploadId, 10));
      
      // Create read stream for master playlist
      const fileStream = fs.createReadStream(masterPlaylistPath);
      
      // Set Content-Type header
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      
      // Pipe file stream to response
      fileStream.pipe(res);
    } catch (error) {
      // If no HLS chunks found, return error
      logger.error(`No HLS chunks found for upload ${uploadId}:`, error);
      return res.status(404).json({ error: 'No HLS chunks found for this video' });
    }
  } catch (error) {
    logger.error('Failed to generate HLS master playlist:', error);
    res.status(500).json({ error: 'Failed to generate HLS master playlist' });
  }
});

/**
 * Stream HLS chunk
 */
router.get('/api/chunk/hls-stream', async (req: Request, res: Response) => {
  try {
    const { chunkId } = req.query;
    
    // Validate chunk ID
    if (!chunkId) {
      return res.status(400).json({ error: 'Missing chunk ID' });
    }
    
    // Get chunk
    const chunk = await storage.getChunk(parseInt(chunkId as string, 10));
    
    if (!chunk) {
      return res.status(404).json({ error: 'Chunk not found' });
    }
    
    try {
      // Get chunk file from cache or download from Google Drive
      const chunkPath = await fileProcessor.getFileFromCacheOrDownload(
        chunk.externalFileId,
        `_${chunk.uploadId}_${chunk.resolution}_${chunk.index}.ts`
      );
      
      // Create read stream for chunk
      const fileStream = fs.createReadStream(chunkPath);
      
      // Set Content-Type header
      res.set('Content-Type', 'video/mp2t');
      
      // Pipe file stream to response
      fileStream.pipe(res);
    } catch (error) {
      logger.error(`Failed to stream chunk ${chunkId}:`, error);
      return res.status(404).json({ error: 'Chunk not found or inaccessible' });
    }
  } catch (error) {
    logger.error('Failed to stream HLS chunk:', error);
    res.status(500).json({ error: 'Failed to stream HLS chunk' });
  }
});

/**
 * Get video preview/thumbnail
 */
router.get('/api/preview/:uploadId', async (req: Request, res: Response) => {
  try {
    const { uploadId } = req.params;
    
    // Get upload
    const upload = await storage.getUpload(parseInt(uploadId, 10));
    
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }
    
    // If upload has a thumbnail, redirect to it
    if (upload.thumbnail) {
      return res.json({ thumbnailId: upload.thumbnail });
    }
    
    // If no thumbnail but file is an image, use the original file
    if (upload.fileType.startsWith('image/')) {
      return res.json({ thumbnailId: upload.externalFileId });
    }
    
    // No preview available
    return res.status(404).json({ error: 'No preview available' });
  } catch (error) {
    logger.error('Failed to get preview:', error);
    res.status(500).json({ error: 'Failed to get preview' });
  }
});

/**
 * Download a file
 */
router.get('/api/download/:uploadId', async (req: Request, res: Response) => {
  try {
    const { uploadId } = req.params;
    
    // Get upload
    const upload = await storage.getUpload(parseInt(uploadId, 10));
    
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }
    
    // Get file name for Content-Disposition header
    const fileName = upload.uploadName;
    
    // Redirect to Google Drive download URL
    const downloadUrl = googleDriveService.getPublicUrl(upload.externalFileId);
    res.redirect(downloadUrl);
  } catch (error) {
    logger.error('Failed to download file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

export function registerStreamRoutes(app: any): void {
  app.use(router);
}
