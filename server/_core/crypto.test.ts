import { describe, it, expect, beforeEach } from "vitest";
import { generateKeyPair, signMessage, verifyRequestSignature } from "./crypto";

describe("Crypto Signature Verification", () => {
  let publicKey: string;
  let privateKey: string;

  beforeEach(() => {
    const keys = generateKeyPair();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
  });

  it("should verify a valid signature", () => {
    const payload = "test-payload";
    const timestamp = Date.now();
    const nonce = "nonce123";
    const message = `${payload}:${timestamp}:${nonce}`;
    const signature = signMessage(message, privateKey);

    const isValid = verifyRequestSignature(payload, signature, publicKey, timestamp, nonce);
    expect(isValid).toBe(true);
  });

  it("should fail for an invalid signature", () => {
    const payload = "test-payload";
    const timestamp = Date.now();
    const nonce = "nonce123";
    const signature = "invalid-signature";

    const isValid = verifyRequestSignature(payload, signature, publicKey, timestamp, nonce);
    expect(isValid).toBe(false);
  });

  it("should fail for a tampered payload", () => {
    const payload = "test-payload";
    const tamperedPayload = "tampered-payload";
    const timestamp = Date.now();
    const nonce = "nonce123";
    const message = `${payload}:${timestamp}:${nonce}`;
    const signature = signMessage(message, privateKey);

    const isValid = verifyRequestSignature(tamperedPayload, signature, publicKey, timestamp, nonce);
    expect(isValid).toBe(false);
  });

  it("should fail for an expired timestamp", () => {
    const payload = "test-payload";
    const expiredTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
    const nonce = "nonce123";
    const message = `${payload}:${expiredTimestamp}:${nonce}`;
    const signature = signMessage(message, privateKey);

    const isValid = verifyRequestSignature(payload, signature, publicKey, expiredTimestamp, nonce);
    expect(isValid).toBe(false);
  });

  it("should fail for a future timestamp", () => {
    const payload = "test-payload";
    const futureTimestamp = Date.now() + 10 * 60 * 1000; // 10 minutes in future
    const nonce = "nonce123";
    const message = `${payload}:${futureTimestamp}:${nonce}`;
    const signature = signMessage(message, privateKey);

    const isValid = verifyRequestSignature(payload, signature, publicKey, futureTimestamp, nonce);
    expect(isValid).toBe(false);
  });

  it("should fail for a reused nonce (replay attack)", () => {
    const payload = "test-payload";
    const timestamp = Date.now();
    const nonce = "reused-nonce";
    const message = `${payload}:${timestamp}:${nonce}`;
    const signature = signMessage(message, privateKey);

    // First use should succeed
    const firstAttempt = verifyRequestSignature(payload, signature, publicKey, timestamp, nonce);
    expect(firstAttempt).toBe(true);

    // Second use with same nonce should fail
    const secondAttempt = verifyRequestSignature(payload, signature, publicKey, timestamp, nonce);
    expect(secondAttempt).toBe(false);
  });
});
