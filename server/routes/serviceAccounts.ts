import { Router, Request, Response } from 'express';
import { ServiceAccount } from '../models/mongoose';
import { isAuthenticated } from '../config/auth';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';
import fs from 'fs'
import { googleDriveService } from 'server/services/googleDrive';
const router = Router();

/**
 * @route   POST /api/service-accounts
 * @desc    Add a new service account
 * @access  Private
 */
router.post('/api/service-accounts', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { name, email, credentialsPath, storageLimit, isActive } = req.body;

    // Validate required fields
    if (!name || !email || !credentialsPath) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Read credentials from credentialsPath (JSON file)

    let credentials;
    try {
      const credentialsData = fs.readFileSync(credentialsPath, 'utf-8');
      credentials = JSON.parse(credentialsData);
    } catch (err) {
      return res.status(400).json({ error: 'Failed to read or parse credentials file' });
    }

    // Check if credentials is a valid JSON object with required fields
    const requiredFields = [
      'type', 'project_id', 'private_key_id', 'private_key',
      'client_email', 'client_id', 'auth_uri', 'token_uri',
      'auth_provider_x509_cert_url', 'client_x509_cert_url'
    ];

    for (const field of requiredFields) {
      if (!credentials[field]) {
        return res.status(400).json({ error: `Missing required credential field: ${field}` });
      }
    }


    // Check if service account with this email already exists for this user
    const existingAccount = await ServiceAccount.findOne({
      email: credentials.client_email,
      userId: (req.user as any)._id
    });



    if (existingAccount) {
      return res.status(400).json({ error: 'Service account with this email already exists' });
    }



    // Create service account
    const serviceAccount = await ServiceAccount.create({
      name,
      email: credentials.client_email,
      credentials,
      storageLimit: storageLimit || 15 * 1024 * 1024 * 1024, // Default to 15GB
      storageUsed: 0,
      isActive: isActive !== undefined ? isActive : true,
      userId: (req.user as any)._id
    });



    // Remove sensitive information before sending response
    const response = {
      id: serviceAccount._id,
      name: serviceAccount.name,
      email: serviceAccount.email,
      storageLimit: serviceAccount.storageLimit,
      storageUsed: serviceAccount.storageUsed,
      isActive: serviceAccount.isActive,
      createdAt: serviceAccount.createdAt
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Failed to add service account:', error);
    res.status(500).json({ error: 'Failed to add service account' });
  }
});

/**
 * @route   GET /api/service-accounts
 * @desc    Get all service accounts for the current user
 * @access  Private
 */
router.get('/api/service-accounts', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const serviceAccounts = await ServiceAccount.find({ userId: (req.user as any)._id });

    // Remove sensitive information before sending response
    const sanitizedAccounts = serviceAccounts.map(account => ({
      id: account._id,
      name: account.name,
      email: account.email,
      storageLimit: account.storageLimit,
      storageUsed: account.storageUsed,
      isActive: account.isActive,
      createdAt: account.createdAt
    }));

    res.json(sanitizedAccounts);
  } catch (error) {
    logger.error('Failed to get service accounts:', error);
    res.status(500).json({ error: 'Failed to get service accounts' });
  }
});



/**
 * @route   PATCH /api/service-accounts/:id
 * @desc    Update a service account
 * @access  Private
 */
router.patch('/api/service-accounts/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, storageLimit, isActive } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid service account ID' });
    }

    const serviceAccount = await ServiceAccount.findOne({
      _id: id,
      userId: (req.user as any)._id
    });

    if (!serviceAccount) {
      return res.status(404).json({ error: 'Service account not found' });
    }

    // Update fields
    if (name) serviceAccount.name = name;
    if (storageLimit) serviceAccount.storageLimit = storageLimit;
    if (isActive !== undefined) serviceAccount.isActive = isActive;

    await serviceAccount.save();

    // Remove sensitive information before sending response
    const response = {
      id: serviceAccount._id,
      name: serviceAccount.name,
      email: serviceAccount.email,
      storageLimit: serviceAccount.storageLimit,
      storageUsed: serviceAccount.storageUsed,
      isActive: serviceAccount.isActive,
      createdAt: serviceAccount.createdAt,
      updatedAt: serviceAccount.updatedAt
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to update service account:', error);
    res.status(500).json({ error: 'Failed to update service account' });
  }
});

/**
 * @route   DELETE /api/service-accounts/:id
 * @desc    Delete a service account
 * @access  Private
 */
router.delete('/api/service-accounts/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid service account ID' });
    }

    const serviceAccount = await ServiceAccount.findOne({
      _id: id,
      userId: (req.user as any)._id
    });

    if (!serviceAccount) {
      return res.status(404).json({ error: 'Service account not found' });
    }

    // Check if account is being used by any uploads
    // TODO: Add check for active uploads using this service account

    await serviceAccount.deleteOne();

    res.json({ message: 'Service account deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete service account:', error);
    res.status(500).json({ error: 'Failed to delete service account' });
  }
});

/**
 * @route   GET /api/service-accounts/usage
 * @desc    Get overall storage usage for all service accounts
 * @access  Private
 */
router.get('/api/service-accounts/usage', isAuthenticated, async (req: Request, res: Response) => {
  try {

    await googleDriveService.updateStorageStats((req.user as any)._id);
    const serviceAccounts = await ServiceAccount.find({ userId: (req.user as any)._id });
    const usage = {
      total: 0,
      used: 0,
      accounts: serviceAccounts.map(account => ({
        id: account._id,
        name: account.name,
        email: account.email,
        storageLimit: account.storageLimit,
        storageUsed: account.storageUsed,
        isActive: account.isActive
      }))
    };

    // Calculate total and used storage
    usage.accounts.forEach(account => {
      usage.total += account.storageLimit;
      usage.used += account.storageUsed;
    });

    res.json(usage);
  } catch (error) {
    logger.error('Failed to get storage usage:', error);
    res.status(500).json({ error: 'Failed to get storage usage' });
  }
});
/**
 * @route   GET /api/service-accounts/:id
 * @desc    Get a specific service account
 * @access  Private
 */
router.get('/api/service-accounts/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid service account ID' });
    }

    const serviceAccount = await ServiceAccount.findOne({
      _id: id,
      userId: (req.user as any)._id
    });

    if (!serviceAccount) {
      return res.status(404).json({ error: 'Service account not found' });
    }

    // Remove sensitive information before sending response
    const response = {
      id: serviceAccount._id,
      name: serviceAccount.name,
      email: serviceAccount.email,
      storageLimit: serviceAccount.storageLimit,
      storageUsed: serviceAccount.storageUsed,
      isActive: serviceAccount.isActive,
      createdAt: serviceAccount.createdAt
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get service account:', error);
    res.status(500).json({ error: 'Failed to get service account' });
  }
});

export function registerServiceAccountRoutes(app: any): void {
  app.use(router);
  logger.info('Service account routes registered');
}