import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { appUsers } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { verifyRequestSignatureDetailed } from "../_core/crypto";
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
        nonce: z.string().optional(),
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
        // The message signed by client is "publicId:timestamp[:nonce]"
        const verification = verifyRequestSignatureDetailed(
          input.publicId,
          input.signature,
          user.publicKey,
          input.timestamp,
          input.nonce,
          5 * 60 * 1000, // 5 minute expiry
        );

        if (!verification.valid) {
          // 原因が分かるメッセージを返さないと、原因が_timestampずれでも
          // 署名不一致でも同じ "Invalid signature" になり調査できない。
          const skewSeconds =
            typeof verification.skewMs === "number"
              ? Math.round(Math.abs(verification.skewMs) / 1000)
              : null;

          const messageByReason: Record<string, string> = {
            clock_skew: `端末の時刻がサーバーより${skewSeconds}秒進んでいます。設定の「日付と時刻を自動設定」をオンにしてください。`,
            stale_timestamp: `端末の時刻がサーバーより${skewSeconds}秒遅れています。設定の「日付と時刻を自動設定」をオンにしてください。`,
            nonce_reused:
              "同じリクエストが再送されました。時間をおいて再度お試しください。",
            bad_signature:
              "署名の検証に失敗しました。時刻のずれまたは鍵の不整合を疑ってください。",
          };

          throw new TRPCError({
            code: "UNAUTHORIZED",
            message:
              messageByReason[verification.reason ?? "bad_signature"] ??
              "Invalid signature",
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
