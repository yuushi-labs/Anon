import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { appUsers, type AppUser, type User } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { verifyAppToken } from "./app-jwt";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  appUser: AppUser | null;
};

export async function createContext(
  opts: CreateExpressContextOptions,
): Promise<TrpcContext> {
  let user: User | null = null;
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

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    appUser,
  };
}
