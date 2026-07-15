import * as SecureStore from "expo-secure-store";

/**
 * Cryptographic utilities for client-side key management.
 * Keys are generated with P-256 ECDSA and persisted through Expo SecureStore.
 */

const PRIVATE_KEY_STORAGE_KEY = "dm_app_private_key";
const PUBLIC_KEY_STORAGE_KEY = "dm_app_public_key";
const PUBLIC_ID_STORAGE_KEY = "dm_app_public_id";

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API is not available on this runtime");
  }
  return subtle;
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const binary = Array.from(new Uint8Array(bytes), (byte) =>
    String.fromCharCode(byte),
  ).join("");
  return globalThis.btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function pemEncode(label: string, bytes: ArrayBuffer): string {
  const base64 = bytesToBase64(bytes);
  const lines = base64.match(/.{1,64}/g)?.join("\n") ?? base64;
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
}

function pemDecode(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s/g, "");
  const bytes = base64ToBytes(base64);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function trimLeadingZeroes(bytes: Uint8Array): Uint8Array {
  let offset = 0;
  while (offset < bytes.length - 1 && bytes[offset] === 0) offset += 1;
  return bytes.slice(offset);
}

function encodeDerInteger(bytes: Uint8Array): Uint8Array {
  const trimmed = trimLeadingZeroes(bytes);
  const needsPadding = (trimmed[0] & 0x80) !== 0;
  const value = needsPadding
    ? new Uint8Array([0, ...Array.from(trimmed)])
    : trimmed;
  return new Uint8Array([0x02, value.length, ...Array.from(value)]);
}

function webCryptoEcdsaSignatureToDer(signature: ArrayBuffer): Uint8Array {
  const raw = new Uint8Array(signature);
  if (raw.length !== 64) {
    throw new Error("Unexpected P-256 ECDSA signature length");
  }
  const r = encodeDerInteger(raw.slice(0, 32));
  const s = encodeDerInteger(raw.slice(32));
  const body = new Uint8Array([...Array.from(r), ...Array.from(s)]);
  return new Uint8Array([0x30, body.length, ...Array.from(body)]);
}

async function importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  return getSubtleCrypto().importKey(
    "pkcs8",
    pemDecode(privateKeyPem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

/**
 * Generate a P-256 ECDSA key pair compatible with the Node.js server verifier.
 */
export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const keyPair = await getSubtleCrypto().generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );

  const publicKeyBytes = await getSubtleCrypto().exportKey(
    "spki",
    keyPair.publicKey,
  );
  const privateKeyBytes = await getSubtleCrypto().exportKey(
    "pkcs8",
    keyPair.privateKey,
  );

  return {
    publicKey: pemEncode("PUBLIC KEY", publicKeyBytes),
    privateKey: pemEncode("PRIVATE KEY", privateKeyBytes),
  };
}

export async function savePrivateKey(privateKey: string): Promise<void> {
  await SecureStore.setItemAsync(PRIVATE_KEY_STORAGE_KEY, privateKey);
}

export async function savePublicKey(publicKey: string): Promise<void> {
  await SecureStore.setItemAsync(PUBLIC_KEY_STORAGE_KEY, publicKey);
}

export async function getPrivateKey(): Promise<string | null> {
  return SecureStore.getItemAsync(PRIVATE_KEY_STORAGE_KEY);
}

export async function getPublicKey(): Promise<string | null> {
  return SecureStore.getItemAsync(PUBLIC_KEY_STORAGE_KEY);
}

export async function keysExist(): Promise<boolean> {
  const privateKey = await getPrivateKey();
  const publicKey = await getPublicKey();
  return !!privateKey && !!publicKey;
}

export async function deleteKeys(): Promise<void> {
  await SecureStore.deleteItemAsync(PRIVATE_KEY_STORAGE_KEY);
  await SecureStore.deleteItemAsync(PUBLIC_KEY_STORAGE_KEY);
  await SecureStore.deleteItemAsync(PUBLIC_ID_STORAGE_KEY);
}

export async function savePublicId(publicId: string): Promise<void> {
  await SecureStore.setItemAsync(PUBLIC_ID_STORAGE_KEY, publicId);
}

export async function getPublicId(): Promise<string | null> {
  return SecureStore.getItemAsync(PUBLIC_ID_STORAGE_KEY);
}

export async function signMessage(message: string): Promise<string> {
  const privateKeyPem = await getPrivateKey();
  if (!privateKeyPem) {
    throw new Error("Private key not found");
  }

  const privateKey = await importPrivateKey(privateKeyPem);
  const signature = await getSubtleCrypto().sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(message),
  );

  return Array.from(webCryptoEcdsaSignatureToDer(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function createRequestSignature(
  payload: string,
  timestamp: number,
): Promise<string> {
  return signMessage(`${payload}:${timestamp}`);
}
