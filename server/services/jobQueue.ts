import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { storage } from '../storage';
import { hlsConverter } from './hlsConverter';
import { fileProcessor } from './fileProcessor';
import { logger } from '../utils/logger';
import config from 'server/config';

// Configure Redis connection
const redisConnection = new Redis(config.redis.url || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

// Job types
export enum JobType {
  HLS_CONVERSION = 'hls_conversion',
  GENERATE_THUMBNAIL = 'generate_thumbnail',
  GENERATE_PREVIEW = 'generate_preview',
}

// Job Queue service
class JobQueueService {
  private conversionQueue: Queue;
  private redisConnection: Redis;

  constructor() {
    this.redisConnection = redisConnection;
    this.conversionQueue = new Queue('conversions', {
      connection: this.redisConnection
    });
    this.initializeWorkers();
    logger.info('Job queue service initialized with Redis');
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
        { connection: this.redisConnection, concurrency: 2 }
      );

      conversionWorker.on('completed', (job) => {
        logger.info(`Job completed: ${job.id}, type: ${job.name}`);
      });

      conversionWorker.on('failed', (job, error) => {
        logger.error(`Job failed: ${job?.id}, type: ${job?.name}`, error);
      });
    } catch (error) {
      logger.error('Failed to initialize workers:', error);
      throw error;
    }
  }

  private async processHlsConversion(job: Job): Promise<void> {
    const { uploadId, conversionId, resolution, externalFileId } = job.data;

    logger.info(`Processing HLS conversion job: uploadId=${uploadId}, resolution=${resolution}`);

    const conversion = await storage.getConversion(conversionId);
    if (!conversion) {
      throw new Error(`Conversion not found: ${conversionId}`);
    }

    await storage.updateConversionStatus(conversionId, 'processing', 0);

    try {
      await hlsConverter.convertToHls(uploadId, conversionId, resolution, externalFileId);
    } catch (error) {
      logger.error(`HLS conversion failed: uploadId=${uploadId}, resolution=${resolution}`, error);
      await storage.updateConversionError(conversionId, (error as Error).message);
      throw error;
    }
  }

  private async processGenerateThumbnail(job: Job): Promise<string> {
    const { uploadId, externalFileId } = job.data;

    logger.info(`Processing thumbnail generation job: uploadId=${uploadId}`);

    try {
      return await fileProcessor.generateVideoThumbnail(uploadId, externalFileId);
    } catch (error) {
      logger.error(`Thumbnail generation failed: uploadId=${uploadId}`, error);
      throw error;
    }
  }

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
    return job.id ?? '';
  }

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
    return job.id ?? '';
  }

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
    return job.id ?? '';
  }

  async getJob(jobId: string): Promise<Job | null> {
    return this.conversionQueue.getJob(jobId);
  }

  async getActiveJobs(): Promise<Job[]> {
    return this.conversionQueue.getActive();
  }

  async getWaitingJobs(): Promise<Job[]> {
    return this.conversionQueue.getWaiting();
  }

  async getCompletedJobs(): Promise<Job[]> {
    return this.conversionQueue.getCompleted();
  }

  async getFailedJobs(): Promise<Job[]> {
    return this.conversionQueue.getFailed();
  }

  async close(): Promise<void> {
    await this.conversionQueue.close();
    await this.redisConnection.quit();
  }
}

export const jobQueue = new JobQueueService();