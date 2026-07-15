import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket as BaseSocket } from "socket.io";
import { getDb } from "../db";
import {
  messages,
  conversations,
  appUsers,
  blocks,
} from "../../drizzle/schema";
import { eq, and, or } from "drizzle-orm";
import { verifyRequestSignature } from "./crypto";
import { verifyAppToken } from "./app-jwt";

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

export function initializeWebSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (
        process.env.SOCKET_IO_ALLOWED_ORIGINS ??
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
        return next(new Error("Authentication required"));
      }

      const payload = await verifyAppToken(token);
      const db = await getDb();
      if (!db) {
        return next(new Error("Database unavailable"));
      }

      const user = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.id, payload.userId))
        .limit(1);

      if (user.length === 0) {
        return next(new Error("User not found"));
      }

      socket.userId = user[0].id;
      socket.publicId = user[0].publicId;
      next();
    } catch (error) {
      console.error("WebSocket auth error:", error);
      next(new Error("Authentication failed"));
    }
  });

  /**
   * Connection handler
   */
  io.on("connection", (socket: AuthenticatedSocket & any) => {
    console.log(`User ${socket.publicId} connected: ${socket.id}`);

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
      if (!(await isConversationParticipant(conversationId, socket.userId))) {
        socket.emit("error", {
          message: "Not authorized for this conversation",
        });
        console.warn("WebSocket join denied", {
          userId: socket.userId,
          conversationId,
        });
        return;
      }
      const room = `conversation:${conversationId}`;
      socket.join(room);
      console.log("WebSocket room joined", {
        userId: socket.userId,
        conversationId,
      });
    });

    /**
     * Leave conversation room
     */
    (socket as any).on("leave_conversation", async (conversationId: number) => {
      if (!(await isConversationParticipant(conversationId, socket.userId))) {
        socket.emit("error", {
          message: "Not authorized for this conversation",
        });
        return;
      }
      const room = `conversation:${conversationId}`;
      socket.leave(room);
      console.log("WebSocket room left", {
        userId: socket.userId,
        conversationId,
      });
    });

    /**
     * Send message
     */
    (socket as any).on("send_message", async (payload: MessagePayload) => {
      try {
        if (!socket.userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }

        const db = await getDb();
        if (!db) {
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
          socket.emit("error", { message: "Conversation not found" });
          return;
        }

        const conversation = conv[0];
        const isInitiator = conversation.initiatorId === socket.userId;
        const isRecipient = conversation.recipientId === socket.userId;

        if (!isInitiator && !isRecipient) {
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
          5 * 60 * 1000, // 5 minute expiry
        );

        if (!isValidSignature) {
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

        console.log(
          `Message ${messageId} sent in conversation ${payload.conversationId}`,
        );
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

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
    (socket as any).on("disconnect", () => {
      console.log(`User ${socket.publicId} disconnected: ${socket.id}`);

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
      console.error(`Socket error for user ${socket.publicId}:`, error);
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
