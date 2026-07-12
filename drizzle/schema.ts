import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Anonymous DM App Tables
 */

/**
 * App users table - stores user profile and public key for authentication
 */
export const appUsers = mysqlTable("app_users", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique public ID for DM initiation (e.g., "user123") */
  publicId: varchar("publicId", { length: 255 }).notNull().unique(),
  /** User's display name */
  username: varchar("username", { length: 255 }).notNull(),
  /** ECDSA public key (hex-encoded) - stored as varchar with length limit */
  publicKey: varchar("publicKey", { length: 1024 }).notNull().unique(),
  /** User's icon URL or color */
  iconUrl: varchar("iconUrl", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppUser = typeof appUsers.$inferSelect;
export type InsertAppUser = typeof appUsers.$inferInsert;

/**
 * Conversations table - stores DM conversations between two users
 */
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  /** User who initiated the conversation (sender - anonymous) */
  initiatorId: int("initiatorId").notNull(),
  /** User who receives the conversation (recipient) */
  recipientId: int("recipientId").notNull(),
  /** Anonymous label shown to recipient (e.g., "匿名1") */
  anonLabel: varchar("anonLabel", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Messages table - stores all messages in conversations
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  /** User who sent the message */
  senderId: int("senderId").notNull(),
  /** Message content */
  content: text("content").notNull(),
  /** Message type (currently only 'text') */
  messageType: varchar("messageType", { length: 50 }).default("text").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Blocks table - stores user block relationships
 */
export const blocks = mysqlTable("blocks", {
  id: int("id").autoincrement().primaryKey(),
  /** User who blocked another user */
  blockerId: int("blockerId").notNull(),
  /** User who was blocked */
  blockedId: int("blockedId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Block = typeof blocks.$inferSelect;
export type InsertBlock = typeof blocks.$inferInsert;

/**
 * Reports table - stores user reports for moderation
 */
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  /** User who reported */
  reporterId: int("reporterId").notNull(),
  /** Message that was reported */
  reportedMessageId: int("reportedMessageId").notNull(),
  /** Reason for report */
  reason: text("reason").notNull(),
  /** Report status */
  status: mysqlEnum("status", ["pending", "reviewed", "resolved"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;
