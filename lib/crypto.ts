import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { p256 } from "@noble/curves/nist.js";

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
    const privKeyBytes = await Crypto.getRandomBytes(32);
    // Ensure the private key is valid for p256
    while (!p256.utils.isValidSecretKey(privKeyBytes)) {
      const newBytes = await Crypto.getRandomBytes(32);
      privKeyBytes.set(newBytes);
    }
    
    const pubKeyBytes = p256.getPublicKey(privKeyBytes, false); // false = uncompressed (65 bytes)

    const publicKey = encodePublicKeyToPem(pubKeyBytes);
    const privateKey = encodePrivateKeyToPem(privKeyBytes, pubKeyBytes);

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
    await setItem(PRIVATE_KEY_STORAGE_KEY, privateKey);
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
    await setItem(PUBLIC_KEY_STORAGE_KEY, publicKey);
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
    return await getItem(PRIVATE_KEY_STORAGE_KEY);
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
    return await getItem(PUBLIC_KEY_STORAGE_KEY);
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
  try {
    await setItem(PUBLIC_ID_STORAGE_KEY, publicId);
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
    return await getItem(PUBLIC_ID_STORAGE_KEY);
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
    const privateKeyPem = await getPrivateKey();
    if (!privateKeyPem) {
      throw new Error("Private key not found");
    }

    const privKeyBytes = parsePrivateKeyFromPem(privateKeyPem);
    const msgBuffer = new TextEncoder().encode(message);

    const rawSig = p256.sign(msgBuffer, privKeyBytes);
    const derSig = rawSignatureToDER(rawSig);
    
    // Return hex-encoded DER signature
    return Array.from(derSig)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
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

// ==========================================
// Cryptographic Helper Functions
// ==========================================

function bytesToBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  const l = bytes.length;
  for (let i = 0; i < l; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < l ? bytes[i + 1] : NaN;
    const b3 = i + 2 < l ? bytes[i + 2] : NaN;
    
    const enc1 = b1 >> 2;
    const enc2 = ((b1 & 3) << 4) | (isNaN(b2) ? 0 : b2 >> 4);
    const enc3 = isNaN(b2) ? 64 : ((b2 & 15) << 2) | (isNaN(b3) ? 0 : b3 >> 6);
    const enc4 = isNaN(b3) ? 64 : b3 & 63;
    
    result += chars.charAt(enc1) + chars.charAt(enc2) +
              (enc3 === 64 ? "=" : chars.charAt(enc3)) +
              (enc4 === 64 ? "=" : chars.charAt(enc4));
  }
  return result;
}

function base64ToBytes(b64: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  
  const cleaned = b64.replace(/=/g, "");
  const len = cleaned.length;
  const bufferLength = Math.floor(len * 0.75);
  const bytes = new Uint8Array(bufferLength);
  
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const enc1 = lookup[cleaned.charCodeAt(i)];
    const enc2 = lookup[cleaned.charCodeAt(i + 1)];
    const enc3 = i + 2 < len ? lookup[cleaned.charCodeAt(i + 2)] : 0;
    const enc4 = i + 3 < len ? lookup[cleaned.charCodeAt(i + 3)] : 0;
    
    bytes[p++] = (enc1 << 2) | (enc2 >> 4);
    if (i + 2 < len) {
      bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2);
    }
    if (i + 3 < len) {
      bytes[p++] = ((enc3 & 3) << 6) | enc4;
    }
  }
  return bytes;
}

const SPKI_HEADER = new Uint8Array([
  0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
  0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00
]);

function encodePublicKeyToPem(pubKeyBytes: Uint8Array): string {
  const der = new Uint8Array(SPKI_HEADER.length + pubKeyBytes.length);
  der.set(SPKI_HEADER, 0);
  der.set(pubKeyBytes, SPKI_HEADER.length);
  
  const b64 = bytesToBase64(der);
  const formatted = b64.match(/.{1,64}/g)?.join("\n") || b64;
  return `-----BEGIN PUBLIC KEY-----\n${formatted}\n-----END PUBLIC KEY-----`;
}

function encodePrivateKeyToPem(privKeyBytes: Uint8Array, pubKeyBytes: Uint8Array): string {
  const der = new Uint8Array(138);
  der[0] = 0x30; der[1] = 0x81; der[2] = 0x87;
  der[3] = 0x02; der[4] = 0x01; der[5] = 0x00;
  der[6] = 0x30; der[7] = 0x13;
  const oidEc = [0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01];
  const oidCurve = [0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07];
  der.set(oidEc, 8);
  der.set(oidCurve, 17);
  der[27] = 0x04; der[28] = 0x6d;
  der[29] = 0x30; der[30] = 0x6b;
  der[31] = 0x02; der[32] = 0x01; der[33] = 0x01;
  der[34] = 0x04; der[35] = 0x20;
  der.set(privKeyBytes, 36);
  der[68] = 0xa1; der[69] = 0x44;
  der[70] = 0x03; der[71] = 0x42; der[72] = 0x00;
  der.set(pubKeyBytes, 73);
  
  const b64 = bytesToBase64(der);
  const formatted = b64.match(/.{1,64}/g)?.join("\n") || b64;
  return `-----BEGIN PRIVATE KEY-----\n${formatted}\n-----END PRIVATE KEY-----`;
}

function parsePrivateKeyFromPem(pem: string): Uint8Array {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const der = base64ToBytes(base64);
  if (der[34] === 0x04 && der[35] === 0x20) {
    return der.slice(36, 36 + 32);
  }
  throw new Error("Invalid private key PEM structure");
}

function rawSignatureToDER(rawSig: Uint8Array): Uint8Array {
  let r = rawSig.slice(0, 32);
  let s = rawSig.slice(32, 64);
  
  let rStart = 0;
  while (rStart < r.length - 1 && r[rStart] === 0) rStart++;
  r = r.slice(rStart);
  if (r[0] >= 0x80) {
    const newR = new Uint8Array(r.length + 1);
    newR[0] = 0x00;
    newR.set(r, 1);
    r = newR;
  }
  
  let sStart = 0;
  while (sStart < s.length - 1 && s[sStart] === 0) sStart++;
  s = s.slice(sStart);
  if (s[0] >= 0x80) {
    const newS = new Uint8Array(s.length + 1);
    newS[0] = 0x00;
    newS.set(s, 1);
    s = newS;
  }
  
  const seqLen = 2 + r.length + 2 + s.length;
  const der = new Uint8Array(2 + seqLen);
  der[0] = 0x30;
  der[1] = seqLen;
  
  der[2] = 0x02;
  der[3] = r.length;
  der.set(r, 4);
  
  const sOffset = 4 + r.length;
  der[sOffset] = 0x02;
  der[sOffset + 1] = s.length;
  der.set(s, sOffset + 2);
  
  return der;
}
