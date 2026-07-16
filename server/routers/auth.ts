import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { appUsers } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { verifyRequestSignature } from "../_core/crypto";
import { TRPCError } from "@trpc/server";
import { signAppToken, verifyAppToken } from "../_core/app-jwt";
import { logger } from "../_core/logger";

/**
 * Authentication router for public key-based auth
 */
export const authRouter = router({
  /**
   * Login with public key signature
   * Client signs a timestamp with their private key and sends:
   * - publicId: User's public ID
   * - timestamp: Current timestamp
   * - signature: Signature of timestamp signed with private key
   */
  login: publicProcedure
    .input(
      z.object({
        publicId: z.string(),
        timestamp: z.number(),
        signature: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        // Get user by public ID
        const users = await db
          .select()
          .from(appUsers)
          .where(eq(appUsers.publicId, input.publicId))
          .limit(1);

        if (users.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        const user = users[0];

        // Verify signature
        const messageToVerify = input.timestamp.toString();
        const isValidSignature = verifyRequestSignature(
          messageToVerify,
          input.signature,
          user.publicKey,
          input.timestamp,
          5 * 60 * 1000, // 5 minute expiry
        );

        if (!isValidSignature) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid signature",
          });
        }

        // Check if JWT_SECRET is set (this should be in env validation, but adding here for safety)
        if (!process.env.JWT_SECRET) {
          logger.error("JWT_SECRET is not set. Refusing to sign tokens.");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Authentication service misconfigured",
          });
        }

        // Generate JWT token
        const token = await signAppToken({
          userId: user.id,
          publicId: user.publicId,
          username: user.username,
        });

        return {
          success: true,
          token,
          user: {
            id: user.id,
            publicId: user.publicId,
            username: user.username,
            iconUrl: user.iconUrl,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Login error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Login failed",
        });
      }
    }),

  /**
   * Verify JWT token
   */
  verifyToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      try {
        const payload = await verifyAppToken(input.token);

        return {
          valid: true,
          payload,
        };
      } catch (error) {
        return {
          valid: false,
          error: "Token verification failed",
        };
      }
    }),
});
