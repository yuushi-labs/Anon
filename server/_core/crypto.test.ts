import { describe, it, expect, beforeEach } from "vitest";
import {
  CLOCK_SKEW_TOLERANCE_MS,
  generateKeyPair,
  signMessage,
  verifyRequestSignature,
  verifyRequestSignatureDetailed,
} from "./crypto";

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

describe("verifyRequestSignatureDetailed", () => {
  let publicKey: string;
  let privateKey: string;

  beforeEach(() => {
    const keys = generateKeyPair();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
  });

  it("reports success for a valid signature", () => {
    const payload = "test-payload";
    const timestamp = Date.now();
    const nonce = "nonce-valid";
    const signature = signMessage(`${payload}:${timestamp}:${nonce}`, privateKey);

    const result = verifyRequestSignatureDetailed(
      payload,
      signature,
      publicKey,
      timestamp,
      nonce,
    );
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("tolerates a client clock running slightly fast", () => {
    const payload = "test-payload";
    const nonce = "nonce-skew-ok";
    const timestamp = Date.now() + 5 * 1000;
    const signature = signMessage(`${payload}:${timestamp}:${nonce}`, privateKey);

    const result = verifyRequestSignatureDetailed(
      payload,
      signature,
      publicKey,
      timestamp,
      nonce,
    );
    expect(result.valid).toBe(true);
  });

  it("reports clock_skew when the client clock is too far ahead", () => {
    const payload = "test-payload";
    const nonce = "nonce-skew-bad";
    const timestamp = Date.now() + CLOCK_SKEW_TOLERANCE_MS + 10 * 1000;
    const signature = signMessage(`${payload}:${timestamp}:${nonce}`, privateKey);

    const result = verifyRequestSignatureDetailed(
      payload,
      signature,
      publicKey,
      timestamp,
      nonce,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("clock_skew");
    expect(result.skewMs).toBeGreaterThan(CLOCK_SKEW_TOLERANCE_MS);
  });

  it("reports stale_timestamp when the request is too old", () => {
    const payload = "test-payload";
    const nonce = "nonce-stale";
    const timestamp = Date.now() - 10 * 60 * 1000;
    const signature = signMessage(`${payload}:${timestamp}:${nonce}`, privateKey);

    const result = verifyRequestSignatureDetailed(
      payload,
      signature,
      publicKey,
      timestamp,
      nonce,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("stale_timestamp");
  });

  it("reports nonce_reused on replay", () => {
    const payload = "test-payload";
    const timestamp = Date.now();
    const nonce = "nonce-replay";
    const signature = signMessage(`${payload}:${timestamp}:${nonce}`, privateKey);

    const first = verifyRequestSignatureDetailed(
      payload,
      signature,
      publicKey,
      timestamp,
      nonce,
    );
    expect(first.valid).toBe(true);

    const second = verifyRequestSignatureDetailed(
      payload,
      signature,
      publicKey,
      timestamp,
      nonce,
    );
    expect(second.valid).toBe(false);
    expect(second.reason).toBe("nonce_reused");
  });

  it("reports bad_signature when the signature does not match", () => {
    const payload = "test-payload";
    const timestamp = Date.now();
    const nonce = "nonce-bad-sig";

    const result = verifyRequestSignatureDetailed(
      payload,
      "00".repeat(70),
      publicKey,
      timestamp,
      nonce,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("bad_signature");
  });
});
