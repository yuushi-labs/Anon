import { Platform } from "react-native";

const SENTRY_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_SENTRY === "true" && Platform.OS !== "web";

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";
const SENTRY_ENVIRONMENT = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? "preview";

let sentryModulePromise: Promise<typeof import("@sentry/react-native")> | null = null;
let sentryInitialized = false;

function shouldEnableSentry() {
  return SENTRY_ENABLED && SENTRY_DSN.length > 0;
}

async function loadSentryModule() {
  if (!shouldEnableSentry()) {
    return null;
  }

  if (!sentryModulePromise) {
    const dynamicRequire: typeof require = eval("require");
    sentryModulePromise = Promise.resolve(dynamicRequire("@sentry/react-native"));
  }

  return sentryModulePromise;
}

function toError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error("Unknown error");
  }
}

export function isSentryEnabled() {
  return shouldEnableSentry();
}

export async function initSentry() {
  if (!shouldEnableSentry() || sentryInitialized) {
    return;
  }

  const Sentry = await loadSentryModule();
  if (!Sentry || sentryInitialized) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    debug: __DEV__,
    tracesSampleRate: 0,
    enableAutoSessionTracking: true,
  });

  sentryInitialized = true;
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
) {
  if (!shouldEnableSentry()) {
    return;
  }

  void (async () => {
    const Sentry = await loadSentryModule();
    if (!Sentry) {
      return;
    }

    if (!sentryInitialized) {
      await initSentry();
    }

    Sentry.withScope((scope) => {
      if (context) {
        scope.setContext("app", context);
      }

      Sentry.captureException(toError(error));
    });
  })();
}