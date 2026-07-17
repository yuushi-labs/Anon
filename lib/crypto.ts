import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

/**
 * Cryptographic utilities for client-side key management
 * Uses Expo SecureStore for secure key storage on native platforms,
 * and localStorage as a fallback on web.
 */

const PRIVATE_KEY_STORAGE_KEY = "dm_app_private_key";
const PUBLIC_KEY_STORAGE_KEY = "dm_app_public_key";
const PUBLIC_ID_STORAGE_KEY = "dm_app_public_id";

/**
 * Helper to get item from storage with web fallback
 */
async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    // SecureStore.getItemAsync is known to have issues on web in some Expo versions
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.warn(`Storage access failed for key ${key}:`, error);
    return null;
  }
}

/**
 * Helper to set item in storage with web fallback
 */
async function setItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.error(`Storage set failed for key ${key}:`, error);
    throw error;
  }
}

/**
 * Helper to delete item from storage with web fallback
 */
async function deleteItem(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.error(`Storage delete failed for key ${key}:`, error);
    throw error;
  }
}

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
    // In a real production environment with Expo, we would use a library like 'react-native-keychain' 
    // or 'expo-standard-web-crypto' for P-256 ECDSA. 
    // Since we are constrained to the current environment, we will generate a random 32-byte seed
    // and use it as a placeholder for a real P-256 private key.
    const randomBytes = await Crypto.getRandomBytes(32);
    const privateKey = Array.from(randomBytes as Uint8Array)
      .map((b: number) => b.toString(16).padStart(2, "0"))
      .join("");

    // For the public key, we'll use a hash of the private key as a placeholder
    // In a real implementation, this would be the corresponding point on the curve
    const publicKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      privateKey
    );

    return { 
      publicKey: `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`, 
      privateKey: `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----` 
    };
  } catch (error) {
    console.error("Failed to generate key pair:", error);
    throw error;
  }
}

/**
 * Save private key to secure storage
 */
export async function savePrivateKey(privateKey: string): Promise<void> {
  await setItem(PRIVATE_KEY_STORAGE_KEY, privateKey);
}

/**
 * Save public key to local storage
 */
export async function savePublicKey(publicKey: string): Promise<void> {
  await setItem(PUBLIC_KEY_STORAGE_KEY, publicKey);
}

/**
 * Get private key from secure storage
 */
export async function getPrivateKey(): Promise<string | null> {
  return await getItem(PRIVATE_KEY_STORAGE_KEY);
}

/**
 * Get public key from local storage
 */
export async function getPublicKey(): Promise<string | null> {
  return await getItem(PUBLIC_KEY_STORAGE_KEY);
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
    // Return false instead of throwing to prevent initialization loops
    return false;
  }
}

/**
 * Delete all keys (for logout)
 */
export async function deleteKeys(): Promise<void> {
  try {
    await deleteItem(PRIVATE_KEY_STORAGE_KEY);
    await deleteItem(PUBLIC_KEY_STORAGE_KEY);
    await deleteItem(PUBLIC_ID_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to delete keys:", error);
    throw error;
  }
}

/**
 * Save public ID
 */
export async function savePublicId(publicId: string): Promise<void> {
  await setItem(PUBLIC_ID_STORAGE_KEY, publicId);
}

/**
 * Get public ID
 */
export async function getPublicId(): Promise<string | null> {
  return await getItem(PUBLIC_ID_STORAGE_KEY);
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

    // In a real production environment, we would use the private key to sign the message
    // using ECDSA P-256. Here we simulate this by hashing the message with the private key.
    // This is still a placeholder but follows the structure of signing.
    const combined = `${message}:${privateKey}`;
    const signature = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combined
    );

    return signature;
  } catch (error) {
    console.error("Failed to sign message:", error);
    throw error;
  }
}

/**
 * Generate a random nonce for replay attack prevention
 */
export async function generateNonce(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytes(16);
  return Array.from(randomBytes as Uint8Array)
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Create a signature for API requests
 * 
 * Data normalization:
 * The data is concatenated using colons (:) in the order: payload, timestamp, and optionally nonce.
 * Example: "user_123:1625097600000:abc123nonce"
 */
export async function createRequestSignature(
  payload: string,
  timestamp: number,
  nonce?: string
): Promise<string> {
  try {
    // Normalization: Concatenate parts with colons
    const message = [payload, timestamp.toString(), nonce].filter(Boolean).join(":");
    return await signMessage(message);
  } catch (error) {
    console.error("Failed to create request signature:", error);
    throw error;
  }
}
