import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { jobQueue, JobType } from '../services/jobQueue';
import { logger } from '../utils/logger';
import { z } from 'zod';
import {
  videoResolutions, Conversion, Upload, FileStatus, JobStatus
} from '@shared/schema';

const router = Router();

// Validation schema for creating HLS conversion job
const createHlsJobSchema = z.object({
  uploadId: z.number(),
  resolutions: z.array(z.enum(videoResolutions)),
});

// Validation schema for query parameters
const jobIdSchema = z.object({
  jobId: z.string().transform((val) => parseInt(val, 10)).refine((val) => !isNaN(val), {
    message: 'Job ID must be a valid number',
  }),
});

const uploadIdSchema = z.object({
  uploadId: z.string().transform((val) => parseInt(val, 10)).refine((val) => !isNaN(val), {
    message: 'Upload ID must be a valid number',
  }),
});

const statusSchema = z.object({
  status: z.enum(['waiting', 'processing', 'ready', 'failed', 'all']).optional(),
});

/**
 * Create HLS conversion job
 */
router.post('/api/job/hls/create', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = createHlsJobSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.format(),
      });
    }

    const { uploadId, resolutions } = validationResult.data;

    // Check if upload exists
    const upload = await storage.getUpload(uploadId);
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    // Check if file is a video
    if (!upload.fileType.startsWith('video/')) {
      return res.status(400).json({ error: 'File is not a video' });
    }

    // Create conversion jobs for each resolution
    const jobs: { conversionId: number; resolution: string; status: string; message: string }[] = [];

    for (const resolution of resolutions) {
      // Check if conversion already exists
      const existingConversions = await storage.getConversionsByUploadId(uploadId);
      const existingConversion = existingConversions.find((c) => c.resolution === resolution);

      if (existingConversion) {
        if (existingConversion.status === 'ready') {
          jobs.push({
            conversionId: existingConversion.id,
            resolution,
            status: 'ready',
            message: 'Conversion already complete',
          });
          continue;
        }

        if (existingConversion.status === 'failed') {
          await storage.updateConversionStatus(existingConversion.id, 'waiting', 0);
          jobs.push({
            conversionId: existingConversion.id,
            resolution,
            status: 'waiting',
            message: 'Retrying failed conversion',
          });

          await jobQueue.addHlsConversionJob(
            uploadId,
            existingConversion.id,
            resolution,
            upload.externalFileId
          );
          continue;
        }

        if (existingConversion.status === 'processing' || existingConversion.status === 'waiting') {
          jobs.push({
            conversionId: existingConversion.id,
            resolution,
            status: existingConversion.status,
            message: `Conversion already ${existingConversion.status}`,
          });
          continue;
        }
      }

      // Create new conversion job
      const conversion = await storage.createConversion({
        uploadId,
        resolution,
        status: 'waiting',
      });

      await jobQueue.addHlsConversionJob(
        uploadId,
        conversion.id,
        resolution,
        upload.externalFileId
      );

      jobs.push({
        conversionId: conversion.id,
        resolution,
        status: 'waiting',
        message: 'Conversion job created',
      });
    }

    // Update upload status to processing if not already
    if (upload.status !== 'processing') {
      await storage.updateUploadStatus(uploadId, 'processing');
    }

    res.status(200).json({
      success: true,
      uploadId,
      jobs,
    });
  } catch (error) {
    logger.error('Failed to create HLS conversion job:', error);
    res.status(500).json({ error: 'Failed to create HLS conversion job' });
  }
});

/**
 * Get HLS conversion job status
 */
router.get('/api/job/hls/get', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const validationResult = jobIdSchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid job ID',
        details: validationResult.error.format(),
      });
    }

    const { jobId } = validationResult.data;

    const conversion = await storage.getConversion(jobId);
    if (!conversion) {
      return res.status(404).json({ error: 'Conversion job not found' });
    }

    // Get upload details for context
    const upload = await storage.getUpload(conversion.uploadId);

    res.status(200).json({
      id: conversion.id,
      uploadId: conversion.uploadId,
      resolution: conversion.resolution,
      status: conversion.status,
      progress: conversion.progress,
      startedAt: conversion.startedAt,
      completedAt: conversion.completedAt,
      error: conversion.error,
      fileName: upload?.uploadName,
    });
  } catch (error) {
    logger.error('Failed to get HLS conversion job status:', error);
    res.status(500).json({ error: 'Failed to get HLS conversion job status' });
  }
});

/**
 * Get all conversion jobs for an upload
 */
router.get('/api/job/hls/getConversionJobs', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const validationResult = uploadIdSchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid upload ID',
        details: validationResult.error.format(),
      });
    }

    const { uploadId } = validationResult.data;

    const conversions = await storage.getConversionsByUploadId(uploadId);
    const upload = await storage.getUpload(uploadId);

    // Format response
    const response = {
      uploadId,
      fileName: upload?.uploadName,
      fileType: upload?.fileType,
      status: conversions.length > 0
        ? conversions.every((c) => c.status === 'ready')
          ? 'ready'
          : conversions.some((c) => c.status === 'processing')
            ? 'processing'
            : 'waiting'
        : 'none',
      progress: conversions.length > 0
        ? Math.round(conversions.reduce((sum, c) => sum + c.progress, 0) / conversions.length)
        : 0,
      resolutions: conversions.map((c) => c.resolution),
      resolutionStatus: conversions.map((c) => ({
        resolution: c.resolution,
        status: c.status,
        progress: c.progress,
        error: c.error,
      })),
      conversions,
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error('Failed to get conversion jobs:', error);
    res.status(500).json({ error: 'Failed to get conversion jobs' });
  }
});

/**
 * Get all active jobs
 */
router.get('/api/job/hls/active', async (req: Request, res: Response) => {
  try {
    // Get all conversions and filter for active ones (waiting or processing)
    const allConversions = await Promise.all(
      (await storage.getUploads()).map(async (upload) =>
        (await storage.getConversionsByUploadId(upload.id)).map((c) => ({ ...c, upload }))
      )
    );
    const conversions = allConversions
      .flat()
      .filter((c) => c.status === 'waiting' || c.status === 'processing');

    // Group by uploadId
    const groupedConversions: { [key: string]: any } = {};

    for (const conversion of conversions) {
      const uploadId = conversion.uploadId.toString();
      const upload = conversion.upload as Upload;

      if (!groupedConversions[uploadId]) {
        groupedConversions[uploadId] = {
          uploadId: conversion.uploadId,
          fileName: upload?.uploadName,
          fileType: upload?.fileType,
          status: 'processing',
          progress: 0,
          resolutions: [],
          resolutionStatus: [],
          conversions: [],
        };
      }

      groupedConversions[uploadId].resolutions.push(conversion.resolution);
      groupedConversions[uploadId].resolutionStatus.push({
        resolution: conversion.resolution,
        status: conversion.status,
        progress: conversion.progress,
        error: conversion.error,
      });
      groupedConversions[uploadId].conversions.push(conversion);
    }

    // Calculate overall progress for each upload
    for (const uploadId in groupedConversions) {
      const jobs = groupedConversions[uploadId].conversions;
      groupedConversions[uploadId].progress = Math.round(
        jobs.reduce((sum: number, job: Conversion) => sum + job.progress, 0) / jobs.length
      );
    }

    res.status(200).json(Object.values(groupedConversions));
  } catch (error) {
    logger.error('Failed to get active jobs:', error);
    res.status(500).json({ error: 'Failed to get active jobs' });
  }
});

/**
 * Get all jobs by status
 */
router.get('/api/job/hls/all', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const validationResult = statusSchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid status',
        details: validationResult.error.format(),
      });
    }

    const { status } = validationResult.data;

    // Get all conversions and filter by status if provided
    const allConversions = await Promise.all(
      (await storage.getUploads()).map(async (upload) =>
        (await storage.getConversionsByUploadId(upload.id)).map((c) => ({ ...c, upload }))
      )
    );
    let conversions = allConversions.flat();
    if (status && status !== 'all') {
      conversions = conversions.filter((c) => c.status === status);
    }

    // Format response
    const response = conversions.map((conversion) => {
      const upload = conversion.upload as Upload;
      return {
        id: conversion.id,
        uploadId: conversion.uploadId,
        fileName: upload?.uploadName,
        fileType: upload?.fileType,
        resolution: conversion.resolution,
        status: conversion.status,
        progress: conversion.progress,
        startedAt: conversion.startedAt,
        completedAt: conversion.completedAt,
        error: conversion.error,
      };
    });

    res.status(200).json(response);
  } catch (error) {
    logger.error('Failed to get jobs:', error);
    res.status(500).json({ error: 'Failed to get jobs' });
  }
});

export function registerJobRoutes(app: any): void {
  app.use(router);
}