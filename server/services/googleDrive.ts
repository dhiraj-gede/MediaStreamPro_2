import { google } from 'googleapis';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { IServiceAccount, ServiceAccount as MongooseServiceAccount } from 'server/models/mongoose';
import { Account } from '@shared/schema';
import { logger } from '../utils/logger';
import { storage } from '../storage';

interface GoogleDriveServiceAccount {
  email: string;
  auth: any;
  drive: any;
  id?: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  accountEmail: string;
  createdAt: string;
  category: string;
  status: string;
  thumbnail: string;
}

class GoogleDriveService {
  private serviceAccounts: GoogleDriveServiceAccount[] = [];
  private initialized = false;

  async initialize(userId?: string): Promise<void> {
    logger.debug(`Starting initialization: userId=${userId || 'none'}`);

    if (this.initialized) {
      logger.debug('Service already initialized, skipping');
      return;
    }

    try {
      logger.debug(`Fetching service accounts: userId=${userId || 'all'}`);
      let accounts;
      if (userId) {
        accounts = await MongooseServiceAccount.find({ userId });
      } else {
        accounts = await MongooseServiceAccount.find();
      }

      if (accounts.length === 0) {
        logger.warn('No Google Drive service accounts found.');
        return;
      }

      logger.debug(`Found ${accounts.length} service accounts to load`);
      for (const account of accounts) {
        try {
          logger.debug(`Loading service account: email=${account.email}`);
          await this.loadServiceAccount(account);
          logger.debug(`Successfully loaded service account: email=${account.email}`);
        } catch (error) {
          logger.error(`Failed to load service account ${account.email}:`, error);
        }
      }

      if (this.serviceAccounts.length === 0) {
        logger.warn('No valid service accounts loaded.');
      } else {
        logger.info(`Loaded ${this.serviceAccounts.length} service accounts.`);
      }

      logger.debug('Setting initialized flag to true');
      this.initialized = true;
    } catch (error) {
      logger.error('Initialization failed:', error);
      throw error;
    }
  }

  async loadServiceAccount(account: IServiceAccount): Promise<void> {
    const { credentials, email, id } = account;
    logger.debug(`Starting to load service account: email=${email}, id=${id}`);

    try {
      logger.debug(`Creating JWT auth for service account: client_email=${credentials.client_email}`);
      const auth = new google.auth.JWT(
        credentials.client_email,
        undefined,
        credentials.private_key,
        ['https://www.googleapis.com/auth/drive']
      );

      logger.debug(`Initializing Google Drive API client for: email=${email}`);
      const drive = google.drive({ version: 'v3', auth });

      logger.debug(`Adding service account to list: email=${email}, id=${id}`);
      this.serviceAccounts.push({ email, auth, drive, id: id?.toString() });
      logger.info(`Service account loaded: ${email}`);
    } catch (error) {
      logger.error(`Error loading service account: ${email}`, error);
      throw error;
    }
  }

  async getOptimalServiceAccount(): Promise<GoogleDriveServiceAccount> {
    logger.debug('Starting getOptimalServiceAccount');

    if (!this.initialized) {
      logger.debug('Initializing service due to uninitialized state');
      await this.initialize();
    }

    logger.debug(`Checking available service accounts: count=${this.serviceAccounts.length}`);
    if (this.serviceAccounts.length === 0) {
      logger.error('No available service accounts.');
      throw new Error('No available service accounts.');
    }

    logger.debug('Fetching accounts from storage');
    const accounts = await storage.getAccounts();
    logger.debug(`Retrieved ${accounts.length} accounts from storage`);

    let optimal: Account | undefined;
    let maxFree = -1;

    for (const acc of accounts) {
      if (!acc.isActive) {
        logger.debug(`Skipping inactive account: id=${acc._id}`);
        continue;
      }
      const free = acc.storageLimit - acc.storageUsed;
      logger.debug(`Evaluating account: id=${acc._id}, freeSpace=${free}`);
      if (free > maxFree) {
        maxFree = free;
        optimal = acc;
      }
    }

    if (!optimal) {
      logger.error('No active service accounts with available storage.');
      throw new Error('No active service accounts with available storage.');
    }
    console.log(
      'optimal', optimal._id, this.serviceAccounts
    )

    logger.debug(`Selected optimal account: id=${optimal._id}`);
    const selected = this.serviceAccounts.find((sa) => sa.id === optimal._id.toString());
    if (!selected) {
      logger.error(`Matching service account not found for id=${optimal._id}`);
      throw new Error('Matching service account not found.');
    }

    logger.debug(`Returning optimal service account: email=${selected.email}, id=${selected.id}`);
    return selected;
  }

  async uploadFile(filePath: string, mimeType: string, fileName: string): Promise<string> {
    logger.debug(`Starting file upload: filePath=${filePath}, mimeType=${mimeType}, fileName=${fileName}`);

    if (!this.initialized) {
      logger.debug('Initializing GoogleDriveService');
      await this.initialize();
    }

    logger.debug('Selecting optimal service account');
    const serviceAccount = await this.getOptimalServiceAccount();
    logger.debug(`Selected service account: email=${serviceAccount.email}, id=${serviceAccount.id}`);

    const media = { body: createReadStream(filePath) };
    const fileMetadata = { name: fileName };

    logger.debug(`Sending file creation request to Google Drive: fileName=${fileName}`);
    const response = await serviceAccount.drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id',
    });

    logger.debug(`Setting public read permissions for file: fileId=${response.data.id}`);
    await serviceAccount.drive.permissions.create({
      fileId: response.data.id,
      resource: { role: 'reader', type: 'anyone' },
    });

    logger.debug(`Retrieving file stats: filePath=${filePath}`);
    const stats = await fs.stat(filePath);
    if (serviceAccount.id === undefined) {
      logger.error('Service account id is undefined');
      throw new Error('Service account id is undefined.');
    }

    logger.debug(`Retrieving account info for service account: id=${serviceAccount.id}`);
    const accountInfo = await storage.getAccount(Number(serviceAccount.id));

    if (accountInfo) {
      logger.debug(`Updating storage usage for service account: id=${serviceAccount.id}, newUsage=${accountInfo.storageUsed + stats.size}`);
      await storage.updateAccountUsage(serviceAccount.id, accountInfo.storageUsed + stats.size);
    } else {
      logger.debug(`No account info found for service account: id=${serviceAccount.id}`);
    }

    logger.info(`Uploaded file: ${fileName}, ID: ${response.data.id}`);
    return response.data.id;
  }

  async getFile(fileId: string): Promise<any> {
    logger.debug(`Starting getFile: fileId=${fileId}`);
    console.log('check');

    if (!this.initialized) {
      logger.debug('Initializing GoogleDriveService');
      await this.initialize();
    }
    console.log('check2');

    logger.debug(`Iterating through ${this.serviceAccounts.length} service accounts to find file: fileId=${fileId}`);
    for (const sa of this.serviceAccounts) {
      try {
        logger.debug(`Attempting to get file from service account: email=${sa.email}, fileId=${fileId}`);
        const response = await sa.drive.files.get({
          fileId,
          fields: 'id,name,mimeType,size',
        });
        logger.debug(`File found: fileId=${fileId}, name=${response.data.name}`);
        return response.data;
      } catch (error: any) {
        if (error.code === 404) {
          logger.debug(`File not found in service account: email=${sa.email}, fileId=${fileId}`);
          continue;
        }
        logger.error(`Error getting file: fileId=${fileId}, serviceAccount=${sa.email}`, error);
        throw error;
      }
    }

    logger.error(`File not found across all service accounts: fileId=${fileId}`);
    throw new Error(`File not found: ${fileId}`);
  }

  async downloadFile(fileId: string, destination: string): Promise<void> {
    logger.debug(`Starting downloadFile: fileId=${fileId}, destination=${destination}`);

    if (!this.initialized) {
      logger.debug('Initializing GoogleDriveService');
      await this.initialize();
    }

    logger.debug(`Iterating through ${this.serviceAccounts.length} service accounts to download file: fileId=${fileId}`);
    for (const sa of this.serviceAccounts) {
      try {
        logger.debug(`Creating write stream: destination=${destination}`);
        const dest = createWriteStream(destination);
        logger.debug(`Requesting file download from service account: email=${sa.email}, fileId=${fileId}`);
        const response = await sa.drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

        logger.debug(`Starting file stream for download: fileId=${fileId}`);
        await new Promise<void>((resolve, reject) => {
          (response.data as NodeJS.ReadableStream)
            .on('end', (): void => {
              logger.info(`Downloaded file ${fileId} to ${destination}`);
              resolve();
            })
            .on('error', (err: Error): void => {
              logger.error(`Download error for file ${fileId}:`, err);
              reject(err);
            })
            .pipe(dest);
        });
        logger.debug(`Download completed: fileId=${fileId}, destination=${destination}`);
        return;
      } catch (error: any) {
        if (error.code === 404) {
          logger.debug(`File not found in service account: email=${sa.email}, fileId=${fileId}`);
          continue;
        }
        logger.error(`Error downloading file: fileId=${fileId}, serviceAccount=${sa.email}`, error);
        throw error;
      }
    }

    logger.error(`File not found across all service accounts: fileId=${fileId}`);
    throw new Error(`File not found: ${fileId}`);
  }

  async deleteFile(fileId: string): Promise<void> {
    logger.debug(`Starting deleteFile: fileId=${fileId}`);

    if (!this.initialized) {
      logger.debug('Initializing GoogleDriveService');
      await this.initialize();
    }

    logger.debug(`Iterating through ${this.serviceAccounts.length} service accounts to delete file: fileId=${fileId}`);
    for (const sa of this.serviceAccounts) {
      try {
        logger.debug(`Attempting to delete file from service account: email=${sa.email}, fileId=${fileId}`);
        await sa.drive.files.delete({ fileId });
        logger.info(`Deleted file: ${fileId}`);
        logger.debug(`File deleted successfully: fileId=${fileId}, serviceAccount=${sa.email}`);
        return;
      } catch (error: any) {
        if (error.code === 404) {
          logger.debug(`File not found in service account: email=${sa.email}, fileId=${fileId}`);
          continue;
        }
        logger.error(`Error deleting file: fileId=${fileId}, serviceAccount=${sa.email}`, error);
        throw error;
      }
    }

    logger.error(`File not found across all service accounts: fileId=${fileId}`);
    throw new Error(`File not found: ${fileId}`);
  }

  async updateStorageStats(userId: string): Promise<void> {
    logger.debug(`Starting updateStorageStats: userId=${userId}`);

    if (!this.initialized) {
      logger.debug(`Initializing GoogleDriveService for userId=${userId}`);
      await this.initialize(userId);
    }

    logger.debug(`Iterating through ${this.serviceAccounts.length} service accounts to update storage stats`);
    for (const sa of this.serviceAccounts) {
      try {
        logger.debug(`Fetching storage quota for service account: email=${sa.email}`);
        const res = await sa.drive.about.get({ fields: 'storageQuota' });
        const quota = res.data.storageQuota;

        const used = parseInt(quota.usage ?? '0', 10);
        const limit = quota.limit === 'UNLIMITED' ? Number.MAX_SAFE_INTEGER : parseInt(quota.limit ?? '0', 10);
        logger.debug(`Updating storage stats: email=${sa.email}, used=${used}, limit=${limit}`);
        (sa && sa.id && await storage.updateAccountUsage(sa.id, used))

        logger.info(`Updated storage stats for ${sa.email} — Used: ${used}, Limit: ${quota.limit}`);
      } catch (error) {
        logger.error(`Storage stats update failed for ${sa.id}:`, error);
      }
    }

    logger.debug(`Completed updateStorageStats for userId=${userId}`);
  }

  async importFile(fileId: string, destination: string): Promise<{
    name: string;
    mimeType: string;
    size: number;
  }> {
    logger.debug(`Starting importFile: fileId=${fileId}, destination=${destination}`);

    if (!this.initialized) {
      logger.debug('Initializing GoogleDriveService');
      await this.initialize();
    }

    let metadata = null;
    logger.debug(`Iterating through ${this.serviceAccounts.length} service accounts to get file metadata: fileId=${fileId}`);
    for (const sa of this.serviceAccounts) {
      try {
        logger.debug(`Attempting to get file metadata from service account: email=${sa.email}, fileId=${fileId}`);
        const response = await sa.drive.files.get({ fileId, fields: 'id,name,mimeType,size' });
        metadata = response.data;
        logger.debug(`File metadata retrieved: fileId=${fileId}, name=${metadata.name}`);
        break;
      } catch {
        logger.debug(`File metadata not found in service account: email=${sa.email}, fileId=${fileId}`);
        continue;
      }
    }

    if (!metadata) {
      logger.error(`File not found across all service accounts: fileId=${fileId}`);
      throw new Error(`File not found: ${fileId}`);
    }

    logger.debug(`Downloading file: fileId=${fileId}, destination=${destination}`);
    await this.downloadFile(fileId, destination);
    logger.debug(`File imported successfully: fileId=${fileId}, name=${metadata.name}`);

    return {
      name: metadata.name,
      mimeType: metadata.mimeType,
      size: parseInt(metadata.size, 10),
    };
  }

  async getAllFiles(): Promise<DriveFile[]> {
    logger.debug('Starting getAllFiles');

    if (!this.initialized) {
      logger.debug('Initializing GoogleDriveService');
      await this.initialize();
    }

    logger.debug(`Checking available service accounts: count=${this.serviceAccounts.length}`);
    if (this.serviceAccounts.length === 0) {
      logger.warn('No service accounts available to fetch files.');
      return [];
    }

    const allFiles: DriveFile[] = [];
    const fileIds = new Set<string>(); // To avoid duplicates across accounts
    logger.debug(`Iterating through ${this.serviceAccounts.length} service accounts to fetch files`);

    for (const sa of this.serviceAccounts) {
      try {
        let nextPageToken: string | undefined;
        logger.debug(`Fetching files for service account: email=${sa.email}`);
        do {
          logger.debug(`Requesting file list: email=${sa.email}, pageToken=${nextPageToken || 'none'}`);
          const response = await sa.drive.files.list({
            pageSize: 1000,
            fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, fileExtension, thumbnailLink)',
            pageToken: nextPageToken,
          });

          const files = response.data.files || [];
          console.log('files', files[6]);
          logger.debug(`Retrieved ${files.length} files from page: email=${sa.email}`);

          for (const file of files) {
            if (file.id && !fileIds.has(file.id)) {
              logger.debug(`Adding file: id=${file.id}, name=${file.name}, email=${sa.email}`);
              allFiles.push({
                id: file.id,
                name: file.name || 'Unnamed',
                mimeType: file.mimeType || 'application/octet-stream',
                size: parseInt(file.size || '0', 10),
                accountEmail: sa.email,
                createdAt: file.createdTime,
                status: 'ready',
                category: file.fileExtension || 'N/A',
                thumbnail: file.thumbnailLink,
              });
              fileIds.add(file.id);
            }
          }

          nextPageToken = response.data.nextPageToken;
        } while (nextPageToken);

        logger.info(`Retrieved ${fileIds.size} files from account ${sa.email}`);
      } catch (error) {
        logger.error(`Failed to retrieve files from account ${sa.email}:`, error);
        continue;
      }
    }

    logger.info(`Total files retrieved: ${allFiles.length}`);
    logger.debug(`Completed getAllFiles: totalFiles=${allFiles.length}`);
    return allFiles;
  }

  getPublicUrl(fileId: string): string {
    logger.debug(`Generating public URL for file: fileId=${fileId}`);
    const url = `https://drive.google.com/uc?export=view&id=${fileId}`;
    logger.debug(`Generated public URL: fileId=${fileId}, url=${url}`);
    return url;
  }
}

export const googleDriveService = new GoogleDriveService();