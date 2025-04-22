import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { join } from "path";
import fs from "fs/promises";
import { mkdir } from "fs/promises";
import { logger } from './utils/logger';
import { isAuthenticated } from './config/auth';

// Import route modules
import { registerUploadRoutes } from "./routes/upload";
import { registerJobRoutes } from "./routes/jobs";
import { registerStreamRoutes } from "./routes/stream";
import { registerFileRoutes } from "./routes/files";
import { registerAuthRoutes } from "./routes/auth";
import { registerServiceAccountRoutes } from "./routes/serviceAccounts";

// Create necessary directories
async function ensureDirectories() {
  const dirs = [
    "./temp",
    "./temp/cache",
    "./temp/uploads",
    "./credentials/service_accounts"
  ];
  
  for (const dir of dirs) {
    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      console.error(`Error creating directory ${dir}:`, error);
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Ensure required directories exist
  await ensureDirectories();
  
  // Configure multer for file uploads
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './temp/uploads/');
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });
  
  const upload = multer({ 
    storage: storage,
    limits: {
      fileSize: 1024 * 1024 * 1024 // 1GB limit
    }
  });
  
  // Attach multer middleware to the app
  app.locals.upload = upload;
  
  // Register API routes
  app.get('/api/ping', (req, res) => {
    res.json({ message: 'pong' });
  });

  // Register auth routes first
  registerAuthRoutes(app);
  
  // Register service account routes
  registerServiceAccountRoutes(app);
  
  // Register other API routes
  registerUploadRoutes(app);
  registerJobRoutes(app);
  registerStreamRoutes(app);
  registerFileRoutes(app);
  
  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}
