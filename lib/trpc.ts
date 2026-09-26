import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { Platform } from "react-native";
import type { AppRouter } from "@/server/routers";
import { resolveApiBaseUrl } from "@/lib/server-url";
import * as Auth from "@/lib/_core/auth";
import { captureException } from "@/lib/_core/sentry";

/**
 * IMPORTANT (tRPC v11): The `transformer` must be inside `httpBatchLink`,
 * NOT at the root createClient level. This ensures client and server
 * use the same serialization format (superjson).
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Creates the tRPC client with proper configuration.
 * Call this once in your app's root layout.
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: (() => {
          const baseUrl = resolveApiBaseUrl();
          if (Platform.OS !== "web" && !baseUrl) {
            captureException(
              new Error(
                "[tRPC] EXPO_PUBLIC_API_BASE_URL is required for native tRPC requests.",
              ),
              {
                area: "trpc",
                baseUrl,
              },
            );
            throw new Error(
              "[tRPC] EXPO_PUBLIC_API_BASE_URL is required for native tRPC requests.",
            );
          }
          const u = baseUrl ? `${baseUrl}/api/trpc` : "/api/trpc";
          console.log("[tRPC] Connecting to:", u, "BaseURL:", baseUrl || "(empty)");
          return u;
        })(),
        // tRPC v11: transformer MUST be inside httpBatchLink, not at root
        transformer: superjson,
        async headers() {
          const token = await Auth.getSessionToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        // Custom fetch to include credentials for cookie-based auth
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "include",
          });
        },
      }),
    ],
  });
}
