import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";

export default function StartDMScreen() {
  const router = useRouter();
  const { state: authState } = useAuth();
  const [targetPublicId, setTargetPublicId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [method, setMethod] = useState<"id" | "link">("id");

  const startConversationMutation = trpc.dm.startConversation.useMutation();

  const handleStartDM = async () => {
    if (!targetPublicId.trim()) {
      Alert.alert("エラー", "IDまたはリンクを入力してください");
      return;
    }

    try {
      setIsLoading(true);
      const result = await startConversationMutation.mutateAsync({
        initiatorId: authState.user?.id || 0,
        recipientPublicId: targetPublicId.trim(),
      });

      // Navigate to chat screen
      router.push({
        pathname: "/(tabs)",
        params: { screen: "chat", conversationId: result.conversationId },
      });
    } catch (error) {
      Alert.alert(
        "エラー",
        error instanceof Error ? error.message : "DM開始に失敗しました"
      );
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
            <Text className="text-3xl font-bold text-foreground mb-2">
              DM を開始
            </Text>
            <Text className="text-base text-muted">
              相手のIDまたはリンクを入力してください
            </Text>
          </View>

          {/* Method Selector */}
          <View className="flex-row gap-3 mb-6">
            <TouchableOpacity
              onPress={() => setMethod("id")}
              className={`flex-1 py-3 rounded-lg items-center justify-center border ${
                method === "id"
                  ? "bg-primary border-primary"
                  : "bg-surface border-border"
              }`}
            >
              <Text
                className={`font-semibold ${
                  method === "id" ? "text-white" : "text-foreground"
                }`}
              >
                ID で検索
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setMethod("link")}
              className={`flex-1 py-3 rounded-lg items-center justify-center border ${
                method === "link"
                  ? "bg-primary border-primary"
                  : "bg-surface border-border"
              }`}
            >
              <Text
                className={`font-semibold ${
                  method === "link" ? "text-white" : "text-foreground"
                }`}
              >
                リンク
              </Text>
            </TouchableOpacity>
          </View>

          {/* Input */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-foreground mb-2">
              {method === "id" ? "ユーザーID" : "リンク"}
            </Text>
            <TextInput
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              placeholder={
                method === "id"
                  ? "例: user123"
                  : "例: https://dm.app/user123"
              }
              placeholderTextColor="#999"
              value={targetPublicId}
              onChangeText={setTargetPublicId}
              editable={!isLoading}
              autoCapitalize="none"
            />
          </View>

          {/* Start Button */}
          <TouchableOpacity
            onPress={handleStartDM}
            disabled={isLoading || !targetPublicId.trim()}
            className={`rounded-lg py-4 items-center justify-center mb-6 ${
              isLoading || !targetPublicId.trim()
                ? "bg-primary/50"
                : "bg-primary"
            }`}
          >
            <Text className="text-white font-semibold text-base">
              {isLoading ? "開始中..." : "DM を開始"}
            </Text>
          </TouchableOpacity>

          {/* Info */}
          <View className="bg-surface rounded-lg p-4">
            <Text className="text-xs font-semibold text-foreground mb-2">
              ℹ️ 匿名性について
            </Text>
            <Text className="text-xs text-muted leading-relaxed">
              • あなたのプロフィール情報は相手に表示されません
              {"\n"}
              • 相手には「匿名1」のように表示されます
              {"\n"}
              • 相手が返信すると会話が始まります
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
