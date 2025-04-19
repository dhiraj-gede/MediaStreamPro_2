import { InsertConversion, Conversion, JobStatus } from '@shared/schema';
import { logger } from '../utils/logger';

// In-memory collection for testing
let conversions: Conversion[] = [];
let nextId = 1;

/**
 * In-memory implementation of Conversion model
 */
class ConversionModel {
  /**
   * Create a new conversion job
   */
  async create(conversion: InsertConversion): Promise<Conversion> {
    const now = new Date();
    const newConversion: Conversion = {
      ...conversion,
      id: nextId++,
      progress: 0,
      status: conversion.status || 'waiting',
      createdAt: now,
      updatedAt: now,
    };
    
    conversions.push(newConversion);
    logger.debug(`Created conversion job: ${newConversion.id} for upload ${newConversion.uploadId}, resolution ${newConversion.resolution}`);
    return newConversion;
  }
  
  /**
   * Get a conversion job by ID
   */
  async getById(id: number): Promise<Conversion | null> {
    const conversion = conversions.find(c => c.id === id);
    return conversion || null;
  }
  
  /**
   * Get conversion jobs by upload ID
   */
  async getByUploadId(uploadId: number): Promise<Conversion[]> {
    return conversions.filter(c => c.uploadId === uploadId);
  }
  
  /**
   * Get conversion jobs by resolution
   */
  async getByResolution(resolution: string): Promise<Conversion[]> {
    return conversions.filter(c => c.resolution === resolution);
  }
  
  /**
   * Get conversion jobs by status
   */
  async getByStatus(status: JobStatus): Promise<Conversion[]> {
    return conversions.filter(c => c.status === status);
  }
  
  /**
   * Get all active conversion jobs (waiting or processing)
   */
  async getActiveJobs(): Promise<Conversion[]> {
    return conversions.filter(c => c.status === 'waiting' || c.status === 'processing');
  }
  
  /**
   * Update a conversion job
   */
  async update(id: number, update: Partial<Conversion>): Promise<Conversion | null> {
    const index = conversions.findIndex(c => c.id === id);
    
    if (index === -1) {
      return null;
    }
    
    const updatedConversion: Conversion = {
      ...conversions[index],
      ...update,
      id, // Ensure ID doesn't change
      updatedAt: new Date(),
    };
    
    conversions[index] = updatedConversion;
    logger.debug(`Updated conversion job: ${id}`);
    return updatedConversion;
  }
  
  /**
   * Update conversion status
   */
  async updateStatus(id: number, status: JobStatus, progress?: number): Promise<Conversion | null> {
    const update: Partial<Conversion> = { status };
    
    if (progress !== undefined) {
      update.progress = progress;
    }
    
    if (status === 'processing' && !conversions.find(c => c.id === id)?.startedAt) {
      update.startedAt = new Date();
    }
    
    if (status === 'ready' || status === 'failed') {
      update.completedAt = new Date();
    }
    
    return this.update(id, update);
  }
  
  /**
   * Update conversion progress
   */
  async updateProgress(id: number, progress: number): Promise<Conversion | null> {
    return this.update(id, { progress });
  }
  
  /**
   * Update conversion error
   */
  async updateError(id: number, error: string): Promise<Conversion | null> {
    return this.update(id, { error, status: 'failed' });
  }
  
  /**
   * Delete a conversion job
   */
  async delete(id: number): Promise<boolean> {
    const initialLength = conversions.length;
    conversions = conversions.filter(c => c.id !== id);
    
    const deleted = conversions.length < initialLength;
    if (deleted) {
      logger.debug(`Deleted conversion job: ${id}`);
    }
    
    return deleted;
  }
  
  /**
   * Delete conversion jobs by upload ID
   */
  async deleteByUploadId(uploadId: number): Promise<number> {
    const initialLength = conversions.length;
    conversions = conversions.filter(c => c.uploadId !== uploadId);
    
    const deletedCount = initialLength - conversions.length;
    if (deletedCount > 0) {
      logger.debug(`Deleted ${deletedCount} conversion jobs for upload ${uploadId}`);
    }
    
    return deletedCount;
  }
  
  /**
   * Count conversion jobs
   */
  async count(options?: {
    uploadId?: number;
    status?: JobStatus;
  }): Promise<number> {
    let count = conversions.length;
    
    if (options?.uploadId) {
      count = conversions.filter(c => c.uploadId === options.uploadId).length;
    }
    
    if (options?.status) {
      count = conversions.filter(c => c.status === options.status).length;
    }
    
    return count;
  }
  
  /**
   * Reset the model (for testing)
   */
  reset(): void {
    conversions = [];
    nextId = 1;
  }
}

export const conversionModel = new ConversionModel();
