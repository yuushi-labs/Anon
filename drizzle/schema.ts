import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, index, unique, uniqueIndex } from "drizzle-orm/mysql-core";

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
  publicKey: varchar("publicKey", { length: 1024 }).notNull(),
  /** SHA-256 hash of the public key to ensure uniqueness without hitting index length limits */
  publicKeyHash: varchar("publicKeyHash", { length: 64 }).notNull().unique(),
  /** User's icon URL or color */
  iconUrl: varchar("iconUrl", { length: 512 }),
  /** FCM token for push notifications */
  fcmToken: varchar("fcmToken", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  publicIdIdx: index("publicId_idx").on(table.publicId),
}));

export type AppUser = typeof appUsers.$inferSelect;
export type InsertAppUser = typeof appUsers.$inferInsert;

/**
 * Conversations table - stores DM conversations between two users
 */
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  /** User who initiated the conversation (sender - anonymous) */
  initiatorId: int("initiatorId").notNull().references(() => appUsers.id),
  /** User who receives the conversation (recipient) */
  recipientId: int("recipientId").notNull().references(() => appUsers.id),
  /** Anonymous label shown to recipient (e.g., "匿名1") */
  anonLabel: varchar("anonLabel", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  initiatorIdx: index("initiator_idx").on(table.initiatorId),
  recipientIdx: index("recipient_idx").on(table.recipientId),
  // Prevent duplicate conversations in the same direction
  uniqueConversation: unique("unique_conversation").on(table.initiatorId, table.recipientId),
}));

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Messages table - stores all messages in conversations
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => conversations.id),
  /** User who sent the message */
  senderId: int("senderId").notNull().references(() => appUsers.id),
  /** Message content */
  content: text("content").notNull(),
  /** Message type (currently only 'text') */
  messageType: varchar("messageType", { length: 50 }).default("text").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  conversationIdx: index("conversation_idx").on(table.conversationId),
  senderIdx: index("sender_idx").on(table.senderId),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Blocks table - stores user block relationships
 */
export const blocks = mysqlTable("blocks", {
  id: int("id").autoincrement().primaryKey(),
  /** User who blocked another user */
  blockerId: int("blockerId").notNull().references(() => appUsers.id),
  /** User who was blocked */
  blockedId: int("blockedId").notNull().references(() => appUsers.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  blockerIdx: index("blocker_idx").on(table.blockerId),
  blockedIdx: index("blocked_idx").on(table.blockedId),
  uniqueBlock: unique("unique_block").on(table.blockerId, table.blockedId),
}));

export type Block = typeof blocks.$inferSelect;
export type InsertBlock = typeof blocks.$inferInsert;

/**
 * Reports table - stores user reports for moderation
 */
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  /** User who reported */
  reporterId: int("reporterId").notNull().references(() => appUsers.id),
  /** Message that was reported */
  reportedMessageId: int("reportedMessageId").notNull().references(() => messages.id),
  /** Reason for report */
  reason: text("reason").notNull(),
  /** Report status */
  status: mysqlEnum("status", ["pending", "reviewed", "resolved"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  reporterIdx: index("reporter_idx").on(table.reporterId),
  reportedMessageIdx: index("reported_message_idx").on(table.reportedMessageId),
}));

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;
