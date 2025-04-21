import { google } from 'googleapis';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import { Account } from '@shared/schema';
import { logger } from '../utils/logger';
import { storage } from '../storage';

interface ServiceAccount {
  id: number;
  email: string;
  auth: any;
  drive: any;
}

class GoogleDriveService {
  private serviceAccounts: ServiceAccount[] = [];
  private initialized = false;

  /**
   * Initialize all service accounts
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Get all accounts from storage
      const accounts = await storage.getAccounts();

      if (accounts.length === 0) {
        logger.warn('No Google Drive service accounts found. Please add accounts.');
        return;
      }

      // Load credentials for each account
      for (const account of accounts) {
        try {
          await this.loadServiceAccount(account);
        } catch (error) {
          logger.error(`Failed to load service account ${account.email}:`, error);
        }
      }

      if (this.serviceAccounts.length === 0) {
        logger.warn('No service accounts could be loaded. Check credentials directory.');
      } else {
        logger.info(`Successfully loaded ${this.serviceAccounts.length} service accounts`);
      }

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize Google Drive service:', error);
      throw error;
    }
  }

  /**
   * Load a service account from credentials file
   */
  async loadServiceAccount(account: Account): Promise<void> {
    try {
      const credentialsPath = account.credentialsPath;
      const credentials = JSON.parse(
        await fs.readFile(path.resolve(credentialsPath), 'utf-8')
      );

      const auth = new google.auth.JWT(
        credentials.client_email,
        undefined,
        credentials.private_key,
        ['https://www.googleapis.com/auth/drive']
      );

      const drive = google.drive({ version: 'v3', auth });

      this.serviceAccounts.push({
        id: account.id,
        email: account.email,
        auth,
        drive
      });

      logger.info(`Loaded service account: ${account.email}`);
    } catch (error) {
      logger.error(`Failed to load service account: ${account.email}`, error);
      throw error;
    }
  }

  /**
   * Get the optimal service account for uploading based on storage usage
   */
  async getOptimalServiceAccount(): Promise<ServiceAccount> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.serviceAccounts.length === 0) {
      throw new Error('No service accounts available');
    }

    // Get updated account storage usage
    const accounts = await storage.getAccounts();

    // Find the account with the most free space
    let optimalAccount: Account | undefined;
    let maxFreeSpace = -1;

    for (const account of accounts) {
      if (!account.isActive) continue;

      const freeSpace = account.storageLimit - account.storageUsed;
      if (freeSpace > maxFreeSpace) {
        maxFreeSpace = freeSpace;
        optimalAccount = account;
      }
    }

    if (!optimalAccount) {
      throw new Error('No active service accounts available with free space');
    }

    // Find the service account instance that matches the optimal account
    const serviceAccount = this.serviceAccounts.find(
      (sa) => sa.id === optimalAccount!.id
    );

    if (!serviceAccount) {
      throw new Error('Optimal service account not found in loaded accounts');
    }

    return serviceAccount;
  }

  /**
   * Upload a file to Google Drive
   */
  async uploadFile(filePath: string, mimeType: string, fileName: string): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('getting ServiceAccount')
      const serviceAccount = await this.getOptimalServiceAccount();
      console.log('service account', serviceAccount);

      const fileMetadata = {
        name: fileName,
      };

      const media = {
        body: createReadStream(filePath),
      };

      console.log('got media and fileMetadata');

      const response = await serviceAccount.drive.files.create({
        resource: fileMetadata,
        media,
        fields: 'id',
      });
      console.log('upload response', response)

      // Make the file publicly accessible (for streaming)
      await serviceAccount.drive.permissions.create({
        fileId: response.data.id,
        resource: {
          role: 'reader',
          type: 'anyone',
        },
      });

      // Update account storage usage
      const fileStats = await fs.stat(filePath);
      const accountInfo = await storage.getAccount(serviceAccount.id);
      if (accountInfo) {
        await storage.updateAccountUsage(
          serviceAccount.id,
          accountInfo.storageUsed + fileStats.size
        );
      }

      logger.info(`File uploaded to Google Drive: ${fileName}, ID: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      logger.error('Failed to upload file to Google Drive:', error);
      throw error;
    }
  }

  /**
   * Get a file from Google Drive by ID
   */
  async getFile(fileId: string): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Try to get the file from any service account
    for (const serviceAccount of this.serviceAccounts) {
      try {
        const response = await serviceAccount.drive.files.get({
          fileId,
          fields: 'id,name,mimeType,size',
        });

        return response.data;
      } catch (error: any) {
        if (error.code === 404) {
          // Try the next service account
          continue;
        }
        throw error;
      }
    }

    throw new Error(`File not found: ${fileId}`);
  }

  /**
   * Download a file from Google Drive
   */
  async downloadFile(fileId: string, destination: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    for (const serviceAccount of this.serviceAccounts) {
      try {
        const dest = createWriteStream(destination);

        const response = await serviceAccount.drive.files.get(
          { fileId, alt: 'media' },
          { responseType: 'stream' }
        );

        return new Promise((resolve, reject) => {
          response.data
            .on('end', () => {
              logger.info(`Downloaded file ${fileId} to ${destination}`);
              resolve();
            })
            .on('error', (err: Error) => {
              logger.error(`Error downloading file ${fileId}:`, err);
              reject(err);
            })
            .pipe(dest);
        });
      } catch (error: any) {
        if (error.code === 404) {
          // Try the next service account
          continue;
        }
        throw error;
      }
    }

    throw new Error(`File not found: ${fileId}`);
  }

  /**
   * Get a public URL for a file
   */
  getPublicUrl(fileId: string): string {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  /**
   * Delete a file from Google Drive
   */
  async deleteFile(fileId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    for (const serviceAccount of this.serviceAccounts) {
      try {
        await serviceAccount.drive.files.delete({ fileId });
        logger.info(`Deleted file: ${fileId}`);
        return;
      } catch (error: any) {
        if (error.code === 404) {
          // Try the next service account
          continue;
        }
        throw error;
      }
    }

    throw new Error(`File not found: ${fileId}`);
  }

  /**
   * Update storage usage stats for all accounts
   */
  async updateStorageStats(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    for (const serviceAccount of this.serviceAccounts) {
      try {
        const response = await serviceAccount.drive.about.get({
          fields: 'storageQuota',
        });

        const { storageQuota } = response.data;
        const usedBytes = parseInt(storageQuota.usage, 10);

        await storage.updateAccountUsage(serviceAccount.id, usedBytes);
        logger.info(`Updated storage usage for account ${serviceAccount.email}: ${usedBytes} bytes`);
      } catch (error) {
        logger.error(`Failed to update storage stats for ${serviceAccount.email}:`, error);
      }
    }
  }

  /**
   * Import a file from Google Drive by ID
   */
  async importFile(fileId: string, destination: string): Promise<{
    name: string;
    mimeType: string;
    size: number;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Get file metadata
    let fileMetadata = null;
    for (const serviceAccount of this.serviceAccounts) {
      try {
        const response = await serviceAccount.drive.files.get({
          fileId,
          fields: 'id,name,mimeType,size',
        });
        fileMetadata = response.data;
        break;
      } catch (error) {
        // Try next account
        continue;
      }
    }

    if (!fileMetadata) {
      throw new Error(`File not found: ${fileId}`);
    }

    // Download the file
    await this.downloadFile(fileId, destination);

    return {
      name: fileMetadata.name,
      mimeType: fileMetadata.mimeType,
      size: parseInt(fileMetadata.size, 10),
    };
  }
}

export const googleDriveService = new GoogleDriveService();
