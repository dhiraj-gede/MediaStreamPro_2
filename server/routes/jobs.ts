import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { jobQueue, JobType } from '../services/jobQueue';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { videoResolutions } from '@shared/schema';

const router = Router();

// Validation schema for creating HLS conversion job
const createHlsJobSchema = z.object({
  uploadId: z.number(),
  resolutions: z.array(z.enum(videoResolutions)),
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
        details: validationResult.error.format() 
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
    const jobs = [];
    
    for (const resolution of resolutions) {
      // Check if conversion already exists
      const existingConversions = await storage.getConversionsByUploadId(uploadId);
      const existingConversion = existingConversions.find(c => c.resolution === resolution);
      
      if (existingConversion) {
        // Skip if conversion is already complete
        if (existingConversion.status === 'ready') {
          jobs.push({
            conversionId: existingConversion.id,
            resolution,
            status: 'ready',
            message: 'Conversion already complete'
          });
          continue;
        }
        
        // Reset failed conversion
        if (existingConversion.status === 'failed') {
          await storage.updateConversionStatus(existingConversion.id, 'waiting', 0);
          jobs.push({
            conversionId: existingConversion.id,
            resolution,
            status: 'waiting',
            message: 'Retrying failed conversion'
          });
          
          // Add to job queue
          await jobQueue.addHlsConversionJob(
            uploadId,
            existingConversion.id,
            resolution,
            upload.externalFileId
          );
          continue;
        }
        
        // Skip if conversion is in progress
        if (existingConversion.status === 'processing' || existingConversion.status === 'waiting') {
          jobs.push({
            conversionId: existingConversion.id,
            resolution,
            status: existingConversion.status,
            message: `Conversion already ${existingConversion.status}`
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
      
      // Add to job queue
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
        message: 'Conversion job created'
      });
    }
    
    // Update upload status to processing if not already
    if (upload.status !== 'processing') {
      await storage.updateUploadStatus(uploadId, 'processing');
    }
    
    res.status(200).json({ 
      success: true,
      uploadId,
      jobs
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
    const { jobId } = req.query;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Missing job ID' });
    }
    
    const conversion = await storage.getConversion(parseInt(jobId as string, 10));
    
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
    const { uploadId } = req.query;
    
    if (!uploadId) {
      return res.status(400).json({ error: 'Missing upload ID' });
    }
    
    const conversions = await storage.getConversionsByUploadId(parseInt(uploadId as string, 10));
    
    // Get upload details for context
    const upload = await storage.getUpload(parseInt(uploadId as string, 10));
    
    // Format response
    const response = {
      uploadId: parseInt(uploadId as string, 10),
      fileName: upload?.uploadName,
      fileType: upload?.fileType,
      status: conversions.length > 0 
        ? conversions.every(c => c.status === 'ready') 
          ? 'ready' 
          : conversions.some(c => c.status === 'processing') 
            ? 'processing' 
            : 'waiting'
        : 'none',
      progress: conversions.length > 0 
        ? Math.round(conversions.reduce((sum, c) => sum + c.progress, 0) / conversions.length) 
        : 0,
      resolutions: conversions.map(c => c.resolution),
      resolutionStatus: conversions.map(c => ({
        resolution: c.resolution,
        status: c.status,
        progress: c.progress,
        error: c.error
      })),
      conversions
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
    // Get all conversions with status waiting or processing
    const conversions = await storage.getActiveConversions();
    
    // Group by uploadId
    const groupedConversions: { [key: string]: any } = {};
    
    for (const conversion of conversions) {
      const uploadId = conversion.uploadId.toString();
      
      if (!groupedConversions[uploadId]) {
        // Get upload details
        const upload = await storage.getUpload(conversion.uploadId);
        
        groupedConversions[uploadId] = {
          uploadId: conversion.uploadId,
          fileName: upload?.uploadName,
          fileType: upload?.fileType,
          status: 'processing',
          progress: 0,
          resolutions: [],
          resolutionStatus: [],
          conversions: []
        };
      }
      
      groupedConversions[uploadId].resolutions.push(conversion.resolution);
      groupedConversions[uploadId].resolutionStatus.push({
        resolution: conversion.resolution,
        status: conversion.status,
        progress: conversion.progress,
        error: conversion.error
      });
      groupedConversions[uploadId].conversions.push(conversion);
    }
    
    // Calculate overall progress for each upload
    for (const uploadId in groupedConversions) {
      const jobs = groupedConversions[uploadId].conversions;
      groupedConversions[uploadId].progress = Math.round(
        jobs.reduce((sum: number, job: any) => sum + job.progress, 0) / jobs.length
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
    const { status } = req.query;
    
    let conversions: any[] = [];
    
    if (status && status !== 'all') {
      // Get conversions by status
      conversions = await storage.getConversionsByStatus(status as any);
    } else {
      // Get all conversions
      conversions = await storage.getAllConversions();
    }
    
    // Get upload details for each conversion
    const response = await Promise.all(conversions.map(async (conversion) => {
      const upload = await storage.getUpload(conversion.uploadId);
      
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
        error: conversion.error
      };
    }));
    
    res.status(200).json(response);
  } catch (error) {
    logger.error('Failed to get jobs:', error);
    res.status(500).json({ error: 'Failed to get jobs' });
  }
});

export function registerJobRoutes(app: any): void {
  app.use(router);
}
