import { createSign, createVerify, generateKeyPairSync } from "crypto";

/**
 * Cryptographic utilities for ECDSA-based authentication
 * Uses ECDSA (Elliptic Curve Digital Signature Algorithm) for secure key-based authentication
 */

export interface KeyPair {
  publicKey: string;  // hex-encoded public key
  privateKey: string; // hex-encoded private key
}

/**
 * Generate an ECDSA key pair
 * @returns KeyPair with hex-encoded public and private keys
 */
export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1", // P-256 curve
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  return {
    publicKey: publicKey,
    privateKey: privateKey,
  };
}

/**
 * Sign a message using a private key
 * @param message - The message to sign
 * @param privateKeyPem - Private key in PEM format
 * @returns Signature as hex string
 */
export function signMessage(message: string, privateKeyPem: string): string {
  const sign = createSign("sha256");
  sign.update(message);
  const signature = sign.sign(privateKeyPem, "hex");
  return signature;
}

/**
 * Verify a message signature using a public key
 * @param message - The original message
 * @param signature - The signature as hex string
 * @param publicKeyPem - Public key in PEM format
 * @returns true if signature is valid, false otherwise
 */
export function verifySignature(
  message: string,
  signature: string,
  publicKeyPem: string
): boolean {
  try {
    const verify = createVerify("sha256");
    verify.update(message);
    return verify.verify(publicKeyPem, Buffer.from(signature, "hex"));
  } catch (error) {
    console.error("Signature verification failed:", error);
    return false;
  }
}

/**
 * Create a deterministic signature for API requests
 * Combines timestamp and nonce for replay attack prevention
 * @param payload - Request payload as JSON string
 * @param privateKeyPem - Private key in PEM format
 * @param timestamp - Current timestamp (ms)
 * @returns Signature as hex string
 */
export function createRequestSignature(
  payload: string,
  privateKeyPem: string,
  timestamp: number
): string {
  const message = `${payload}:${timestamp}`;
  return signMessage(message, privateKeyPem);
}

// In-memory cache for used nonces to prevent replay attacks
// In production, use Redis with TTL
const usedNonces = new Set<string>();

/**
 * クライアントの時計がサーバーに対して許容するずれ（毫秒）。
 *
 * 従来は未来側 1 秒しか許容せず、実機の時計が数秒進んでいるだけで
 * 署名検証全体の検証で弾かれて "Invalid signature" になっていた。
 * リプレイ防止は nonce が担うため、時刻は緩めの公差でよい。
 */
export const CLOCK_SKEW_TOLERANCE_MS = 30 * 1000;

export type SignatureFailureReason =
  /** timestamp が許容範囲より古い（クライアント時計が遅い、または古いリクエスト） */
  | "stale_timestamp"
  /** timestamp が許容範囲より新しい（クライアント時計が速い） */
  | "clock_skew"
  /** nonce が再利用されている（リプレイ攻撃） */
  | "nonce_reused"
  /** 署名自体が一致しない */
  | "bad_signature";

export interface SignatureVerificationResult {
  valid: boolean;
  reason?: SignatureFailureReason;
  /**
   * timestamp とサーバー時刻の差（ms）。正ならクライアント時計が速い。
   */
  skewMs?: number;
}

/**
 * 検証結果の理由まで返す版。UI 側で原因を提示できるようにするため使用する。
 * 判定内容は verifyRequestSignature と完全に同一。
 */
export function verifyRequestSignatureDetailed(
  payload: string,
  signature: string,
  publicKeyPem: string,
  timestamp: number,
  nonce?: string,
  maxAge: number = 5 * 60 * 1000
): SignatureVerificationResult {
  const now = Date.now();
  const skewMs = timestamp - now;

  if (skewMs > CLOCK_SKEW_TOLERANCE_MS) {
    console.error(
      `Request timestamp is too far in the future (skew: ${skewMs}ms)`
    );
    return { valid: false, reason: "clock_skew", skewMs };
  }

  if (-skewMs > maxAge) {
    console.error(`Request timestamp is stale (skew: ${skewMs}ms)`);
    return { valid: false, reason: "stale_timestamp", skewMs };
  }

  if (nonce) {
    const nonceKey = `${publicKeyPem}:${nonce}`;
    if (usedNonces.has(nonceKey)) {
      console.error("Nonce has already been used (replay attack detected)");
      return { valid: false, reason: "nonce_reused", skewMs };
    }
    usedNonces.add(nonceKey);

    // Clean up old nonces (simple cleanup for prototype)
    if (usedNonces.size > 10000) {
      usedNonces.clear();
    }
  }

  // Normalization: Concatenate parts with colons (must match client)
  const message = [payload, timestamp.toString(), nonce].filter(Boolean).join(":");
  if (!verifySignature(message, signature, publicKeyPem)) {
    return { valid: false, reason: "bad_signature", skewMs };
  }

  return { valid: true, skewMs };
}

/**
 * Verify a request signature
 * @param payload - Request payload as JSON string
 * @param signature - Signature as hex string
 * @param publicKeyPem - Public key in PEM format
 * @param timestamp - Timestamp from request
 * @param nonce - Random string from request
 * @param maxAge - Maximum age of request in milliseconds (default: 5 minutes)
 * @returns true if signature is valid and not expired, false otherwise
 */
export function verifyRequestSignature(
  payload: string,
  signature: string,
  publicKeyPem: string,
  timestamp: number,
  nonce?: string,
  maxAge: number = 5 * 60 * 1000
): boolean {
  return verifyRequestSignatureDetailed(
    payload,
    signature,
    publicKeyPem,
    timestamp,
    nonce,
    maxAge
  ).valid;
}
