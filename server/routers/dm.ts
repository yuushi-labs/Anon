import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

// Create a db helper
const db = {
  insert: async (table: any, values: any) => {
    const database = await getDb();
    if (!database) throw new Error("Database not available");
    return database.insert(table).values(values);
  },
  select: async () => {
    const database = await getDb();
    if (!database) throw new Error("Database not available");
    return database.select();
  },
};
import { appUsers, conversations, messages, blocks, reports } from "../../drizzle/schema";
import { eq, and, or } from "drizzle-orm";
import { generateKeyPair, verifyRequestSignature } from "../_core/crypto";
import { TRPCError } from "@trpc/server";

/**
 * Anonymous DM App Router
 * Handles user registration, authentication, conversations, and messaging
 */

export const dmRouter = router({
  /**
   * Register a new user with public key authentication
   * Client should generate ECDSA key pair and send public key
   */
  register: publicProcedure
    .input(
      z.object({
        username: z.string().min(1).max(255),
        publicId: z.string().min(1).max(255),
        publicKey: z.string().min(1).max(1024), // PEM format public key
        iconUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const database = await getDb();
        if (!database) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        // Check if publicId already exists
        const existingUser = await database
          .select()
          .from(appUsers)
          .where(eq(appUsers.publicId, input.publicId))
          .limit(1);

        if (existingUser.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Public ID already taken",
          });
        }

        // Check if public key already exists
        const existingKey = await database
          .select()
          .from(appUsers)
          .where(eq(appUsers.publicKey, input.publicKey))
          .limit(1);

        if (existingKey.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Public key already registered",
          });
        }

        // Insert new user
        const result = await database.insert(appUsers).values({
          publicId: input.publicId,
          username: input.username,
          publicKey: input.publicKey,
          iconUrl: input.iconUrl || null,
        });

        const userId = result[0].insertId;

        return {
          success: true,
          userId,
          publicId: input.publicId,
          username: input.username,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Registration failed",
        });
      }
    }),

  /**
   * Get user by public ID
   */
  getUser: publicProcedure
    .input(z.object({ publicId: z.string() }))
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const user = await database
        .select()
        .from(appUsers)
        .where(eq(appUsers.publicId, input.publicId))
        .limit(1);

      if (user.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const userData = user[0];
      return {
        id: userData.id,
        publicId: userData.publicId,
        username: userData.username,
        iconUrl: userData.iconUrl,
      };
    }),

  /**
   * Start a new conversation (DM)
   * Only initiator (sender) is anonymous
   */
  startConversation: publicProcedure
    .input(
      z.object({
        initiatorId: z.number(),
        recipientPublicId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const database = await getDb();
        if (!database) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        // Get recipient user
        const recipientUser = await database
          .select()
          .from(appUsers)
          .where(eq(appUsers.publicId, input.recipientPublicId))
          .limit(1);

        if (recipientUser.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recipient not found",
          });
        }

        const recipientId = recipientUser[0].id;

        // Check if conversation already exists
        const existing = await database
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.initiatorId, input.initiatorId),
              eq(conversations.recipientId, recipientId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          return {
            success: true,
            conversationId: existing[0].id,
            anonLabel: existing[0].anonLabel,
          };
        }

        // Count existing conversations for this recipient to generate anon label
        const existingCount = await database
          .select()
          .from(conversations)
          .where(eq(conversations.recipientId, recipientId));

        const anonLabel = `匿名${existingCount.length + 1}`;

        // Create new conversation
        const result = await database.insert(conversations).values({
          initiatorId: input.initiatorId,
          recipientId: recipientId,
          anonLabel: anonLabel,
        });

        return {
          success: true,
          conversationId: result[0].insertId,
          anonLabel: anonLabel,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to start conversation",
        });
      }
    }),

  /**
   * Get conversations for a user
   */
  getConversations: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const convs = await database
        .select()
        .from(conversations)
        .where(
          or(
            eq(conversations.initiatorId, input.userId),
            eq(conversations.recipientId, input.userId)
          )
        );

      // Enrich with user info and latest message
      const enriched = await Promise.all(
        convs.map(async (conv: typeof conversations.$inferSelect) => {
          const otherUserId =
            conv.initiatorId === input.userId
              ? conv.recipientId
              : conv.initiatorId;

          const otherUser = await database
            .select()
            .from(appUsers)
            .where(eq(appUsers.id, otherUserId))
            .limit(1);

          const latestMsg = await database
            .select()
            .from(messages)
            .where(eq(messages.conversationId, conv.id))
            .orderBy(messages.createdAt)
            .limit(1);

          return {
            conversationId: conv.id,
            otherUser: otherUser[0] || null,
            isInitiator: conv.initiatorId === input.userId,
            anonLabel: conv.anonLabel,
            lastMessage: latestMsg[0] || null,
            createdAt: conv.createdAt,
          };
        })
      );

      return enriched;
    }),

  /**
   * Get messages in a conversation
   */
  getMessages: publicProcedure
    .input(z.object({ conversationId: z.number(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const msgs = await database
        .select()
        .from(messages)
        .where(eq(messages.conversationId, input.conversationId))
        .orderBy(messages.createdAt)
        .limit(input.limit);

      return msgs;
    }),

  /**
   * Block a user
   */
  blockUser: publicProcedure
    .input(z.object({ blockerId: z.number(), blockedPublicId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const database = await getDb();
        if (!database) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        const blockedUser = await database
          .select()
          .from(appUsers)
          .where(eq(appUsers.publicId, input.blockedPublicId))
          .limit(1);

        if (blockedUser.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        const blockedId = blockedUser[0].id;

        // Check if already blocked
        const existing = await database
          .select()
          .from(blocks)
          .where(
            and(
              eq(blocks.blockerId, input.blockerId),
              eq(blocks.blockedId, blockedId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          return { success: true, message: "User already blocked" };
        }

        await database.insert(blocks).values({
          blockerId: input.blockerId,
          blockedId: blockedId,
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to block user",
        });
      }
    }),

  /**
   * Report a message
   */
  reportMessage: publicProcedure
    .input(
      z.object({
        reporterId: z.number(),
        messageId: z.number(),
        reason: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const database = await getDb();
        if (!database) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        const msg = await database
          .select()
          .from(messages)
          .where(eq(messages.id, input.messageId))
          .limit(1);

        if (msg.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Message not found",
          });
        }

        await database.insert(reports).values({
          reporterId: input.reporterId,
          reportedMessageId: input.messageId,
          reason: input.reason,
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to report message",
        });
      }
    }),

  registerFCMToken: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        fcmToken: z.string().min(1).max(512),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const database = await getDb();
        if (!database) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        await database
          .update(appUsers)
          .set({ fcmToken: input.fcmToken })
          .where(eq(appUsers.id, input.userId));

        return { success: true, message: "FCM token registered successfully" };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to register FCM token",
        });
      }
    }),
});
