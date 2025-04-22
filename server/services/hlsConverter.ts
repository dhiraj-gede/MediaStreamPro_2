import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { access, constants } from 'fs/promises';
import { storage } from '../storage';
import { googleDriveService } from './googleDrive';
import { logger } from '../utils/logger';
import { JobStatus } from '@shared/schema';

// Define HLS conversion settings for different resolutions
const resolutionSettings = {
  '1080p': {
    width: 1920,
    height: 1080,
    videoBitrate: '5000k',
    audioBitrate: '192k',
  },
  '720p': {
    width: 1280,
    height: 720,
    videoBitrate: '2500k',
    audioBitrate: '128k',
  },
  '360p': {
    width: 640,
    height: 360,
    videoBitrate: '800k',
    audioBitrate: '96k',
  },
};

class HlsConverter {
  private tempDir: string;
  private outputDir: string;

  constructor() {
    this.tempDir = path.resolve('./temp');
    this.outputDir = path.resolve('./temp/hls');
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create required directories:', error);
      throw error;
    }
  }

  /**
   * Check if FFmpeg is installed
   */
  async checkFfmpeg(): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err) => {
        if (err) {
          logger.error('FFmpeg not found or not correctly installed:', err);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Convert a video to HLS format
   */
  async convertToHls(
    uploadId: number,
    conversionId: number,
    resolution: string,
    externalFileId: string
  ): Promise<void> {
    try {
      // Get conversion and upload information
      const conversion = await storage.getConversion(conversionId);
      if (!conversion) {
        throw new Error(`Conversion job not found: ${conversionId}`);
      }

      const upload = await storage.getUpload(uploadId);
      if (!upload) {
        throw new Error(`Upload not found: ${uploadId}`);
      }

      // Update conversion status to processing
      await storage.updateConversionStatus(conversionId, 'processing', 0);

      // Create unique output directory for this conversion
      const outputDirPath = path.join(this.outputDir, `${uploadId}_${resolution}`);
      await fs.mkdir(outputDirPath, { recursive: true });

      // Download the file from Google Drive
      const videoPath = path.join(this.tempDir, `${uploadId}_original.mp4`);
      await googleDriveService.downloadFile(externalFileId, videoPath);

      // Get video duration to calculate progress
      const duration = await this.getVideoDuration(videoPath);

      // Settings based on resolution
      const settings = resolutionSettings[resolution as keyof typeof resolutionSettings];
      if (!settings) {
        throw new Error(`Unsupported resolution: ${resolution}`);
      }

      const outputPattern = path.join(outputDirPath, `segment_%03d.ts`);
      const playlistPath = path.join(outputDirPath, 'playlist.m3u8');

      // Start conversion
      await new Promise<void>((resolve, reject) => {
        let lastProgress = 0;

        ffmpeg(videoPath)
          .outputOptions([
            '-profile:v main',
            '-level 3.1',
            '-start_number 0',
            '-hls_time 10', // 10-second chunks
            '-hls_list_size 0',
            '-f hls',
            `-vf scale=${settings.width}:${settings.height}`,
            `-b:v ${settings.videoBitrate}`,
            `-b:a ${settings.audioBitrate}`,
          ])
          .output(outputPattern)
          .on('progress', async (progress) => {
            const currentProgress = Math.round(progress.percent ?? 0);
            
            // Only update if progress has changed significantly
            if (currentProgress >= lastProgress + 5) {
              await storage.updateConversionProgress(conversionId, currentProgress);
              lastProgress = currentProgress;
              logger.info(`HLS conversion progress for ${uploadId} (${resolution}): ${currentProgress}%`);
            }
          })
          .on('end', async () => {
            try {
              // Create a list of chunks
              const chunkFiles = await fs.readdir(outputDirPath);
              const segments = chunkFiles.filter(file => file.endsWith('.ts'))
                .sort((a, b) => {
                  const numA = parseInt(a.match(/segment_(\d+)\.ts/)?.[1] || '0', 10);
                  const numB = parseInt(b.match(/segment_(\d+)\.ts/)?.[1] || '0', 10);
                  return numA - numB;
                });

              // Upload each segment to Google Drive
              for (let i = 0; i < segments.length; i++) {
                const segmentPath = path.join(outputDirPath, segments[i]);
                const segmentId = await googleDriveService.uploadFile(
                  segmentPath, 
                  'video/mp2t', 
                  `${uploadId}_${resolution}_segment_${i}.ts`
                );
                
                // Create chunk record in database
                await storage.createChunk({
                  uploadId,
                  index: i,
                  duration: 10, // Assuming 10 second segments
                  resolution,
                  path: segmentPath,
                  externalFileId: segmentId,
                });
              }

              // Upload the playlist file
              const playlistContent = await fs.readFile(playlistPath, 'utf-8');
              
              // Modify playlist content to use chunk IDs
              const chunks = await storage.getChunksByUploadId(uploadId, resolution);
              let modifiedPlaylist = playlistContent;
              
              for (let i = 0; i < chunks.length; i++) {
                modifiedPlaylist = modifiedPlaylist.replace(
                  `segment_${i.toString().padStart(3, '0')}.ts`,
                  `/api/chunk/hls-stream?chunkId=${chunks[i].id}`
                );
              }
              
              // Save modified playlist
              await fs.writeFile(playlistPath, modifiedPlaylist);
              
              // Update conversion status to ready
              await storage.updateConversionStatus(conversionId, 'ready', 100);
              
              // Check if all conversions are complete
              const conversions = await storage.getConversionsByUploadId(uploadId);
              const allReady = conversions.every(conv => conv.status === 'ready' || conv.status === 'failed');
              
              if (allReady) {
                await storage.updateUploadStatus(uploadId, 'ready');
              }
              
              // Clean up temp files
              await fs.rm(videoPath, { force: true });
              
              logger.info(`HLS conversion completed for ${uploadId} (${resolution})`);
              resolve();
            } catch (error) {
              reject(error);
            }
          })
          .on('error', async (err) => {
            logger.error(`HLS conversion failed for ${uploadId} (${resolution}):`, err);
            await storage.updateConversionError(conversionId, err.message || 'Unknown error');
            reject(err);
          })
          .run();
      });
    } catch (error) {
      logger.error(`HLS conversion failed for ${uploadId} (${resolution}):`, error);
      await storage.updateConversionError(conversionId, (error as Error).message || 'Unknown error');
      throw error;
    }
  }

  /**
   * Get video duration using FFmpeg
   */
  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve(metadata.format.duration || 0);
      });
    });
  }

  /**
   * Generate a thumbnail from a video
   */
  async generateThumbnail(videoPath: string, outputPath: string, timestamp = '00:00:01'): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Starting thumbnail generation', {
        videoPath,
        outputPath,
        timestamp,
      });
  
      const ffmpegCommand = ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '200x200',
        });
  
      console.log('FFmpeg command initiated for thumbnail generation', {
        videoPath,
        outputPath,
      });
  
      ffmpegCommand
        .on('end', () => {
          console.log('Thumbnail generation completed successfully', {
            videoPath,
            outputPath,
          });
          resolve();
        })
        .on('error', (err) => {
          logger.error('Thumbnail generation failed', {
            videoPath,
            outputPath,
            error: err.message,
            stack: err.stack,
          });
          reject(err);
        });
    });
  }

  /**
   * Generate an HLS master playlist for multiple resolutions
   */
  async generateMasterPlaylist(uploadId: number): Promise<string> {
    try {
      const chunks = await storage.getChunksByUploadId(uploadId);
      const resolutions = Array.from(new Set(chunks.map(chunk => chunk.resolution)));
      
      // Create master playlist content
      let masterPlaylist = '#EXTM3U\n';
      masterPlaylist += '#EXT-X-VERSION:3\n';
      
      for (const resolution of resolutions) {
        const settings = resolutionSettings[resolution as keyof typeof resolutionSettings];
        if (!settings) continue;
        
        masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(settings.videoBitrate) * 1000},RESOLUTION=${settings.width}x${settings.height}\n`;
        masterPlaylist += `/api/stream/playlist/${uploadId}?resolution=${resolution}\n`;
      }
      
      const masterPlaylistPath = path.join(this.outputDir, `${uploadId}_master.m3u8`);
      await fs.writeFile(masterPlaylistPath, masterPlaylist);
      
      return masterPlaylistPath;
    } catch (error) {
      logger.error(`Failed to generate master playlist for ${uploadId}:`, error);
      throw error;
    }
  }

  /**
   * Generate an HLS playlist for a specific resolution
   */
  async generatePlaylist(uploadId: number, resolution?: string): Promise<string> {
    try {
      const chunks = await storage.getChunksByUploadId(uploadId, resolution);
      
      if (chunks.length === 0) {
        throw new Error(`No chunks found for upload ${uploadId}${resolution ? ` with resolution ${resolution}` : ''}`);
      }
      
      // Use the first resolution found if none specified
      const useResolution = resolution || chunks[0].resolution;
      
      // Filter chunks for the specific resolution
      const filteredChunks = resolution 
        ? chunks 
        : chunks.filter(chunk => chunk.resolution === useResolution);
      
      if (filteredChunks.length === 0) {
        throw new Error(`No chunks found for resolution ${useResolution}`);
      }
      
      // Create playlist content
      let playlist = '#EXTM3U\n';
      playlist += '#EXT-X-VERSION:3\n';
      playlist += `#EXT-X-TARGETDURATION:${Math.ceil(Math.max(...filteredChunks.map(chunk => chunk.duration)))}\n`;
      playlist += '#EXT-X-MEDIA-SEQUENCE:0\n';
      
      for (const chunk of filteredChunks) {
        playlist += `#EXTINF:${chunk.duration.toFixed(6)},\n`;
        playlist += `/api/chunk/hls-stream?chunkId=${chunk.id}\n`;
      }
      
      playlist += '#EXT-X-ENDLIST\n';
      
      const playlistPath = path.join(this.outputDir, `${uploadId}_${useResolution}_playlist.m3u8`);
      await fs.writeFile(playlistPath, playlist);
      
      return playlist;
    } catch (error) {
      logger.error(`Failed to generate playlist for ${uploadId}:`, error);
      throw error;
    }
  }
}

export const hlsConverter = new HlsConverter();
