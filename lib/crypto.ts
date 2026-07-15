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
