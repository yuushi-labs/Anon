import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { appUsers, type AppUser, type User } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { verifyAppToken } from "./app-jwt";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  appUser: AppUser | null;
};

export async function createContext(
  opts: CreateExpressContextOptions,
): Promise<TrpcContext> {
  let appUser: AppUser | null = null;

  const authHeader =
    opts.req.headers.authorization || opts.req.headers.Authorization;
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;

  if (bearerToken) {
    try {
      const payload = await verifyAppToken(bearerToken);
      const database = await getDb();
      const rows = database
        ? await database
            .select()
            .from(appUsers)
            .where(eq(appUsers.id, payload.userId))
            .limit(1)
        : [];
      appUser = rows[0] ?? null;
    } catch (error) {
      appUser = null;
    }
  }

  // 旧 Manus テンプレートの認証 (sdk.authenticateRequest) はこの app の
  // JWT 形式 (userId/publicId) と互換性がなく、verifySession が
  // "Session payload missing required fields" を返していた。
  // 同じ Authorization ヘッダを読むため app の全リクエストで
  // 警告が出続けていたが、app 自身の認証は上の verifyAppToken のみで
  // 完結しており、この経路は一切成功しない。
  // user はテンプレートの users テーブル (openId) を前提にした
  // legacyAuth.me / adminProcedure 用のフィールドで、この app では
  // 常に null のままになる。
  const user: User | null = null;

  return {
    req: opts.req,
    res: opts.res,
    user,
    appUser,
  };
}
