import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";

export default function ChatActionsScreen() {
  const router = useRouter();
  const { conversationId, senderLabel, messageId } = useLocalSearchParams<{
    conversationId: string;
    senderLabel: string;
    messageId: string;
  }>();
  const { state: authState } = useAuth();
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const blockUserMutation = trpc.dm.blockUser.useMutation();
  const reportMessageMutation = trpc.dm.reportMessage.useMutation();

  const convId = parseInt(conversationId || "0");
  const msgId = parseInt(messageId || "0");

  const handleBlockUser = async () => {
    Alert.alert(
      "ユーザーをブロック",
      `${senderLabel}をブロックしますか？\nブロックされたユーザーはあなたにメッセージを送信できなくなります。`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "ブロック",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              await blockUserMutation.mutateAsync({
                blockedPublicId: senderLabel || "",
              });
              Alert.alert("成功", "ユーザーをブロックしました");
              router.back();
            } catch (error) {
              Alert.alert(
                "エラー",
                error instanceof Error ? error.message : "ブロックに失敗しました"
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReportUser = async () => {
    if (!reportReason.trim()) {
      Alert.alert("エラー", "理由を選択してください");
      return;
    }

    try {
      setIsLoading(true);
      await reportMessageMutation.mutateAsync({
        messageId: msgId,
        reason: reportReason,
      });
      Alert.alert("成功", "ユーザーを通報しました。ご協力ありがとうございます。");
      setShowReportModal(false);
      router.back();
    } catch (error) {
      Alert.alert(
        "エラー",
        error instanceof Error ? error.message : "通報に失敗しました"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const reportReasons = [
    { label: "スパム", value: "spam" },
    { label: "不適切なコンテンツ", value: "inappropriate" },
    { label: "ハラスメント", value: "harassment" },
    { label: "詐欺", value: "fraud" },
    { label: "その他", value: "other" },
  ];

  return (
    <ScreenContainer className="bg-background">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-6 py-8 gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground mb-2">
              {senderLabel}
            </Text>
            <Text className="text-sm text-muted">
              このユーザーに対するアクションを選択してください
            </Text>
          </View>

          {/* Actions */}
          <View className="gap-3">
            {/* Block Button */}
            <TouchableOpacity
              onPress={handleBlockUser}
              disabled={isLoading}
              className="bg-error/10 border border-error rounded-lg p-4 flex-row items-center justify-between"
            >
              <View>
                <Text className="text-base font-semibold text-error">
                  ブロック
                </Text>
                <Text className="text-xs text-error/70 mt-1">
                  このユーザーからのメッセージを受け取りません
                </Text>
              </View>
              <Text className="text-lg text-error">›</Text>
            </TouchableOpacity>

            {/* Report Button */}
            <TouchableOpacity
              onPress={() => setShowReportModal(true)}
              disabled={isLoading}
              className="bg-warning/10 border border-warning rounded-lg p-4 flex-row items-center justify-between"
            >
              <View>
                <Text className="text-base font-semibold text-warning">
                  通報
                </Text>
                <Text className="text-xs text-warning/70 mt-1">
                  不適切な行動を管理者に報告します
                </Text>
              </View>
              <Text className="text-lg text-warning">›</Text>
            </TouchableOpacity>
          </View>

          {/* Info */}
          <View className="bg-primary/10 border border-primary rounded-lg p-4">
            <Text className="text-xs font-semibold text-primary mb-2">
              ℹ️ 注意
            </Text>
            <Text className="text-xs text-primary/80 leading-relaxed">
              • ブロックはいつでも解除できます{"\n"}
              • 通報は匿名で行われます{"\n"}
              • 虚偽の通報は禁止されています
            </Text>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-surface border border-border rounded-lg py-4 items-center justify-center"
          >
            <Text className="text-foreground font-semibold text-base">
              キャンセル
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Report Modal */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6 gap-4">
            <View className="items-center mb-4">
              <View className="w-12 h-1 bg-border rounded-full" />
            </View>

            <Text className="text-2xl font-bold text-foreground">
              理由を選択
            </Text>

            <ScrollView className="gap-2 max-h-96">
              {reportReasons.map((reason) => (
                <TouchableOpacity
                  key={reason.value}
                  onPress={() => setReportReason(reason.value)}
                  className={`rounded-lg p-4 border ${
                    reportReason === reason.value
                      ? "bg-primary/10 border-primary"
                      : "bg-surface border-border"
                  }`}
                >
                  <Text
                    className={`font-semibold ${
                      reportReason === reason.value
                        ? "text-primary"
                        : "text-foreground"
                    }`}
                  >
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowReportModal(false)}
                className="flex-1 bg-surface border border-border rounded-lg py-3 items-center justify-center"
              >
                <Text className="text-foreground font-semibold">キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleReportUser}
                disabled={!reportReason || isLoading}
                className={`flex-1 rounded-lg py-3 items-center justify-center ${
                  !reportReason || isLoading
                    ? "bg-primary/50"
                    : "bg-primary"
                }`}
              >
                <Text className="text-white font-semibold">
                  {isLoading ? "送信中..." : "通報"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
