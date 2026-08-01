const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");

// getSentryExpoConfig() は内部で expo/metro-config の getDefaultConfig() を呼び出しつつ、
// ソースマップアップロード・デバッグID埋め込みに必要な設定を追加してくれる。
const config = getSentryExpoConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
