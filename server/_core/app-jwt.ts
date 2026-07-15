import { SignJWT, jwtVerify } from "jose";

export type AppJwtPayload = {
  userId: number;
  publicId: string;
  username: string;
};

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }
  return new TextEncoder().encode(secret);
}

export async function signAppToken(payload: AppJwtPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifyAppToken(token: string): Promise<AppJwtPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    algorithms: ["HS256"],
  });
  const { userId, publicId, username } = payload;
  if (
    typeof userId !== "number" ||
    typeof publicId !== "string" ||
    typeof username !== "string"
  ) {
    throw new Error("Invalid JWT payload");
  }
  return { userId, publicId, username };
}
