import { describe, expect, it, vi } from "vitest";
import {
  createRequestSignature,
  generateKeyPair,
  verifyRequestSignature,
} from "../server/_core/crypto";

describe("request signature verification", () => {
  it("accepts valid P-256 ECDSA request signatures", () => {
    const { publicKey, privateKey } = generateKeyPair();
    const payload = JSON.stringify({ conversationId: 1, content: "hello" });
    const timestamp = Date.now();
    const signature = createRequestSignature(payload, privateKey, timestamp);

    expect(
      verifyRequestSignature(payload, signature, publicKey, timestamp),
    ).toBe(true);
  });

  it("rejects tampered payloads", () => {
    const { publicKey, privateKey } = generateKeyPair();
    const timestamp = Date.now();
    const signature = createRequestSignature("original", privateKey, timestamp);

    expect(
      verifyRequestSignature("tampered", signature, publicKey, timestamp),
    ).toBe(false);
  });

  it("rejects expired timestamps", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-15T00:00:00.000Z"));
      const { publicKey, privateKey } = generateKeyPair();
      const timestamp = Date.now();
      const signature = createRequestSignature(
        "payload",
        privateKey,
        timestamp,
      );

      vi.setSystemTime(new Date("2026-07-15T00:06:00.000Z"));

      expect(
        verifyRequestSignature("payload", signature, publicKey, timestamp),
      ).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
