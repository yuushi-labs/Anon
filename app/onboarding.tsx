import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

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
      await register(username.trim(), publicId.trim());
      router.replace("/(tabs)");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "登録に失敗しました";
      
      // EAS Build等でAPI Base URLが設定されていない場合のNetwork request failedを検知
      let detailedMessage = errorMessage;
      if (errorMessage.includes("Network request failed") || errorMessage.includes("Failed to fetch")) {
         detailedMessage += "\n\n(デバッグ情報: EXPO_PUBLIC_API_BASE_URLが正しく設定されていない可能性があります。EAS Buildの環境変数設定を確認してください。)";
         console.error("[Onboarding] Network Error detected. Check EXPO_PUBLIC_API_BASE_URL in eas.json or Expo dashboard.");
      }

      Alert.alert("登録エラー", detailedMessage);
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
