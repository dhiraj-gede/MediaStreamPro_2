import { InsertChunk, Chunk } from '@shared/schema';
import { logger } from '../utils/logger';

// In-memory collection for testing
let chunks: Chunk[] = [];
let nextId = 1;

/**
 * In-memory implementation of Chunk model
 */
class ChunkModel {
  /**
   * Create a new chunk
   */
  async create(chunk: InsertChunk): Promise<Chunk> {
    const now = new Date();
    const newChunk: Chunk = {
      ...chunk,
      id: nextId++,
      createdAt: now,
    };
    
    chunks.push(newChunk);
    logger.debug(`Created chunk: ${newChunk.id} for upload ${newChunk.uploadId}, index ${newChunk.index}`);
    return newChunk;
  }
  
  /**
   * Get a chunk by ID
   */
  async getById(id: number): Promise<Chunk | null> {
    const chunk = chunks.find(c => c.id === id);
    return chunk || null;
  }
  
  /**
   * Get chunks by upload ID
   */
  async getByUploadId(uploadId: number, resolution?: string): Promise<Chunk[]> {
    let filteredChunks = chunks.filter(c => c.uploadId === uploadId);
    
    if (resolution) {
      filteredChunks = filteredChunks.filter(c => c.resolution === resolution);
    }
    
    // Sort by index
    return filteredChunks.sort((a, b) => a.index - b.index);
  }
  
  /**
   * Get chunks by external file ID
   */
  async getByExternalFileId(externalFileId: string): Promise<Chunk[]> {
    return chunks.filter(c => c.externalFileId === externalFileId);
  }
  
  /**
   * Update a chunk
   */
  async update(id: number, update: Partial<Chunk>): Promise<Chunk | null> {
    const index = chunks.findIndex(c => c.id === id);
    
    if (index === -1) {
      return null;
    }
    
    const updatedChunk: Chunk = {
      ...chunks[index],
      ...update,
      id, // Ensure ID doesn't change
    };
    
    chunks[index] = updatedChunk;
    logger.debug(`Updated chunk: ${id}`);
    return updatedChunk;
  }
  
  /**
   * Delete a chunk
   */
  async delete(id: number): Promise<boolean> {
    const initialLength = chunks.length;
    chunks = chunks.filter(c => c.id !== id);
    
    const deleted = chunks.length < initialLength;
    if (deleted) {
      logger.debug(`Deleted chunk: ${id}`);
    }
    
    return deleted;
  }
  
  /**
   * Delete chunks by upload ID
   */
  async deleteByUploadId(uploadId: number): Promise<number> {
    const initialLength = chunks.length;
    chunks = chunks.filter(c => c.uploadId !== uploadId);
    
    const deletedCount = initialLength - chunks.length;
    if (deletedCount > 0) {
      logger.debug(`Deleted ${deletedCount} chunks for upload ${uploadId}`);
    }
    
    return deletedCount;
  }
  
  /**
   * Count chunks by upload ID
   */
  async countByUploadId(uploadId: number, resolution?: string): Promise<number> {
    if (resolution) {
      return chunks.filter(c => c.uploadId === uploadId && c.resolution === resolution).length;
    }
    return chunks.filter(c => c.uploadId === uploadId).length;
  }
  
  /**
   * Reset the model (for testing)
   */
  reset(): void {
    chunks = [];
    nextId = 1;
  }
}

export const chunkModel = new ChunkModel();
