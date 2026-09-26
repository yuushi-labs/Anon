// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";
// 拡張子 ".ts" を明示する理由: Expo は app.config.ts を CJS として require するため、
// 拡張子なしの "./constants/build-config" は Node の CJS 解決では "./constants/build-config.js" 等を
// 探して失敗し、`npx expo prebuild` / `expo start` が
// "Cannot find module './constants/build-config'" で停止する。
import { BUILD_CONFIG } from "./constants/build-config.ts";

// 優先順位: 環境変数 EXPO_PUBLIC_API_BASE_URL > constants/build-config.ts のハードコード値
// EAS Buildでeas.jsonのenv設定を忘れていても、build-config.tsの値が必ず使われる。
const resolvedApiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL || BUILD_CONFIG.apiBaseUrl;

// 平文HTTPを許可するのはローカル開発とHTTPS未公開のときだけ。
// Android 9 以降はデフォルトで平文通信をブロックするため、明示的に許可しないと
// release ビルドでは API へ接続できず "Network request failed" になる。
// 正しい注入先は expo-build-properties プラグインの android.usesCleartextTraffic
// （app config の android 直下には schemas に存在しないキーなので無視される）。
const usesCleartextTraffic =
  process.env.NODE_ENV === "development" ||
  resolvedApiBaseUrl.startsWith("http://");

// Bundle ID format: space.manus.<project_name_dots>.<timestamp>
// e.g., "my-app" created at 2024-01-15 10:30:45 -> "space.manus.my.app.t20240115103045"
// Bundle ID can only contain letters, numbers, and dots
// Android requires each dot-separated segment to start with a letter
const rawBundleId = "com.app.anonymousdmapp";
const bundleId =
  rawBundleId
    .replace(/[-_]/g, ".") // Replace hyphens/underscores with dots
    .replace(/[^a-zA-Z0-9.]/g, "") // Remove invalid chars
    .replace(/\.+/g, ".") // Collapse consecutive dots
    .replace(/^\.+|\.+$/g, "") // Trim leading/trailing dots
    .toLowerCase()
    .split(".")
    .map((segment) => {
      // Android requires each segment to start with a letter
      // Prefix with 'x' if segment starts with a digit
      return /^[a-zA-Z]/.test(segment) ? segment : "x" + segment;
    })
    .join(".") || "space.manus.app";
// Extract timestamp from bundle ID and prefix with "manus" for deep link scheme
// e.g., "space.manus.my.app.t20240115103045" -> "manus20240115103045"
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  // App branding - update these values directly (do not use env vars)
  appName: "Anon",
  appSlug: "anonymous-dm-app",
  // S3 URL of the app logo - set this to the URL returned by generate_image when creating custom logo
  // Leave empty to use the default icon from assets/images/icon.png
  logoUrl: "",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
  easProjectId: "f8b9e6e4-4d1a-4f5a-9b8a-1c2d3e4f5a6b", // Placeholder ID for local development
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",


  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    softwareKeyboardLayoutMode: "resize",
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-web-browser",
    "expo-asset",
    [
      "expo-audio",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
          usesCleartextTraffic,
        },
      },
    ],
    [
      "@sentry/react-native/expo",
      {
        organization: "yuushi",
        project: "react-native",
        // url: "https://sentry.io/" (セルフホストしていない場合はdefaultでOK)
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    apiBaseUrl: resolvedApiBaseUrl,
    eas: {
      projectId: env.easProjectId,
    },
  },
};

export default config;
