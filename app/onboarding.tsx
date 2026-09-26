import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  type AlertButton,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { BUILD_CONFIG } from "@/constants/build-config";
import { getServerUrlOverride, resolveApiBaseUrl } from "@/lib/server-url";
import { captureException } from "@/lib/_core/sentry";

/**
 * 開発者ツールは開発ビルドでは常に、本番ビルドでは build-config.ts の
 * showDebugTools が true のときだけ表示する。
 * 未ログイン時は設定画面へ到達できないため、登録画面にも導線を出す。
 */
const showDebugTools = __DEV__ || BUILD_CONFIG.showDebugTools;

const NETWORK_ERROR_PATTERNS = ["Network request failed", "Failed to fetch"];

function isNetworkError(message: string): boolean {
  return NETWORK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

/** 表示用。接続先が解決できない場合はその旨を表示する。 */
function safeApiBaseUrl(): string {
  try {
    return resolveApiBaseUrl();
  } catch {
    return "(未設定)";
  }
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { register, state } = useAuth();
  const [username, setUsername] = useState("");
  const [publicId, setPublicId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!username.trim() || !publicId.trim()) {
      Alert.alert("エラー", "ユーザー名とIDを入力してください");
      return;
    }

    try {
      setIsLoading(true);
      const apiBaseUrl = resolveApiBaseUrl();
      console.log("[Onboarding] Register attempt", {
        username: username.trim(),
        publicId: publicId.trim(),
        apiBaseUrl,
      });
      await register(username.trim(), publicId.trim());
      router.replace("/(tabs)");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "登録に失敗しました";
      captureException(error, {
        area: "onboarding.register",
        username: username.trim(),
        publicId: publicId.trim(),
      });

      // 接続先に到達できない場合、サーバーURLを修正しない限り登録は成功しない。
      // 設定画面はログイン後のみ到達可能なため、ここから直接編集できるようにする。
      if (isNetworkError(errorMessage)) {
        console.error(
          "[Onboarding] Network error detected. Current base URL:",
          safeApiBaseUrl(),
        );

        const buttons: AlertButton[] = showDebugTools
          ? [
              { text: "キャンセル", style: "cancel" },
              {
                text: "接続先を変更",
                onPress: () => router.push("/dev/server"),
              },
              { text: "再試行", onPress: () => void handleRegister() },
            ]
          : [
              { text: "キャンセル", style: "cancel" },
              { text: "再試行", onPress: () => void handleRegister() },
            ];

        Alert.alert(
          "サーバーに接続できません",
          `${errorMessage}\n\n接続先が正しいか確認してください。\n現在: ${safeApiBaseUrl()}`,
          buttons,
        );
        return;
      }

      Alert.alert("登録エラー", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-center px-6 py-8">
          {/* Header */}
          <View className="mb-8">
            <Text className="text-4xl font-bold text-foreground mb-2">
              匿名DM
            </Text>
            <Text className="text-base text-muted">
              プロフィールを作成してはじめましょう
            </Text>
          </View>

          {/* Form */}
          <View className="gap-4 mb-6">
            {/* Username Input */}
            <View>
              <Text className="text-sm font-semibold text-foreground mb-2">
                ユーザー名
              </Text>
              <TextInput
                className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                placeholder="表示名を入力"
                placeholderTextColor="#999"
                value={username}
                onChangeText={setUsername}
                editable={!isLoading}
                maxLength={50}
              />
            </View>

            {/* Public ID Input */}
            <View>
              <Text className="text-sm font-semibold text-foreground mb-2">
                公開ID
              </Text>
              <TextInput
                className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                placeholder="ユニークなIDを入力"
                placeholderTextColor="#999"
                value={publicId}
                onChangeText={setPublicId}
                editable={!isLoading}
                maxLength={50}
                autoCapitalize="none"
              />
              <Text className="text-xs text-muted mt-1">
                このIDで他のユーザーに見つけられます
              </Text>
            </View>
          </View>

          {/* Error Message */}
          {state.error && (
            <View className="bg-error/10 border border-error rounded-lg px-4 py-3 mb-6">
              <Text className="text-error text-sm">{state.error}</Text>
            </View>
          )}

          {/* Register Button */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={isLoading || !username.trim() || !publicId.trim()}
            className={cn(
              "rounded-lg py-4 items-center justify-center",
              isLoading || !username.trim() || !publicId.trim()
                ? "bg-primary/50"
                : "bg-primary"
            )}
          >
            <Text className="text-white font-semibold text-base">
              {isLoading ? "登録中..." : "登録する"}
            </Text>
          </TouchableOpacity>

          {/* Server connection (developer tool) */}
          {showDebugTools && (
            <TouchableOpacity
              onPress={() => router.push("/dev/server")}
              disabled={isLoading}
              className="mt-6 bg-surface rounded-lg p-4 border border-border flex-row items-center justify-between"
            >
              <View className="flex-1 mr-3">
                <Text className="text-sm font-semibold text-foreground">
                  サーバー接続先
                </Text>
                <Text className="text-xs text-muted mt-1" numberOfLines={1}>
                  {getServerUrlOverride()
                    ? getServerUrlOverride()
                    : `${safeApiBaseUrl()}（既定値）`}
                </Text>
              </View>
              <Text className="text-lg text-muted">›</Text>
            </TouchableOpacity>
          )}

          {/* Info */}
          <View className="mt-8 bg-surface rounded-lg p-4">
            <Text className="text-xs text-muted leading-relaxed">
              • あなたのプロフィール情報は安全に暗号化されます
              {"\n"}
              • 公開IDは他のユーザーに共有できます
              {"\n"}
              • ユーザー名はいつでも変更できます
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
