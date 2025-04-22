import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { access, constants } from 'fs/promises';
import { googleDriveService } from './googleDrive';
import { hlsConverter } from './hlsConverter';
import { logger } from '../utils/logger';

// Attempt to use pdf2pic if available, otherwise handle gracefully
let pdf2pic: any;
try {
  const { fromPath } = require('pdf2pic');
  pdf2pic = fromPath;
} catch (error) {
  logger.warn('pdf2pic module not available, PDF preview generation will be limited');
}

class FileProcessor {
  private tempDir: string;
  private cacheDir: string;

  constructor() {
    this.tempDir = path.resolve('./temp');
    this.cacheDir = path.resolve('./temp/cache');
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create required directories:', error);
      throw error;
    }
  }

  /**
   * Generate a thumbnail for a video file
   */
  async generateVideoThumbnail(uploadId: number, externalFileId: string): Promise<string> {
    try {
      // Download the video file from Google Drive
      const videoPath = path.join(this.tempDir, `${uploadId}_thumbnail_original.mp4`);
      const thumbnailPath = path.join(this.tempDir, `${uploadId}_thumbnail.jpg`);

      await googleDriveService.downloadFile(externalFileId, videoPath);

      // Generate thumbnail using FFmpeg
      await hlsConverter.generateThumbnail(videoPath, thumbnailPath);
      console.log('thumbnailPath', thumbnailPath, videoPath);

      // Upload thumbnail to Google Drive
      const thumbnailId = await googleDriveService.uploadFile(
        thumbnailPath,
        'image/jpeg',
        `${uploadId}_thumbnail.jpg`
      );
      console.log('success')

      // Clean up temporary files
      await fs.rm(videoPath, { force: true });
      await fs.rm(thumbnailPath, { force: true });
      console.log('cleanUp completed')

      return thumbnailId;
    } catch (error) {
      logger.error(`Failed to generate video thumbnail for upload ${uploadId}:`, error);
      throw error;
    }
  }

  /**
   * Generate a thumbnail for an image file
   */
  async generateImageThumbnail(uploadId: number, externalFileId: string): Promise<string> {
    try {
      // Download the image file from Google Drive
      const imagePath = path.join(this.tempDir, `${uploadId}_original.jpg`);
      const thumbnailPath = path.join(this.tempDir, `${uploadId}_thumbnail.jpg`);

      await googleDriveService.downloadFile(externalFileId, imagePath);
      // Generate thumbnail using Sharp
      await sharp(imagePath)
        .resize(200, 200, { fit: 'inside' })
        .toFile(thumbnailPath);

      // Upload thumbnail to Google Drive
      const thumbnailId = await googleDriveService.uploadFile(
        thumbnailPath,
        'image/jpeg',
        `${uploadId}_thumbnail.jpg`
      );

      // Clean up temporary files
      await fs.rm(imagePath, { force: true });
      await fs.rm(thumbnailPath, { force: true });

      return thumbnailId;
    } catch (error) {
      logger.error(`Failed to generate image thumbnail for upload ${uploadId}:`, error);
      throw error;
    }
  }

  /**
   * Generate a preview for a PDF file
   */
  async generatePdfPreview(uploadId: number, externalFileId: string): Promise<string> {
    try {
      // Download the PDF file from Google Drive
      const pdfPath = path.join(this.tempDir, `${uploadId}_original.pdf`);
      const previewPath = path.join(this.tempDir, `${uploadId}_preview.jpg`);

      await googleDriveService.downloadFile(externalFileId, pdfPath);

      // Generate preview from first page
      if (pdf2pic) {
        const pdfToPicture = pdf2pic(pdfPath, {
          format: 'jpg',
          size: 1000,
          density: 100,
          savePath: this.tempDir,
          saveFilename: `${uploadId}_preview`,
        });

        await pdfToPicture(1);
      } else {
        // If pdf2pic is not available, create a placeholder preview
        await sharp({
          create: {
            width: 595,
            height: 842,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          }
        })
          .composite([{
            input: Buffer.from(`<svg width="595" height="842" xmlns="http://www.w3.org/2000/svg">
            <rect width="595" height="842" fill="#f5f5f5"/>
            <text x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="24" fill="#666">
              PDF Preview
            </text>
            <text x="50%" y="55%" text-anchor="middle" font-family="Arial" font-size="16" fill="#999">
              (Preview generation limited)
            </text>
          </svg>`),
            top: 0,
            left: 0
          }])
          .toFile(previewPath);
      }

      // Upload preview to Google Drive
      const previewId = await googleDriveService.uploadFile(
        previewPath,
        'image/jpeg',
        `${uploadId}_preview.jpg`
      );

      // Clean up temporary files
      await fs.rm(pdfPath, { force: true });
      await fs.rm(previewPath, { force: true });

      return previewId;
    } catch (error) {
      logger.error(`Failed to generate PDF preview for upload ${uploadId}:`, error);
      throw error;
    }
  }

  /**
   * Process a file based on its type
   */
  async processFile(uploadId: number, filePath: string, fileType: string): Promise<void> {
    try {
      if (fileType.startsWith('video/')) {
        // For videos, use the jobQueue to generate thumbnail
        // This is handled by the upload route
      } else if (fileType.startsWith('image/')) {
        // For images, generate thumbnail
        await this.generateImageThumbnail(uploadId, filePath);
      } else if (fileType === 'application/pdf') {
        // For PDFs, generate preview
        await this.generatePdfPreview(uploadId, filePath);
      }
      // For zip files, no processing needed
    } catch (error) {
      logger.error(`Failed to process file ${uploadId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a file exists in the cache
   */
  async fileExistsInCache(filePath: string): Promise<boolean> {
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get a file from the cache or download it
   */
  async getFileFromCacheOrDownload(
    externalFileId: string,
    suffix: string = '',
    maxCacheTime: number = 24 * 60 * 60 * 1000 // 24 hours
  ): Promise<string> {
    const cacheFilePath = path.join(this.cacheDir, `${externalFileId}${suffix}`);

    try {
      // Check if file exists in cache
      if (await this.fileExistsInCache(cacheFilePath)) {
        // Check if cache is not expired
        const stats = await fs.stat(cacheFilePath);
        const fileAge = Date.now() - stats.mtimeMs;

        if (fileAge < maxCacheTime) {
          return cacheFilePath; // Return cached file path
        }
      }

      // Download the file from Google Drive
      await googleDriveService.downloadFile(externalFileId, cacheFilePath);
      return cacheFilePath;
    } catch (error) {
      logger.error(`Failed to get file from cache or download: ${externalFileId}`, error);
      throw error;
    }
  }
}

export const fileProcessor = new FileProcessor();
