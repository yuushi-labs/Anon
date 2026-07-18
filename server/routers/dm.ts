import { z } from "zod";
import { protectedAppProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

import {
  appUsers,
  conversations,
  messages,
  blocks,
  reports,
  messageReadReceipts,
} from "../../drizzle/schema";
import { desc, eq, and, inArray, ne, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createHash } from "crypto";

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
      }),
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

        // Generate public key hash for uniqueness check
        const publicKeyHash = createHash("sha256")
          .update(input.publicKey)
          .digest("hex");

        // Check if public key hash already exists
        const existingKey = await database
          .select()
          .from(appUsers)
          .where(eq(appUsers.publicKeyHash, publicKeyHash))
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
          publicKeyHash: publicKeyHash,
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
    .query(async ({ input, ctx }) => {
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
  startConversation: protectedAppProcedure
    .input(
      z.object({
        recipientPublicId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
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
              eq(conversations.initiatorId, ctx.appUser.id),
              eq(conversations.recipientId, recipientId),
            ),
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
          initiatorId: ctx.appUser.id,
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
  getConversations: protectedAppProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
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
            eq(conversations.initiatorId, ctx.appUser.id),
            eq(conversations.recipientId, ctx.appUser.id),
          ),
        );

      // Enrich with user info and latest message
      const enriched = await Promise.all(
        convs.map(async (conv: typeof conversations.$inferSelect) => {
          const otherUserId =
            conv.initiatorId === ctx.appUser.id
              ? conv.recipientId
              : conv.initiatorId;

          const otherUser = await database
            .select({ id: appUsers.id, publicId: appUsers.publicId, username: appUsers.username, iconUrl: appUsers.iconUrl, readReceiptsEnabled: appUsers.readReceiptsEnabled })
            .from(appUsers)
            .where(eq(appUsers.id, otherUserId))
            .limit(1);

          const latestMsg = await database
            .select()
            .from(messages)
            .where(eq(messages.conversationId, conv.id))
            .orderBy(desc(messages.createdAt))
            .limit(1);

          return {
            conversationId: conv.id,
            otherUser: otherUser[0] || null,
            isInitiator: conv.initiatorId === ctx.appUser.id,
            anonLabel: conv.anonLabel,
            lastMessage: latestMsg[0] || null,
            createdAt: conv.createdAt,
          };
        }),
      );

      return enriched;
    }),

  /**
   * Get messages in a conversation
   */
  getMessages: protectedAppProcedure
    .input(
      z.object({ conversationId: z.number(), limit: z.number().default(50) }),
    )
    .query(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const conversation = await database
        .select()
        .from(conversations)
        .where(eq(conversations.id, input.conversationId))
        .limit(1);

      if (conversation.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      const isParticipant =
        conversation[0].initiatorId === ctx.appUser.id ||
        conversation[0].recipientId === ctx.appUser.id;

      if (!isParticipant) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a participant",
        });
      }

      const otherUserId =
        conversation[0].initiatorId === ctx.appUser.id
          ? conversation[0].recipientId
          : conversation[0].initiatorId;

      const otherUser = await database
        .select({ readReceiptsEnabled: appUsers.readReceiptsEnabled })
        .from(appUsers)
        .where(eq(appUsers.id, otherUserId))
        .limit(1);

      const msgs = await database
        .select()
        .from(messages)
        .where(eq(messages.conversationId, input.conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(input.limit);

      const receiptByMessageId = new Map<number, Date>();
      // Only fetch read receipts if both users have them enabled
      if (
        ctx.appUser.readReceiptsEnabled &&
        otherUser[0]?.readReceiptsEnabled &&
        msgs.length > 0
      ) {
            const receipts = await database
              .select({
                messageId: messageReadReceipts.messageId,
                readAt: messageReadReceipts.readAt,
              })
              .from(messageReadReceipts)
              .where(
                and(
                  inArray(
                    messageReadReceipts.messageId,
                    msgs.map((message) => message.id),
                  ),
                  ne(messageReadReceipts.readerId, ctx.appUser.id),
                ),
              );
            receipts.forEach((receipt) => {
              receiptByMessageId.set(receipt.messageId, receipt.readAt);
            });
          }

      // Enrich messages with sender info (label and icon)
      const enrichedMsgs = await Promise.all(
        msgs.map(async (msg) => {
          const sender = await database
            .select()
            .from(appUsers)
            .where(eq(appUsers.id, msg.senderId))
            .limit(1);

          const isInitiator = conversation[0].initiatorId === msg.senderId;
          const senderUser = sender[0];

          return {
            ...msg,
            senderLabel: isInitiator
              ? conversation[0].anonLabel
              : senderUser?.username || "Unknown",
            senderIcon: isInitiator ? null : senderUser?.iconUrl || null,
            readAt: receiptByMessageId.get(msg.id) ?? null,
          };
        }),
      );

      return enrichedMsgs;
    }),

  /**
   * Block a user
   */
  blockUser: protectedAppProcedure
    .input(
      z.object({
        blockedPublicId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
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
              eq(blocks.blockerId, ctx.appUser.id),
              eq(blocks.blockedId, blockedId),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          return { success: true, message: "User already blocked" };
        }

        await database.insert(blocks).values({
          blockerId: ctx.appUser.id,
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
  reportMessage: protectedAppProcedure
    .input(
      z.object({
        messageId: z.number(),
        reason: z.string().min(1).max(1000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
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

        const conversation = await database
          .select()
          .from(conversations)
          .where(eq(conversations.id, msg[0].conversationId))
          .limit(1);

        const canReport = conversation.some(
          (conv) =>
            conv.initiatorId === ctx.appUser.id ||
            conv.recipientId === ctx.appUser.id,
        );

        if (!canReport) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not authorized to report this message",
          });
        }

        await database.insert(reports).values({
          reporterId: ctx.appUser.id,
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

  getReadReceiptSettings: protectedAppProcedure.query(({ ctx }) => ({
    readReceiptsEnabled: ctx.appUser.readReceiptsEnabled,
  })),
  updateReadReceiptSettings: protectedAppProcedure
    .input(
      z.object({
        readReceiptsEnabled: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      await database
        .update(appUsers)
        .set({ readReceiptsEnabled: input.readReceiptsEnabled })
        .where(eq(appUsers.id, ctx.appUser.id));
      return { readReceiptsEnabled: input.readReceiptsEnabled };
    }),
  registerFCMToken: protectedAppProcedure
    .input(
      z.object({
        fcmToken: z.string().min(1).max(512),
      }),
    )
    .mutation(async ({ input, ctx }) => {
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
          .where(eq(appUsers.id, ctx.appUser.id));

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
