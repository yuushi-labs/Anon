import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Share,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

/** テキストをクリップボードにコピーし、共有APIがあれば共有も試みる */
async function shareOrCopy(message: string, link: string) {
  if (Platform.OS !== "web") {
    try {
      await Share.share({ message });
      return;
    } catch {
      // fall through to clipboard
    }
  }
  // Web or fallback: copy to clipboard
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(link);
      Alert.alert("コピーしました", "リンクをクリップボードにコピーしました");
    } else {
      Alert.alert("リンク", link);
    }
  } catch {
    Alert.alert("リンク", link);
  }
}

export default function StartDMScreen() {
  const router = useRouter();
  const [targetPublicId, setTargetPublicId] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
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
        recipientPublicId: targetPublicId.trim(),
      });

      // Generate a shareable link for the conversation
      const link = `${window.location.origin}/(tabs)/chat?conversationId=${result.conversationId}`;
      setGeneratedLink(link);

      // Navigate to chat screen using replace so the user doesn't go back to the start screen
      router.replace({
        pathname: "/(tabs)/chat",
        params: { 
          conversationId: result.conversationId,
          title: result.anonLabel
        },
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

          {/* Show generated link if available */}
          {generatedLink && (
            <View className="mt-4 p-4 bg-surface rounded-lg">
              <Text className="text-sm text-foreground mb-2">共有リンク:</Text>
              <Text className="text-xs text-muted break-all" selectable>{generatedLink}</Text>
              <View className="flex-row gap-2 mt-2">
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        await navigator.clipboard.writeText(generatedLink);
                        Alert.alert("コピーしました", "リンクをコピーしました");
                      } else {
                        Alert.alert("リンク", generatedLink);
                      }
                    } catch {
                      Alert.alert("リンク", generatedLink);
                    }
                  }}
                  className="flex-1 bg-primary/10 rounded-lg py-2 items-center justify-center"
                >
                  <Text className="text-primary font-semibold text-sm">コピー</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    shareOrCopy(
                      `DM を開始するリンクです:\n${generatedLink}`,
                      generatedLink
                    )
                  }
                  className="flex-1 bg-primary rounded-lg py-2 items-center justify-center"
                >
                  <Text className="text-white font-semibold text-sm">共有</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          

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
