import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { logger } from './logger';

/**
 * Utility for chunking large files
 */
class Chunker {
  /**
   * Create chunks from a file
   */
  async chunkFile(
    filePath: string,
    outputDir: string,
    chunkSize: number = 10 * 1024 * 1024, // Default: 10MB
    prefix: string = 'chunk_'
  ): Promise<string[]> {
    try {
      // Get file size
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      
      // Create output directory if it doesn't exist
      await fs.mkdir(outputDir, { recursive: true });
      
      // Calculate number of chunks
      const numChunks = Math.ceil(fileSize / chunkSize);
      const chunkPaths: string[] = [];
      
      // Process each chunk
      for (let i = 0; i < numChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(fileSize, start + chunkSize) - 1;
        const chunkPath = path.join(outputDir, `${prefix}${i.toString().padStart(5, '0')}`);
        
        await this.writeChunk(filePath, chunkPath, start, end);
        chunkPaths.push(chunkPath);
      }
      
      logger.info(`Successfully chunked file: ${filePath} into ${numChunks} chunks`);
      return chunkPaths;
    } catch (error) {
      logger.error(`Failed to chunk file: ${filePath}`, error);
      throw error;
    }
  }
  
  /**
   * Write a chunk of a file to a new file
   */
  private async writeChunk(
    sourceFilePath: string,
    outputFilePath: string,
    start: number,
    end: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const readStream = createReadStream(sourceFilePath, { start, end });
      const writeStream = createWriteStream(outputFilePath);
      
      readStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
      
      readStream.pipe(writeStream);
    });
  }
  
  /**
   * Merge chunks back into a single file
   */
  async mergeChunks(
    chunkPaths: string[],
    outputFilePath: string
  ): Promise<void> {
    try {
      // Sort chunks by name to ensure correct order
      const sortedChunks = [...chunkPaths].sort();
      
      // Create write stream for output file
      const writeStream = createWriteStream(outputFilePath);
      
      // Process each chunk in sequence
      for (const chunkPath of sortedChunks) {
        await new Promise<void>((resolve, reject) => {
          const readStream = createReadStream(chunkPath);
          
          readStream.on('error', reject);
          readStream.on('end', resolve);
          
          readStream.pipe(writeStream, { end: false });
        });
      }
      
      // Close the write stream
      await new Promise<void>((resolve, reject) => {
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
        writeStream.end();
      });
      
      logger.info(`Successfully merged ${sortedChunks.length} chunks into: ${outputFilePath}`);
    } catch (error) {
      logger.error(`Failed to merge chunks into: ${outputFilePath}`, error);
      throw error;
    }
  }
  
  /**
   * Process an uploaded file chunk
   */
  async handleUploadedChunk(
    chunkFile: Express.Multer.File,
    uploadId: number,
    chunkIndex: number,
    tempDir: string
  ): Promise<string> {
    try {
      // Create directory for chunks if it doesn't exist
      const chunkDir = path.join(tempDir, `upload_${uploadId}`);
      await fs.mkdir(chunkDir, { recursive: true });
      
      // Define chunk path
      const chunkPath = path.join(chunkDir, `chunk_${chunkIndex.toString().padStart(5, '0')}`);
      
      // Move uploaded chunk to the target path
      await fs.rename(chunkFile.path, chunkPath);
      
      logger.info(`Processed chunk ${chunkIndex} for upload ${uploadId}`);
      return chunkPath;
    } catch (error) {
      logger.error(`Failed to process uploaded chunk ${chunkIndex} for upload ${uploadId}`, error);
      throw error;
    }
  }
  
  /**
   * Combine uploaded chunks into a complete file
   */
  async combineUploadedChunks(
    uploadId: number,
    totalChunks: number,
    tempDir: string,
    outputFileName: string
  ): Promise<string> {
    try {
      // Create directory for chunks if it doesn't exist
      const chunkDir = path.join(tempDir, `upload_${uploadId}`);
      
      // Define output file path
      const outputFilePath = path.join(tempDir, outputFileName);
      
      // Get all chunk paths
      const chunkPaths: string[] = [];
      
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(chunkDir, `chunk_${i.toString().padStart(5, '0')}`);
        chunkPaths.push(chunkPath);
      }
      
      // Merge chunks
      await this.mergeChunks(chunkPaths, outputFilePath);
      
      // Clean up chunk directory
      await fs.rm(chunkDir, { recursive: true, force: true });
      
      logger.info(`Successfully combined ${totalChunks} chunks for upload ${uploadId}`);
      return outputFilePath;
    } catch (error) {
      logger.error(`Failed to combine chunks for upload ${uploadId}`, error);
      throw error;
    }
  }
}

export const chunker = new Chunker();
