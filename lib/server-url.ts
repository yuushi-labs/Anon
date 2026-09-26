import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBaseUrl } from "@/constants/oauth";

/**
 * 実行時に API サーバーの接続先を上書きするための開発用モジュール。
 *
 * ビルド時に焼き込まれた URL（EXPO_PUBLIC_API_BASE_URL / constants/build-config.ts）は
 * APK をビルドし直さないと変更できない。テスト中は ngrok などのトンネルURLを
 * アプリ内から差し替えられるようにするのが目的。
 *
 * 上書きは AsyncStorage に永続化され、アプリ再起動後も有効になる。
 * 本番公開前にこの画面を無効化する場合は constants/build-config.ts の
 * showDebugTools を false にする（開発ビルドでは __DEV__ により常に表示される）。
 */

const STORAGE_KEY_SERVER_URL_OVERRIDE = "debug_server_url_override";

let serverUrlOverride: string | null = null;
let isLoaded = false;
const listeners = new Set<() => void>();

function normalize(value: string | null | undefined): string | null {
  if (!value) return null;
  // 前後の空白と末尾スラッシュを除去し、空文字は上書きなしとして扱う。
  const normalized = value.trim().replace(/\/+$/, "");
  if (normalized.length === 0) return null;
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error(
      "http:// または https:// で始まるURLを入力してください（例: https://abc123.ngrok.app）",
    );
  }
  return normalized;
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error("[ServerUrl] Listener failed:", error);
    }
  });
}

/**
 * ストレージから上書き値を読み込む。アプリの起動時に1度だけ呼ぶ。
 * tRPC クライアントの生成より前に完了させる必要がある。
 */
export async function loadServerUrlOverride(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_SERVER_URL_OVERRIDE);
    serverUrlOverride = normalize(stored);
  } catch (error) {
    console.error("[ServerUrl] Failed to load override:", error);
    serverUrlOverride = null;
  } finally {
    isLoaded = true;
  }
}

export function isServerUrlOverrideLoaded(): boolean {
  return isLoaded;
}

export function getServerUrlOverride(): string | null {
  return serverUrlOverride;
}

/**
 * 実際にリクエストへ使う接続先を返す。上書きがなければビルド時の既定値。
 */
export function resolveApiBaseUrl(): string {
  if (serverUrlOverride) return serverUrlOverride;
  return getApiBaseUrl();
}

/**
 * 上書きを適用して永続化する。null で解除。
 * 適用後、購読者は tRPC クライアントの再生成と Socket.IO の切断を行う。
 */
export async function setServerUrlOverride(
  value: string | null,
): Promise<string | null> {
  const normalized = normalize(value);
  serverUrlOverride = normalized;

  if (normalized) {
    await AsyncStorage.setItem(STORAGE_KEY_SERVER_URL_OVERRIDE, normalized);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY_SERVER_URL_OVERRIDE);
  }

  notifyListeners();
  return normalized;
}

export function subscribeServerUrl(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
