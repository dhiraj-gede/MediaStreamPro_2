import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { googleDriveService } from '../services/googleDrive';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { insertAccountSchema } from '@shared/schema';

const router = Router();

/**
 * Get all accounts with storage usage
 */
router.get('/api/accounts/usage', async (req: Request, res: Response) => {
  try {
    // Get all accounts
    const accounts = await storage.getAccounts();
    
    // Calculate percentage free for each account
    const accountsWithUsage = accounts.map(account => {
      const percentUsed = account.storageLimit > 0 
        ? Math.round((account.storageUsed / account.storageLimit) * 100) 
        : 0;
      
      return {
        id: account.id,
        name: account.name,
        email: account.email,
        storageLimit: account.storageLimit,
        storageUsed: account.storageUsed,
        percentUsed,
        percentFree: 100 - percentUsed,
        isActive: account.isActive,
        createdAt: account.createdAt
      };
    });
    
    res.status(200).json(accountsWithUsage);
  } catch (error) {
    logger.error('Failed to get accounts usage:', error);
    res.status(500).json({ error: 'Failed to get accounts usage' });
  }
});

/**
 * Add a new service account
 */
router.post('/api/accounts', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = insertAccountSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validationResult.error.format() 
      });
    }
    
    const { email, name, credentialsPath, storageLimit, isActive } = validationResult.data;
    
    // Check if account with this email already exists
    const existingAccount = await storage.getAccountByEmail(email);
    
    if (existingAccount) {
      return res.status(400).json({ error: 'Account with this email already exists' });
    }
    
    // Create account
    const account = await storage.createAccount({
      email,
      name,
      credentialsPath,
      storageLimit,
      isActive: isActive !== undefined ? isActive : true,
    });
    
    // Try to load the service account to verify credentials
    try {
      await googleDriveService.loadServiceAccount(account);
    } catch (error) {
      // If loading fails, delete the account and return error
      await storage.deleteAccount(account.id);
      return res.status(400).json({ error: 'Failed to load service account credentials' });
    }
    
    res.status(201).json(account);
  } catch (error) {
    logger.error('Failed to add service account:', error);
    res.status(500).json({ error: 'Failed to add service account' });
  }
});

/**
 * Update an existing service account
 */
router.patch('/api/accounts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, storageLimit, isActive } = req.body;
    
    // Check if account exists
    const account = await storage.getAccount(parseInt(id, 10));
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Update account
    const updatedAccount = await storage.updateAccount(parseInt(id, 10), {
      name: name !== undefined ? name : account.name,
      storageLimit: storageLimit !== undefined ? storageLimit : account.storageLimit,
      isActive: isActive !== undefined ? isActive : account.isActive,
    });
    
    res.status(200).json(updatedAccount);
  } catch (error) {
    logger.error(`Failed to update account ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

/**
 * Delete a service account
 */
router.delete('/api/accounts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if account exists
    const account = await storage.getAccount(parseInt(id, 10));
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Delete account
    await storage.deleteAccount(parseInt(id, 10));
    
    res.status(204).send();
  } catch (error) {
    logger.error(`Failed to delete account ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

/**
 * Refresh storage usage for all accounts
 */
router.post('/api/accounts/refresh-usage', async (req: Request, res: Response) => {
  try {
    // Update storage usage stats
    await googleDriveService.updateStorageStats();
    
    // Get updated accounts
    const accounts = await storage.getAccounts();
    
    res.status(200).json({ 
      success: true, 
      message: 'Storage usage refreshed successfully',
      accounts
    });
  } catch (error) {
    logger.error('Failed to refresh storage usage:', error);
    res.status(500).json({ error: 'Failed to refresh storage usage' });
  }
});

export function registerAccountRoutes(app: any): void {
  app.use(router);
}
