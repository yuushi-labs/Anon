import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";

export default function ProfileScreen() {
  const router = useRouter();
  const { state: authState, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSharePublicId = async () => {
    if (!authState.user) return;

    try {
      await Share.share({
        message: `匿名DMで私とチャットしましょう！\nID: ${authState.user.publicId}\n\nアプリをダウンロード: https://dm.app`,
        title: "匿名DM",
      });
    } catch (error) {
      console.error("Share failed:", error);
    }
  };

  const handleCopyPublicId = () => {
    if (!authState.user) return;
    // In production, use react-native-clipboard
    Alert.alert("コピーしました", `ID: ${authState.user.publicId}`);
  };

  const handleLogout = async () => {
    Alert.alert("ログアウト", "本当にログアウトしますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "ログアウト",
        style: "destructive",
        onPress: async () => {
          try {
            setIsLoading(true);
            await logout();
            router.replace("/onboarding");
          } catch (error) {
            Alert.alert(
              "エラー",
              error instanceof Error ? error.message : "ログアウトに失敗しました"
            );
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  if (!authState.isSignedIn || !authState.user) {
    return (
      <ScreenContainer className="bg-background">
        <View className="flex-1 items-center justify-center">
          <Text className="text-foreground">ログインしてください</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-6 py-8 gap-6">
          {/* Profile Header */}
          <View className="items-center gap-4">
            <View className="w-20 h-20 rounded-full bg-primary/20 items-center justify-center">
              {authState.user.iconUrl ? (
                <Image
                  source={{ uri: authState.user.iconUrl }}
                  className="w-full h-full rounded-full"
                />
              ) : (
                <Text className="text-3xl font-bold text-primary">
                  {authState.user.username.substring(0, 1).toUpperCase()}
                </Text>
              )}
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-foreground">
                {authState.user.username}
              </Text>
              <Text className="text-sm text-muted mt-1">
                ID: {authState.user.publicId}
              </Text>
            </View>
          </View>

          {/* Public ID Section */}
          <View className="bg-surface rounded-lg p-4 border border-border">
            <Text className="text-sm font-semibold text-foreground mb-3">
              公開ID
            </Text>
            <View className="bg-background rounded-lg p-3 mb-3 border border-border">
              <Text className="text-base font-mono text-foreground">
                {authState.user.publicId}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={handleCopyPublicId}
                className="flex-1 bg-primary/10 rounded-lg py-2 items-center justify-center"
              >
                <Text className="text-primary font-semibold text-sm">
                  コピー
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSharePublicId}
                className="flex-1 bg-primary rounded-lg py-2 items-center justify-center"
              >
                <Text className="text-white font-semibold text-sm">
                  共有
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Account Info */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">
              アカウント情報
            </Text>

            <View className="bg-surface rounded-lg p-4 border border-border">
              <Text className="text-xs text-muted mb-1">ユーザー名</Text>
              <Text className="text-base font-semibold text-foreground">
                {authState.user.username}
              </Text>
            </View>

            <View className="bg-surface rounded-lg p-4 border border-border">
              <Text className="text-xs text-muted mb-1">ユーザーID</Text>
              <Text className="text-base font-semibold text-foreground">
                {authState.user.id}
              </Text>
            </View>
          </View>

          {/* Security Info */}
          <View className="bg-primary/10 border border-primary rounded-lg p-4">
            <Text className="text-xs font-semibold text-primary mb-2">
              🔐 セキュリティ
            </Text>
            <Text className="text-xs text-primary/80 leading-relaxed">
              • あなたの秘密鍵はデバイスに安全に保存されています{"\n"}
              • サーバーには公開鍵のみが保存されます{"\n"}
              • すべてのメッセージは暗号化されます
            </Text>
          </View>

          {/* Settings */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">
              その他
            </Text>

            <TouchableOpacity className="bg-surface rounded-lg p-4 border border-border flex-row items-center justify-between">
              <Text className="text-base text-foreground font-semibold">
                ブロック一覧
              </Text>
              <Text className="text-lg text-muted">›</Text>
            </TouchableOpacity>

            <TouchableOpacity className="bg-surface rounded-lg p-4 border border-border flex-row items-center justify-between">
              <Text className="text-base text-foreground font-semibold">
                プライバシーポリシー
              </Text>
              <Text className="text-lg text-muted">›</Text>
            </TouchableOpacity>

            <TouchableOpacity className="bg-surface rounded-lg p-4 border border-border flex-row items-center justify-between">
              <Text className="text-base text-foreground font-semibold">
                利用規約
              </Text>
              <Text className="text-lg text-muted">›</Text>
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            onPress={handleLogout}
            disabled={isLoading}
            className="bg-error/10 border border-error rounded-lg py-4 items-center justify-center"
          >
            <Text className="text-error font-semibold text-base">
              {isLoading ? "ログアウト中..." : "ログアウト"}
            </Text>
          </TouchableOpacity>

          {/* Footer */}
          <View className="items-center py-4">
            <Text className="text-xs text-muted">
              匿名DM v1.0.0
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
