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
  // Check timestamp freshness
  const now = Date.now();
  if (now - timestamp > maxAge || timestamp > now + 1000) {
    console.error("Request timestamp is stale or in the future");
    return false;
  }

  // Check nonce for replay attack
  if (nonce) {
    const nonceKey = `${publicKeyPem}:${nonce}`;
    if (usedNonces.has(nonceKey)) {
      console.error("Nonce has already been used (replay attack detected)");
      return false;
    }
    usedNonces.add(nonceKey);
    
    // Clean up old nonces (simple cleanup for prototype)
    if (usedNonces.size > 10000) {
      usedNonces.clear();
    }
  }

  // Verify signature
  // Normalization: Concatenate parts with colons (must match client)
  const message = [payload, timestamp.toString(), nonce].filter(Boolean).join(":");
  return verifySignature(message, signature, publicKeyPem);
}
