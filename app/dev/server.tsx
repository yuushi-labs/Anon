import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { getApiBaseUrl } from "@/constants/oauth";
import {
  getServerUrlOverride,
  resolveApiBaseUrl,
  setServerUrlOverride,
  subscribeServerUrl,
} from "@/lib/server-url";

type ProbeState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; message: string }
  | { status: "failed"; message: string };

const PROBE_TIMEOUT_MS = 8000;

/**
 * 開発者用: API サーバーの接続先をアプリ内で差し替える。
 *
 * ビルド時に焼き込まれた URL は APK を再しないと変更できないため、
 * 実機テスト（ngrok トンネルなど）ではこの画面から切り替える。
 */
export default function DevServerScreen() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isApplied, setIsApplied] = useState(false);
  const [probe, setProbe] = useState<ProbeState>({ status: "idle" });

  const buildTimeUrl = (() => {
    try {
      return getApiBaseUrl();
    } catch {
      return "(未設定)";
    }
  })();

  const appliedUrl = (() => {
    try {
      return resolveApiBaseUrl();
    } catch {
      return "(未設定)";
    }
  })();

  const override = getServerUrlOverride();

  // 適用済みの表示を実際の状態に同期する（他画面での変更にも追従）。
  useEffect(() => {
    const sync = () => {
      const current = getServerUrlOverride();
      setInput(current ?? "");
      setIsApplied(current !== null);
      setProbe({ status: "idle" });
    };
    sync();
    return subscribeServerUrl(sync);
  }, []);

  // 画面に戻った時に、保持している入力が古いにならないようにする。
  useFocusEffect(
    useCallback(() => {
      const current = getServerUrlOverride();
      setInput(current ?? "");
      setIsApplied(current !== null);
    }, []),
  );

  const handleApply = async () => {
    try {
      const applied = await setServerUrlOverride(input);
      setIsApplied(applied !== null);
      setInput(applied ?? "");
      Alert.alert(
        applied ? "接続先を更新しました" : "既定値に戻しました",
        applied
          ? `以後のリクエストは ${applied} へ送信されます。`
          : `以後のリクエストはビルド時の設定 ${buildTimeUrl} へ送信されます。`,
      );
    } catch (error) {
      Alert.alert(
        "接続先を更新できませんでした",
        error instanceof Error ? error.message : "URLの形式を確認してください。",
      );
    }
  };

  const handleReset = async () => {
    try {
      await setServerUrlOverride(null);
      setInput("");
      setIsApplied(false);
    } catch (error) {
      Alert.alert(
        "既定値に戻せませんでした",
        error instanceof Error ? error.message : "不明なエラーが発生しました。",
      );
    }
  };

  const handleProbe = async () => {
    let target: string;
    try {
      target = resolveApiBaseUrl();
    } catch (error) {
      setProbe({
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "接続先が解決できませんでした。",
      });
      return;
    }

    setProbe({ status: "checking" });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const response = await fetch(`${target}/api/health`, {
        signal: controller.signal,
      });
      const body = await response.text();
      const elapsed = Date.now() - startedAt;
      if (!response.ok) {
        setProbe({
          status: "failed",
          message: `HTTP ${response.status} ${response.statusText} (${elapsed}ms)\n${body}`,
        });
        return;
      }
      setProbe({
        status: "ok",
        message: `接続できました (${elapsed}ms)\n${body}`,
      });
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      const message =
        error instanceof Error && error.name === "AbortError"
          ? `${PROBE_TIMEOUT_MS / 1000}秒以内に応答がありませんでした。端末のネットワークとURLを確認してください。`
          : error instanceof Error
            ? error.message
            : "不明なエラーが発生しました。";
      setProbe({ status: "failed", message: `${message} (${elapsed}ms)` });
    } finally {
      clearTimeout(timeout);
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-6 py-8 gap-6">
          <View>
            <Text className="text-2xl font-bold text-foreground">
              サーバー接続先
            </Text>
            <Text className="text-xs text-muted mt-2 leading-relaxed">
              テスト用に API サーバーの接続先を差し替えます。変更は端末に
              保存され、次回起動以降も有効です。
            </Text>
          </View>

          {/* Back */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="self-start flex-row items-center gap-1"
          >
            <Text className="text-sm text-muted">‹ 戻る</Text>
          </TouchableOpacity>

          {/* Current state */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">
              現在の状態
            </Text>

            <View className="bg-surface rounded-lg p-4 border border-border gap-2">
              <Text className="text-xs text-muted">実際に使用中</Text>
              <Text className="text-sm text-foreground">{appliedUrl}</Text>
              <Text className="text-xs text-muted mt-2">ビルド時の既定値</Text>
              <Text className="text-sm text-muted">{buildTimeUrl}</Text>
              <Text className="text-xs text-muted mt-2">
                {override
                  ? "上書き中（下の入力欄の値を使用）"
                  : "上書きなし（ビルド時の既定値を使用）"}
              </Text>
            </View>
          </View>

          {/* Input */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">
              接続先URL
            </Text>

            <TextInput
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              placeholder="https://xxxx.ngrok.app"
              placeholderTextColor="#999"
              value={input}
              onChangeText={setInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <Text className="text-xs text-muted leading-relaxed">
              http:// または https:// で始まるURLを入力してください。末尾の
              スラッシュは不要です。ngrok の場合は
              https://xxxx.ngrok.app の形になります。
            </Text>

            <View className="gap-2">
              <TouchableOpacity
                onPress={handleApply}
                className="rounded-lg py-3 items-center justify-center bg-primary"
              >
                <Text className="text-white font-semibold text-base">
                  保存して適用
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleReset}
                disabled={!isApplied}
                className={`rounded-lg py-3 items-center justify-center border border-border ${
                  isApplied ? "bg-surface" : "bg-surface/50"
                }`}
              >
                <Text
                  className={`font-semibold text-base ${
                    isApplied ? "text-foreground" : "text-muted"
                  }`}
                >
                  既定値に戻す
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Connection test */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">
              接続テスト
            </Text>

            <TouchableOpacity
              onPress={handleProbe}
              disabled={probe.status === "checking"}
              className="rounded-lg py-3 items-center justify-center border border-border bg-surface"
            >
              {probe.status === "checking" ? (
                <ActivityIndicator color="#666" />
              ) : (
                <Text className="text-foreground font-semibold text-base">
                  /api/health に接続する
                </Text>
              )}
            </TouchableOpacity>

            {probe.status === "ok" && (
              <View className="bg-surface rounded-lg p-4 border border-border">
                <Text className="text-xs text-muted mb-1">結果</Text>
                <Text className="text-sm text-foreground">{probe.message}</Text>
              </View>
            )}

            {probe.status === "failed" && (
              <View className="bg-error/10 rounded-lg p-4 border border-error">
                <Text className="text-xs text-error mb-1">
                  接続できませんでした
                </Text>
                <Text className="text-sm text-error">{probe.message}</Text>
              </View>
            )}
          </View>

          <View className="bg-surface rounded-lg p-4">
            <Text className="text-xs text-muted leading-relaxed">
              ・接続先を切り替えると Socket.IO の接続は切断されます。チャット
              画面を開き直すと再接続されます。{"\n"}
              ・別サーバーの場合、保存済みの JWT が拒否されます。その場合は
              アプリを再起動してログインし直してください。
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
