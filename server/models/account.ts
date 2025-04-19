import { InsertAccount, Account } from '@shared/schema';
import { logger } from '../utils/logger';

// In-memory collection for testing
let accounts: Account[] = [];
let nextId = 1;

/**
 * In-memory implementation of Account model
 */
class AccountModel {
  constructor() {
    // Initialize with some default accounts for testing
    this.seed();
  }
  
  /**
   * Seed the model with sample accounts
   */
  private async seed(): Promise<void> {
    // Only seed if there are no accounts
    if (accounts.length === 0) {
      try {
        await this.create({
          email: 'primary-storage@cs-edu.iam.gserviceaccount.com',
          name: 'Service Account 1',
          credentialsPath: './credentials/service_accounts/service1.json',
          storageLimit: 75 * 1024 * 1024 * 1024, // 75GB
          isActive: true,
        });
        
        await this.create({
          email: 'backup-storage@cs-edu.iam.gserviceaccount.com',
          name: 'Service Account 2',
          credentialsPath: './credentials/service_accounts/service2.json',
          storageLimit: 75 * 1024 * 1024 * 1024, // 75GB
          isActive: true,
        });
        
        await this.create({
          email: 'media-storage@cs-edu.iam.gserviceaccount.com',
          name: 'Service Account 3',
          credentialsPath: './credentials/service_accounts/service3.json',
          storageLimit: 75 * 1024 * 1024 * 1024, // 75GB
          isActive: true,
        });
        
        // Set some example usage for sample data
        await this.updateUsage(1, 32.5 * 1024 * 1024 * 1024); // 32.5GB
        await this.updateUsage(2, 68.2 * 1024 * 1024 * 1024); // 68.2GB
        await this.updateUsage(3, 24.8 * 1024 * 1024 * 1024); // 24.8GB
        
        logger.info('Seeded account model with sample data');
      } catch (error) {
        logger.error('Failed to seed account model:', error);
      }
    }
  }
  
  /**
   * Create a new account
   */
  async create(account: InsertAccount): Promise<Account> {
    const now = new Date();
    const newAccount: Account = {
      ...account,
      id: nextId++,
      storageUsed: 0,
      createdAt: now,
      updatedAt: now,
    };
    
    accounts.push(newAccount);
    logger.debug(`Created account: ${newAccount.id} - ${newAccount.name} (${newAccount.email})`);
    return newAccount;
  }
  
  /**
   * Get an account by ID
   */
  async getById(id: number): Promise<Account | null> {
    const account = accounts.find(a => a.id === id);
    return account || null;
  }
  
  /**
   * Get an account by email
   */
  async getByEmail(email: string): Promise<Account | null> {
    const account = accounts.find(a => a.email === email);
    return account || null;
  }
  
  /**
   * Get all accounts
   */
  async getAll(): Promise<Account[]> {
    return [...accounts];
  }
  
  /**
   * Get active accounts
   */
  async getActive(): Promise<Account[]> {
    return accounts.filter(a => a.isActive);
  }
  
  /**
   * Update an account
   */
  async update(id: number, update: Partial<Account>): Promise<Account | null> {
    const index = accounts.findIndex(a => a.id === id);
    
    if (index === -1) {
      return null;
    }
    
    const updatedAccount: Account = {
      ...accounts[index],
      ...update,
      id, // Ensure ID doesn't change
      updatedAt: new Date(),
    };
    
    accounts[index] = updatedAccount;
    logger.debug(`Updated account: ${id}`);
    return updatedAccount;
  }
  
  /**
   * Update account storage usage
   */
  async updateUsage(id: number, storageUsed: number): Promise<Account | null> {
    return this.update(id, { storageUsed });
  }
  
  /**
   * Delete an account
   */
  async delete(id: number): Promise<boolean> {
    const initialLength = accounts.length;
    accounts = accounts.filter(a => a.id !== id);
    
    const deleted = accounts.length < initialLength;
    if (deleted) {
      logger.debug(`Deleted account: ${id}`);
    }
    
    return deleted;
  }
  
  /**
   * Reset the model (for testing)
   */
  reset(): void {
    accounts = [];
    nextId = 1;
  }
}

export const accountModel = new AccountModel();
