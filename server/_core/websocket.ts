import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket as BaseSocket } from "socket.io";
import { getDb } from "../db";
import {
  messages,
  conversations,
  appUsers,
  blocks,
  messageReadReceipts,
} from "../../drizzle/schema";
import { eq, and, inArray, ne, or, sql } from "drizzle-orm";
import { verifyRequestSignature } from "./crypto";
import { verifyAppToken } from "./app-jwt";
import { logger } from "./logger";

/**
 * WebSocket server for real-time messaging
 * Uses Socket.IO for reliable real-time communication
 */

interface AuthenticatedSocket extends BaseSocket {
  userId?: number;
  publicId?: string;
  handshake: any;
}

interface MessagePayload {
  conversationId: number;
  content: string;
  timestamp: number;
  signature: string;
}

interface ReadReceiptPayload {
  conversationId: number;
  messageIds: number[];
}

async function isConversationParticipant(
  conversationId: number,
  userId: number | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return rows.some(
    (conversation) =>
      conversation.initiatorId === userId ||
      conversation.recipientId === userId,
  );
}

// Store active user connections
const userConnections = new Map<number, Set<string>>();

// Simple in-memory rate limiting for WebSocket events
const eventLimits = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_MESSAGES_PER_MINUTE = 30;
const MAX_READ_RECEIPTS_PER_MINUTE = 120;
const MAX_READ_RECEIPTS_PER_EVENT = 100;

function checkRateLimit(
  socketId: string,
  event: string,
  limit: number,
): boolean {
  const key = `${socketId}:${event}`;
  const now = Date.now();
  const record = eventLimits.get(key) || { count: 0, lastReset: now };

  if (now - record.lastReset > RATE_LIMIT_WINDOW) {
    record.count = 1;
    record.lastReset = now;
    eventLimits.set(key, record);
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  eventLimits.set(key, record);
  return true;
}

export function initializeWebSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (
        process.env.SOCKET_IO_ALLOWED_ORIGINS ||
        "http://localhost:8081,http://localhost:19006"
      )
        .split(",")
        .map((origin: string) => origin.trim()),
      methods: ["GET", "POST"],
    },
  });

  /**
   * Middleware for authentication
   */
  io.use(async (socket: AuthenticatedSocket, next: any) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        logger.warn("WebSocket auth failed: No token provided", {
          socketId: socket.id,
          ip: socket.handshake.address,
        });
        return next(new Error("Authentication required"));
      }

      const payload = await verifyAppToken(token);
      const db = await getDb();
      if (!db) {
        logger.error("WebSocket auth failed: Database unavailable", {
          socketId: socket.id,
          userId: payload.userId,
        });
        return next(new Error("Database unavailable"));
      }

      const user = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.id, payload.userId))
        .limit(1);

      if (user.length === 0) {
        logger.warn("WebSocket auth failed: User not found", {
          socketId: socket.id,
          userId: payload.userId,
        });
        return next(new Error("User not found"));
      }

      socket.userId = user[0].id;
      socket.publicId = user[0].publicId;
      next();
    } catch (error: any) {
      logger.error("WebSocket auth error", {
        socketId: socket.id,
        error: error.message,
      });
      next(new Error("Authentication failed"));
    }
  });

  /**
   * Connection handler
   */
  io.on("connection", (socket: AuthenticatedSocket & any) => {
    logger.info("WebSocket connected", {
      socketId: socket.id,
      userId: socket.userId,
      publicId: socket.publicId,
    });

    // Track user connection
    if (socket.userId) {
      if (!userConnections.has(socket.userId)) {
        userConnections.set(socket.userId, new Set());
      }
      userConnections.get(socket.userId)!.add(socket.id);
    }

    /**
     * Join conversation room
     */
    (socket as any).on("join_conversation", async (conversationId: number) => {
      // Input validation
      if (typeof conversationId !== "number") {
        logger.warn("WebSocket join denied: Invalid conversationId", {
          socketId: socket.id,
          userId: socket.userId,
          conversationId,
        });
        return;
      }

      if (!(await isConversationParticipant(conversationId, socket.userId))) {
        logger.warn("WebSocket join denied: Not a participant", {
          socketId: socket.id,
          userId: socket.userId,
          conversationId,
        });
        socket.emit("error", {
          message: "Not authorized for this conversation",
        });
        return;
      }
      const room = `conversation:${conversationId}`;
      socket.join(room);
      logger.info("WebSocket room joined", {
        socketId: socket.id,
        userId: socket.userId,
        conversationId,
      });
    });

    /**
     * Leave conversation room
     */
    (socket as any).on("leave_conversation", async (conversationId: number) => {
      if (!(await isConversationParticipant(conversationId, socket.userId))) {
        logger.warn("WebSocket leave denied: Not a participant", {
          socketId: socket.id,
          userId: socket.userId,
          conversationId,
        });
        socket.emit("error", {
          message: "Not authorized for this conversation",
        });
        return;
      }
      const room = `conversation:${conversationId}`;
      socket.leave(room);
      logger.info("WebSocket room left", {
        socketId: socket.id,
        userId: socket.userId,
        conversationId,
      });
    });

    /**
     * Send message
     */
    (socket as any).on("send_message", async (payload: MessagePayload) => {
      try {
        // Rate limiting
        if (
          !checkRateLimit(socket.id, "send_message", MAX_MESSAGES_PER_MINUTE)
        ) {
          logger.warn("WebSocket message rate limit exceeded", {
            socketId: socket.id,
            userId: socket.userId,
          });
          socket.emit("error", {
            message: "Too many messages. Please slow down.",
          });
          return;
        }

        if (!socket.userId) {
          logger.warn("WebSocket send_message failed: Not authenticated", {
            socketId: socket.id,
          });
          socket.emit("error", { message: "Not authenticated" });
          return;
        }

        const db = await getDb();
        if (!db) {
          logger.error("WebSocket send_message failed: Database unavailable", {
            socketId: socket.id,
            userId: socket.userId,
          });
          socket.emit("error", { message: "Database unavailable" });
          return;
        }

        // Verify conversation exists and user is participant
        const conv = await db
          .select()
          .from(conversations)
          .where(eq(conversations.id, payload.conversationId))
          .limit(1);

        if (conv.length === 0) {
          logger.warn("WebSocket send_message failed: Conversation not found", {
            socketId: socket.id,
            userId: socket.userId,
            conversationId: payload.conversationId,
          });
          socket.emit("error", { message: "Conversation not found" });
          return;
        }

        const conversation = conv[0];
        const isInitiator = conversation.initiatorId === socket.userId;
        const isRecipient = conversation.recipientId === socket.userId;

        if (!isInitiator && !isRecipient) {
          logger.warn("WebSocket send_message denied: Not a participant", {
            socketId: socket.id,
            userId: socket.userId,
            conversationId: payload.conversationId,
          });
          socket.emit("error", {
            message: "Not a participant in this conversation",
          });
          return;
        }

        const blocked = await db
          .select()
          .from(blocks)
          .where(
            or(
              and(
                eq(blocks.blockerId, conversation.initiatorId),
                eq(blocks.blockedId, conversation.recipientId),
              ),
              and(
                eq(blocks.blockerId, conversation.recipientId),
                eq(blocks.blockedId, conversation.initiatorId),
              ),
            ),
          )
          .limit(1);

        if (blocked.length > 0) {
          logger.info("WebSocket send_message blocked by user settings", {
            socketId: socket.id,
            userId: socket.userId,
            conversationId: payload.conversationId,
          });
          socket.emit("error", { message: "Message blocked by user settings" });
          return;
        }

        // Verify signature
        const user = await db
          .select()
          .from(appUsers)
          .where(eq(appUsers.id, socket.userId))
          .limit(1);

        if (user.length === 0) {
          logger.warn("WebSocket send_message failed: User not found", {
            socketId: socket.id,
            userId: socket.userId,
          });
          socket.emit("error", { message: "User not found" });
          return;
        }

        const publicKey = user[0].publicKey;
        const messageData = JSON.stringify({
          conversationId: payload.conversationId,
          content: payload.content,
        });

        const isValidSignature = verifyRequestSignature(
          messageData,
          payload.signature,
          publicKey,
          payload.timestamp,
          undefined,
          5 * 60 * 1000, // 5 minute expiry
        );

        if (!isValidSignature) {
          logger.warn("WebSocket send_message failed: Invalid signature", {
            socketId: socket.id,
            userId: socket.userId,
            conversationId: payload.conversationId,
          });
          socket.emit("error", { message: "Invalid signature" });
          return;
        }

        // Save message to database
        const result = await db.insert(messages).values({
          conversationId: payload.conversationId,
          senderId: socket.userId,
          content: payload.content,
          messageType: "text",
        });

        const messageId = result[0].insertId;

        // Prepare message for broadcast
        const broadcastMessage = {
          id: messageId,
          conversationId: payload.conversationId,
          senderId: socket.userId,
          senderLabel: isInitiator ? conversation.anonLabel : user[0].username,
          senderIcon: isInitiator ? null : user[0].iconUrl,
          content: payload.content,
          createdAt: new Date(),
        };

        // Broadcast to conversation room
        const room = `conversation:${payload.conversationId}`;
        io.to(room).emit("message", broadcastMessage);

        // Send acknowledgment
        socket.emit("message_sent", { messageId, timestamp: Date.now() });

        logger.info("WebSocket message sent", {
          socketId: socket.id,
          userId: socket.userId,
          conversationId: payload.conversationId,
          messageId,
        });
      } catch (error: any) {
        logger.error("WebSocket send_message error", {
          socketId: socket.id,
          userId: socket.userId,
          error: error.message,
        });
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    /**
     * Record messages as read and notify the other conversation participant.
     * The server performs all authorization and preference checks so that clients
     * cannot forge receipts for messages outside their conversations.
     */
    (socket as any).on(
      "mark_messages_read",
      async (payload: ReadReceiptPayload, callback?: any) => {
        try {
          if (!socket.userId) {
            socket.emit("error", { message: "Not authenticated" });
            return;
          }

          if (
            !checkRateLimit(
              socket.id,
              "mark_messages_read",
              MAX_READ_RECEIPTS_PER_MINUTE,
            )
          ) {
            logger.warn("WebSocket read receipt rate limit exceeded", {
              socketId: socket.id,
              userId: socket.userId,
            });
            socket.emit("error", {
              message: "Too many read receipt updates. Please slow down.",
            });
            return;
          }

          if (
            !payload ||
            !Number.isSafeInteger(payload.conversationId) ||
            !Array.isArray(payload.messageIds)
          ) {
            socket.emit("error", { message: "Invalid read receipt payload" });
            return;
          }

          const messageIds = [...new Set(payload.messageIds)].filter(
            (messageId) => Number.isSafeInteger(messageId) && messageId > 0,
          );
          if (
            messageIds.length === 0 ||
            messageIds.length > MAX_READ_RECEIPTS_PER_EVENT
          ) {
            socket.emit("error", {
              message: "Invalid read receipt message IDs",
            });
            return;
          }

          const db = await getDb();
          if (!db) {
            logger.error(
              "WebSocket read receipt failed: Database unavailable",
              {
                socketId: socket.id,
                userId: socket.userId,
              },
            );
            socket.emit("error", { message: "Database unavailable" });
            return;
          }

          const [reader, conversation] = await Promise.all([
            db
              .select({ readReceiptsEnabled: appUsers.readReceiptsEnabled })
              .from(appUsers)
              .where(eq(appUsers.id, socket.userId))
              .limit(1),
            db
              .select()
              .from(conversations)
              .where(eq(conversations.id, payload.conversationId))
              .limit(1),
          ]);

          if (reader.length === 0) {
            socket.emit("error", { message: "User not found" });
            return;
          }

          if (!reader[0].readReceiptsEnabled) {
            if (typeof callback === "function") {
              callback({ success: true, messageIds: [] });
            }
            return;
          }

          if (conversation.length === 0) {
            socket.emit("error", { message: "Conversation not found" });
            return;
          }

          const isParticipant =
            conversation[0].initiatorId === socket.userId ||
            conversation[0].recipientId === socket.userId;
          if (!isParticipant) {
            logger.warn("WebSocket read receipt denied: Not a participant", {
              socketId: socket.id,
              userId: socket.userId,
              conversationId: payload.conversationId,
            });
            socket.emit("error", {
              message: "Not authorized for this conversation",
            });
            return;
          }

          const blocked = await db
            .select()
            .from(blocks)
            .where(
              or(
                and(
                  eq(blocks.blockerId, conversation[0].initiatorId),
                  eq(blocks.blockedId, conversation[0].recipientId),
                ),
                and(
                  eq(blocks.blockerId, conversation[0].recipientId),
                  eq(blocks.blockedId, conversation[0].initiatorId),
                ),
              ),
            )
            .limit(1);

          if (blocked.length > 0) {
            logger.info("WebSocket read receipt blocked by user settings", {
              socketId: socket.id,
              userId: socket.userId,
              conversationId: payload.conversationId,
            });
            // Silently drop read receipts when blocked to match message delivery behavior
            if (typeof callback === "function") {
              callback({ success: true, messageIds: [] });
            }
            return;
          }

          // A user can only mark messages written by the other participant as read.
          const receivedMessages = await db
            .select({ id: messages.id })
            .from(messages)
            .where(
              and(
                eq(messages.conversationId, payload.conversationId),
                inArray(messages.id, messageIds),
                ne(messages.senderId, socket.userId),
              ),
            );
          const receivedMessageIds = receivedMessages.map(
            (message) => message.id,
          );
          if (receivedMessageIds.length === 0) {
            if (typeof callback === "function") {
              callback({ success: true, messageIds: [] });
            }
            return;
          }

          const existingReceipts = await db
            .select({ messageId: messageReadReceipts.messageId })
            .from(messageReadReceipts)
            .where(
              and(
                eq(messageReadReceipts.readerId, socket.userId),
                inArray(messageReadReceipts.messageId, receivedMessageIds),
              ),
            );
          const existingMessageIds = new Set(
            existingReceipts.map((receipt) => receipt.messageId),
          );
          const newlyReadMessageIds = receivedMessageIds.filter(
            (messageId) => !existingMessageIds.has(messageId),
          );

          if (newlyReadMessageIds.length > 0) {
            const readAt = new Date();
            await db
              .insert(messageReadReceipts)
              .values(
                newlyReadMessageIds.map((messageId) => ({
                  messageId,
                  readerId: socket.userId!,
                  readAt,
                })),
              )
              .onDuplicateKeyUpdate({
                set: {
                  messageId: sql`messageId`, // No-op update to handle race conditions
                },
              });

            io.to(`conversation:${payload.conversationId}`).emit(
              "messages_read",
              {
                conversationId: payload.conversationId,
                messageIds: newlyReadMessageIds,
                readerId: socket.userId,
                readAt,
              },
            );
            logger.info("WebSocket messages marked as read", {
              socketId: socket.id,
              userId: socket.userId,
              conversationId: payload.conversationId,
              messageCount: newlyReadMessageIds.length,
            });
          }

          if (typeof callback === "function") {
            callback({ success: true, messageIds: receivedMessageIds });
          }
        } catch (error: any) {
          logger.error("WebSocket mark_messages_read error", {
            socketId: socket.id,
            userId: socket.userId,
            error: error.message,
          });
          socket.emit("error", { message: "Failed to mark messages as read" });
        }
      },
    );

    /**
     * Typing indicator
     */
    (socket as any).on("typing", async (conversationId: number) => {
      if (!(await isConversationParticipant(conversationId, socket.userId)))
        return;
      const room = `conversation:${conversationId}`;
      socket.to(room).emit("user_typing", {
        userId: socket.userId,
        publicId: socket.publicId,
      });
    });

    /**
     * Stop typing
     */
    (socket as any).on("stop_typing", async (conversationId: number) => {
      if (!(await isConversationParticipant(conversationId, socket.userId)))
        return;
      const room = `conversation:${conversationId}`;
      socket.to(room).emit("user_stop_typing", {
        userId: socket.userId,
      });
    });

    /**
     * Disconnect handler
     */
    (socket as any).on("disconnect", (reason: string) => {
      logger.info("WebSocket disconnected", {
        socketId: socket.id,
        userId: socket.userId,
        publicId: socket.publicId,
        reason,
      });

      // Clear rate limit records for this socket
      for (const key of eventLimits.keys()) {
        if (key.startsWith(`${socket.id}:`)) {
          eventLimits.delete(key);
        }
      }

      // Remove from user connections
      if (socket.userId) {
        const connections = userConnections.get(socket.userId);
        if (connections) {
          connections.delete(socket.id);
          if (connections.size === 0) {
            userConnections.delete(socket.userId);
          }
        }
      }
    });

    /**
     * Error handler
     */
    (socket as any).on("error", (error: any) => {
      logger.error("WebSocket socket-level error", {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message || error,
      });
    });
  });

  return io;
}

/**
 * Check if user is online
 */
export function isUserOnline(userId: number): boolean {
  return (
    userConnections.has(userId) && (userConnections.get(userId)?.size ?? 0) > 0
  );
}

/**
 * Get user's socket IDs
 */
export function getUserSockets(userId: number): Set<string> {
  return userConnections.get(userId) ?? new Set();
}
