import { pgTable, text, serial, integer, boolean, timestamp, json, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Base user schema (keeping this as is from template)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// File categories enum
export const fileCategories = ['video', 'image', 'document', 'code', 'all'] as const;
export type FileCategory = typeof fileCategories[number];

// File statuses
export const fileStatuses = ['processing', 'ready', 'failed'] as const;
export type FileStatus = typeof fileStatuses[number];

// Job statuses
export const jobStatuses = ['waiting', 'processing', 'ready', 'failed'] as const;
export type JobStatus = typeof jobStatuses[number];

// Resolutions for video conversion
export const videoResolutions = ['1080p', '720p', '360p'] as const;
export type VideoResolution = typeof videoResolutions[number];

// Files table
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  size: bigint("size", { mode: "number" }).notNull(), // size in bytes
  mimeType: text("mime_type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;

// Uploads table
export const uploads = pgTable("uploads", {
  id: serial("id").primaryKey(),
  identifier: text("identifier"), // for deduplication
  fileType: text("file_type").notNull(), // e.g., video/mp4, image/jpeg
  externalFileId: text("external_file_id").notNull(), // Google Drive file ID
  source: text("source").notNull(), // e.g., "googledrive"
  fileId: integer("file_id").notNull(), // reference to files table
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  uploadName: text("upload_name").notNull().default("Unnamed"),
  category: text("category").notNull(), // video, image, document, code
  thumbnail: text("thumbnail"), // Google Drive file ID for thumbnail
  folderId: text("folder_id"), // virtual folder identifier
  folderName: text("folder_name"), // virtual folder name
  status: text("status").notNull().default("processing"), // processing, ready, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUploadSchema = createInsertSchema(uploads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUpload = z.infer<typeof insertUploadSchema>;
export type Upload = typeof uploads.$inferSelect;

// Chunks table for video processing
export const chunks = pgTable("chunks", {
  id: serial("id").primaryKey(),
  uploadId: integer("upload_id").notNull(), // reference to uploads table
  index: integer("index").notNull(), // chunk index
  duration: integer("duration").notNull(), // duration in seconds
  resolution: text("resolution").notNull(), // 1080p, 720p, 360p
  path: text("path").notNull(), // path to chunk file
  externalFileId: text("external_file_id").notNull(), // Google Drive file ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChunkSchema = createInsertSchema(chunks).omit({
  id: true,
  createdAt: true,
});

export type InsertChunk = z.infer<typeof insertChunkSchema>;
export type Chunk = typeof chunks.$inferSelect;

// Conversion jobs table
export const conversions = pgTable("conversions", {
  id: serial("id").primaryKey(),
  uploadId: integer("upload_id").notNull(), // reference to uploads table
  resolution: text("resolution").notNull(), // 1080p, 720p, 360p
  status: text("status").notNull().default("waiting"), // waiting, processing, ready, failed
  progress: integer("progress").notNull().default(0), // progress percentage
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  error: text("error"), // error message if failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConversionSchema = createInsertSchema(conversions).omit({
  id: true,
  progress: true,
  startedAt: true,
  completedAt: true,
  error: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertConversion = z.infer<typeof insertConversionSchema>;
export type Conversion = typeof conversions.$inferSelect;

// Google Drive service accounts
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  credentialsPath: text("credentials_path").notNull(),
  storageLimit: bigint("storage_limit", { mode: "number" }).notNull(), // Changed to bigint
  storageUsed: bigint("storage_used", { mode: "number" }).notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAccountSchema = createInsertSchema(accounts).omit({
  id: true,
  storageUsed: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

// Virtual folders
export const folders = pgTable("folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFolderSchema = createInsertSchema(folders).omit({
  id: true,
  createdAt: true,
});

export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type Folder = typeof folders.$inferSelect;
