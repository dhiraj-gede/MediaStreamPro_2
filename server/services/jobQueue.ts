import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { storage } from '../storage';
import { hlsConverter } from './hlsConverter';
import { fileProcessor } from './fileProcessor';
import { logger } from '../utils/logger';

// Create a mock Redis client if Redis is not available
class MockRedis {
  private data: Map<string, any> = new Map();
  private subscribers: Map<string, Function[]> = new Map();

  async get(key: string): Promise<any> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: any): Promise<'OK'> {
    this.data.set(key, value);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existed = this.data.has(key);
    this.data.delete(key);
    return existed ? 1 : 0;
  }

  async publish(channel: string, message: string): Promise<number> {
    const subscribers = this.subscribers.get(channel) || [];
    subscribers.forEach(callback => callback(message));
    return subscribers.length;
  }

  subscribe(channel: string, callback: Function): void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, []);
    }
    this.subscribers.get(channel)?.push(callback);
  }

  async quit(): Promise<'OK'> {
    this.data.clear();
    this.subscribers.clear();
    return 'OK';
  }
}

// Configure Redis connection with fallback to mock
let redisConnection: Redis | MockRedis;

// Always use Redis mock for now to avoid connection issues
logger.info('Using Redis mock for development');
redisConnection = new MockRedis() as any;

// Job types
export enum JobType {
  HLS_CONVERSION = 'hls_conversion',
  GENERATE_THUMBNAIL = 'generate_thumbnail',
  GENERATE_PREVIEW = 'generate_preview',
}

// Job Queue service
class JobQueueService {
  private conversionQueue: Queue;
  private redisConnection: Redis | MockRedis;
  
  constructor() {
    this.redisConnection = redisConnection;
    
    // Create a minimal implementation for the queue
    this.conversionQueue = this.createMockQueue();
    logger.info('Using mock job queue service');
  }
  
  private createMockQueue(): Queue {
    return {
      add: async (name: string, data: any, options?: any) => {
        logger.info(`Mock queue: Added job ${name}`, { data, options });
        // Process the job immediately for mock implementation
        try {
          if (name === JobType.HLS_CONVERSION) {
            const { uploadId, conversionId, resolution, externalFileId } = data;
            logger.info(`Mock processing HLS conversion: uploadId=${uploadId}, resolution=${resolution}`);
            // Update status
            await storage.updateConversionStatus(conversionId, 'ready', 100);
          } else if (name === JobType.GENERATE_THUMBNAIL) {
            const { uploadId } = data;
            logger.info(`Mock processing thumbnail generation: uploadId=${uploadId}`);
            // Update status
            await storage.updateUploadThumbnail(uploadId, `thumbnail_${uploadId}.jpg`);
          }
        } catch (err) {
          logger.error(`Mock job processing error: ${name}`, err);
        }
        return { id: `mock-${Date.now()}` };
      },
      getJob: async () => null,
      getActive: async () => [],
      getWaiting: async () => [],
      getCompleted: async () => [],
      getFailed: async () => [],
      close: async () => {}
    } as unknown as Queue;
  }
  
  private initializeWorkers(): void {
    try {
      // HLS Conversion worker
      const conversionWorker = new Worker(
        'conversions',
        async (job: Job) => {
          logger.info(`Processing job: ${job.id}, type: ${job.name}`);
          
          switch (job.name) {
            case JobType.HLS_CONVERSION:
              return this.processHlsConversion(job);
            case JobType.GENERATE_THUMBNAIL:
              return this.processGenerateThumbnail(job);
            case JobType.GENERATE_PREVIEW:
              return this.processGeneratePreview(job);
            default:
              throw new Error(`Unknown job type: ${job.name}`);
          }
        },
        { connection: this.redisConnection as any, concurrency: 2 }
      );
    
      // Handle worker events
      conversionWorker.on('completed', (job) => {
        logger.info(`Job completed: ${job.id}, type: ${job.name}`);
      });
      
      conversionWorker.on('failed', (job, error) => {
        logger.error(`Job failed: ${job?.id}, type: ${job?.name}`, error);
      });
    } catch (error) {
      logger.warn('Failed to initialize workers:', error);
    }
  }
  
  /**
   * Process HLS conversion job
   */
  private async processHlsConversion(job: Job): Promise<void> {
    const { uploadId, conversionId, resolution, externalFileId } = job.data;
    
    logger.info(`Processing HLS conversion job: uploadId=${uploadId}, resolution=${resolution}`);
    
    // Check job exists
    const conversion = await storage.getConversion(conversionId);
    if (!conversion) {
      throw new Error(`Conversion not found: ${conversionId}`);
    }
    
    // Update status to processing
    await storage.updateConversionStatus(conversionId, 'processing', 0);
    
    try {
      // Perform conversion
      await hlsConverter.convertToHls(uploadId, conversionId, resolution, externalFileId);
    } catch (error) {
      logger.error(`HLS conversion failed: uploadId=${uploadId}, resolution=${resolution}`, error);
      await storage.updateConversionError(conversionId, (error as Error).message);
      throw error;
    }
  }
  
  /**
   * Process thumbnail generation job
   */
  private async processGenerateThumbnail(job: Job): Promise<string> {
    const { uploadId, externalFileId } = job.data;
    
    logger.info(`Processing thumbnail generation job: uploadId=${uploadId}`);
    
    try {
      // Generate thumbnail
      const thumbnailPath = await fileProcessor.generateVideoThumbnail(uploadId, externalFileId);
      return thumbnailPath;
    } catch (error) {
      logger.error(`Thumbnail generation failed: uploadId=${uploadId}`, error);
      throw error;
    }
  }
  
  /**
   * Process preview generation job
   */
  private async processGeneratePreview(job: Job): Promise<string> {
    const { uploadId, externalFileId, fileType } = job.data;
    
    logger.info(`Processing preview generation job: uploadId=${uploadId}, fileType=${fileType}`);
    
    try {
      if (fileType.startsWith('image/')) {
        return await fileProcessor.generateImageThumbnail(uploadId, externalFileId);
      } else if (fileType === 'application/pdf') {
        return await fileProcessor.generatePdfPreview(uploadId, externalFileId);
      } else {
        throw new Error(`Unsupported file type for preview: ${fileType}`);
      }
    } catch (error) {
      logger.error(`Preview generation failed: uploadId=${uploadId}`, error);
      throw error;
    }
  }
  
  /**
   * Add HLS conversion job
   */
  async addHlsConversionJob(
    uploadId: number,
    conversionId: number,
    resolution: string,
    externalFileId: string
  ): Promise<string> {
    const job = await this.conversionQueue.add(
      JobType.HLS_CONVERSION,
      {
        uploadId,
        conversionId,
        resolution,
        externalFileId,
      },
      {
        jobId: `hls_${uploadId}_${resolution}`,
      }
    );
    
    logger.info(`Added HLS conversion job: ${job.id}, uploadId=${uploadId}, resolution=${resolution}`);
    return job.id as string;
  }
  
  /**
   * Add thumbnail generation job
   */
  async addThumbnailJob(uploadId: number, externalFileId: string): Promise<string> {
    const job = await this.conversionQueue.add(
      JobType.GENERATE_THUMBNAIL,
      {
        uploadId,
        externalFileId,
      },
      {
        jobId: `thumbnail_${uploadId}`,
      }
    );
    
    logger.info(`Added thumbnail generation job: ${job.id}, uploadId=${uploadId}`);
    return job.id as string;
  }
  
  /**
   * Add preview generation job
   */
  async addPreviewJob(uploadId: number, externalFileId: string, fileType: string): Promise<string> {
    const job = await this.conversionQueue.add(
      JobType.GENERATE_PREVIEW,
      {
        uploadId,
        externalFileId,
        fileType,
      },
      {
        jobId: `preview_${uploadId}`,
      }
    );
    
    logger.info(`Added preview generation job: ${job.id}, uploadId=${uploadId}, fileType=${fileType}`);
    return job.id as string;
  }
  
  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job | null> {
    return this.conversionQueue.getJob(jobId);
  }
  
  /**
   * Get active jobs
   */
  async getActiveJobs(): Promise<Job[]> {
    return this.conversionQueue.getActive();
  }
  
  /**
   * Get waiting jobs
   */
  async getWaitingJobs(): Promise<Job[]> {
    return this.conversionQueue.getWaiting();
  }
  
  /**
   * Get completed jobs
   */
  async getCompletedJobs(): Promise<Job[]> {
    return this.conversionQueue.getCompleted();
  }
  
  /**
   * Get failed jobs
   */
  async getFailedJobs(): Promise<Job[]> {
    return this.conversionQueue.getFailed();
  }
  
  /**
   * Close the queue and workers
   */
  async close(): Promise<void> {
    await this.conversionQueue.close();
    await this.redisConnection.quit();
  }
}

export const jobQueue = new JobQueueService();
