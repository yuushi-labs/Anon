import { jwtVerify } from "jose";
import { getDb } from "../db";
import { appUsers } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);

/**
 * Verify JWT token and return user data
 */
export async function verifyJWT(token: string): Promise<{
  userId: number;
  publicId: string;
  username: string;
} | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload as any;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }
  return parts[1];
}

/**
 * Verify user exists in database
 */
export async function verifyUserExists(userId: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    const users = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.id, userId))
      .limit(1);

    return users.length > 0;
  } catch (error) {
    console.error("User verification failed:", error);
    return false;
  }
}

/**
 * Complete authentication check
 */
export async function authenticateRequest(
  authHeader?: string
): Promise<{ userId: number; publicId: string; username: string } | null> {
  const token = extractToken(authHeader);
  if (!token) return null;

  const payload = await verifyJWT(token);
  if (!payload) return null;

  const userExists = await verifyUserExists(payload.userId);
  if (!userExists) return null;

  return payload;
}
