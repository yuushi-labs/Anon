import { describe, expect, it, vi, beforeEach } from "vitest";

const store = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
}));

vi.mock("@/constants/oauth", () => ({
  getApiBaseUrl: () => "http://192.0.2.10:3000",
}));

async function loadModule() {
  vi.resetModules();
  return await import("@/lib/server-url");
}

describe("server-url", () => {
  beforeEach(() => {
    store.clear();
  });

  it("falls back to the build-time URL when no override is set", async () => {
    const mod = await loadModule();
    await mod.loadServerUrlOverride();
    expect(mod.getServerUrlOverride()).toBeNull();
    expect(mod.resolveApiBaseUrl()).toBe("http://192.0.2.10:3000");
  });

  it("normalizes and persists the override", async () => {
    const mod = await loadModule();
    await mod.loadServerUrlOverride();
    const applied = await mod.setServerUrlOverride(
      "  https://abc123.ngrok.app/  ",
    );
    expect(applied).toBe("https://abc123.ngrok.app");
    expect(mod.resolveApiBaseUrl()).toBe("https://abc123.ngrok.app");
    expect(store.get("debug_server_url_override")).toBe(
      "https://abc123.ngrok.app",
    );
  });

  it("restores the persisted override after a reload", async () => {
    store.set("debug_server_url_override", "https://tunnel.example.com");
    const mod = await loadModule();
    await mod.loadServerUrlOverride();
    expect(mod.resolveApiBaseUrl()).toBe("https://tunnel.example.com");
  });

  it("clears the override", async () => {
    const mod = await loadModule();
    await mod.loadServerUrlOverride();
    await mod.setServerUrlOverride("https://abc123.ngrok.app");
    await mod.setServerUrlOverride(null);
    expect(mod.getServerUrlOverride()).toBeNull();
    expect(mod.resolveApiBaseUrl()).toBe("http://192.0.2.10:3000");
    expect(store.has("debug_server_url_override")).toBe(false);
  });

  it("treats blank input as no override", async () => {
    const mod = await loadModule();
    await mod.loadServerUrlOverride();
    expect(await mod.setServerUrlOverride("   ")).toBeNull();
    expect(mod.resolveApiBaseUrl()).toBe("http://192.0.2.10:3000");
  });

  it("rejects values without an http(s) scheme", async () => {
    const mod = await loadModule();
    await mod.loadServerUrlOverride();
    await expect(mod.setServerUrlOverride("abc123.ngrok.app")).rejects.toThrow(
      /http:\/\/ または https:\/\//,
    );
    expect(mod.getServerUrlOverride()).toBeNull();
  });

  it("notifies subscribers when the override changes", async () => {
    const mod = await loadModule();
    await mod.loadServerUrlOverride();
    const listener = vi.fn();
    const unsubscribe = mod.subscribeServerUrl(listener);

    await mod.setServerUrlOverride("https://abc123.ngrok.app");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await mod.setServerUrlOverride(null);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
