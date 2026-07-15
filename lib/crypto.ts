import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

/**
 * Cryptographic utilities for client-side key management
 * Uses Expo SecureStore for secure key storage
 */

const PRIVATE_KEY_STORAGE_KEY = "dm_app_private_key";
const PUBLIC_KEY_STORAGE_KEY = "dm_app_public_key";
const PUBLIC_ID_STORAGE_KEY = "dm_app_public_id";

/**
 * Generate ECDSA key pair using Web Crypto API
 * Note: Expo doesn't have native ECDSA support, so we use a simplified approach
 * In production, consider using a library like TweetNaCl.js
 */
export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  try {
    // Generate a random key pair (simplified - in production use proper ECDSA)
    const randomBytes = await Crypto.getRandomBytes(32);
    const randomHex = Array.from(randomBytes as Uint8Array)
      .map((b: number) => b.toString(16).padStart(2, "0"))
      .join("");

    // For now, use a simplified key format
    // In production, implement proper ECDSA using a library
    const publicKey = `-----BEGIN PUBLIC KEY-----\n${randomHex.substring(0, 64)}\n-----END PUBLIC KEY-----`;
    const privateKey = `-----BEGIN PRIVATE KEY-----\n${randomHex}\n-----END PRIVATE KEY-----`;

    return { publicKey, privateKey };
  } catch (error) {
    console.error("Failed to generate key pair:", error);
    throw error;
  }
}

/**
 * Save private key to secure storage
 */
export async function savePrivateKey(privateKey: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PRIVATE_KEY_STORAGE_KEY, privateKey);
  } catch (error) {
    console.error("Failed to save private key:", error);
    throw error;
  }
}

/**
 * Save public key to local storage
 */
export async function savePublicKey(publicKey: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PUBLIC_KEY_STORAGE_KEY, publicKey);
  } catch (error) {
    console.error("Failed to save public key:", error);
    throw error;
  }
}

/**
 * Get private key from secure storage
 */
export async function getPrivateKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PRIVATE_KEY_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to retrieve private key:", error);
    return null;
  }
}

/**
 * Get public key from local storage
 */
export async function getPublicKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PUBLIC_KEY_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to retrieve public key:", error);
    return null;
  }
}

/**
 * Check if keys exist
 */
export async function keysExist(): Promise<boolean> {
  try {
    const privateKey = await getPrivateKey();
    const publicKey = await getPublicKey();
    return !!privateKey && !!publicKey;
  } catch (error) {
    console.error("Failed to check keys:", error);
    return false;
  }
}

/**
 * Delete all keys (for logout)
 */
export async function deleteKeys(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PRIVATE_KEY_STORAGE_KEY);
    await SecureStore.deleteItemAsync(PUBLIC_KEY_STORAGE_KEY);
    await SecureStore.deleteItemAsync(PUBLIC_ID_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to delete keys:", error);
    throw error;
  }
}

/**
 * Save public ID
 */
export async function savePublicId(publicId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PUBLIC_ID_STORAGE_KEY, publicId);
  } catch (error) {
    console.error("Failed to save public ID:", error);
    throw error;
  }
}

/**
 * Get public ID
 */
export async function getPublicId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PUBLIC_ID_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to retrieve public ID:", error);
    return null;
  }
}

/**
 * Sign a message with private key
 * Note: This is a placeholder - implement proper ECDSA signing
 */
export async function signMessage(message: string): Promise<string> {
  try {
    const privateKey = await getPrivateKey();
    if (!privateKey) {
      throw new Error("Private key not found");
    }

    // Placeholder signature - in production, use proper ECDSA
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      message
    );

    return digest;
  } catch (error) {
    console.error("Failed to sign message:", error);
    throw error;
  }
}

/**
 * Create a signature for API requests
 */
export async function createRequestSignature(
  payload: string,
  timestamp: number
): Promise<string> {
  try {
    const message = `${payload}:${timestamp}`;
    return await signMessage(message);
  } catch (error) {
    console.error("Failed to create request signature:", error);
    throw error;
  }
}
