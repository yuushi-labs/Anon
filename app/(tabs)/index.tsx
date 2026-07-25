import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";

export default function HomeScreen() {
  const router = useRouter();
  const { state: authState } = useAuth();

  const handleNavigateToDMList = () => {
    router.push("/(tabs)/dm-list");
  };

  const handleNavigateToProfile = () => {
    router.push("/(tabs)/profile");
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-8 px-6 py-8">
          {/* Hero Section */}
          <View className="items-center gap-3 mt-8">
            <Text className="text-5xl font-bold text-foreground">匿名DM</Text>
            <Text className="text-base text-muted text-center">
              安全で匿名のメッセージング
            </Text>
          </View>

          {/* User Info Card */}
          {authState.isSignedIn && authState.user && (
            <View className="bg-surface rounded-2xl p-6 border border-border">
              <Text className="text-sm font-semibold text-muted mb-2">
                ログイン中のユーザー
              </Text>
              <Text className="text-2xl font-bold text-foreground mb-1">
                {authState.user.username}
              </Text>
              <Text className="text-sm text-muted">
                ID: {authState.user.publicId}
              </Text>
            </View>
          )}

          {/* Features */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground mb-2">
              特徴
            </Text>

            <View className="bg-surface rounded-lg p-4 border border-border">
              <Text className="text-sm font-semibold text-foreground mb-1">
                🔐 エンドツーエンド暗号化
              </Text>
              <Text className="text-xs text-muted">
                すべてのメッセージは暗号化されます
              </Text>
            </View>

            <View className="bg-surface rounded-lg p-4 border border-border">
              <Text className="text-sm font-semibold text-foreground mb-1">
                👤 完全な匿名性
              </Text>
              <Text className="text-xs text-muted">
                あなたのプロフィール情報は相手に表示されません
              </Text>
            </View>

            <View className="bg-surface rounded-lg p-4 border border-border">
              <Text className="text-sm font-semibold text-foreground mb-1">
                ⚡ リアルタイム通信
              </Text>
              <Text className="text-xs text-muted">
                WebSocketによる即座のメッセージ配信
              </Text>
            </View>

            <View className="bg-surface rounded-lg p-4 border border-border">
              <Text className="text-sm font-semibold text-foreground mb-1">
                🛡️ ブロック・通報機能
              </Text>
              <Text className="text-xs text-muted">
                不適切なユーザーをブロックまたは通報できます
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="gap-3 mt-4">
            <TouchableOpacity
              onPress={handleNavigateToDMList}
              className="bg-primary rounded-lg py-4 items-center justify-center"
            >
              <Text className="text-white font-semibold text-base">
                DM を確認
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNavigateToProfile}
              className="bg-surface border border-border rounded-lg py-4 items-center justify-center"
            >
              <Text className="text-foreground font-semibold text-base">
                プロフィール
              </Text>
            </TouchableOpacity>
          </View>

          {/* Info Box */}
          <View className="bg-primary/10 border border-primary rounded-lg p-4 mt-4">
            <Text className="text-xs text-primary font-semibold mb-1">
              ℹ️ 使い方
            </Text>
            <Text className="text-xs text-primary/80 leading-relaxed">
              1. 公開IDを他のユーザーに共有{"\n"}
              2. 相手のIDを入力してDMを開始{"\n"}
              3. リアルタイムでメッセージ送受信{"\n"}
              4. 不適切なユーザーはブロック・通報
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
