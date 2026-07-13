import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);

  const handleResetData = () => {
    Alert.alert(
      "データをリセット",
      "すべてのデータを削除しますか？この操作は取り消せません。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "リセット",
          style: "destructive",
          onPress: () => {
            Alert.alert("完了", "データがリセットされました");
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-6 py-8 gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground">
              設定
            </Text>
          </View>

          {/* Notifications */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">
              通知
            </Text>

            <View className="bg-surface rounded-lg p-4 border border-border flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  プッシュ通知
                </Text>
                <Text className="text-xs text-muted mt-1">
                  新しいメッセージの通知を受け取ります
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
              />
            </View>

            <View className="bg-surface rounded-lg p-4 border border-border flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  既読表示
                </Text>
                <Text className="text-xs text-muted mt-1">
                  メッセージを読んだことを相手に通知します
                </Text>
              </View>
              <Switch
                value={readReceipts}
                onValueChange={setReadReceipts}
              />
            </View>
          </View>

          {/* Display */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">
              表示
            </Text>

            <View className="bg-surface rounded-lg p-4 border border-border flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  ダークモード
                </Text>
                <Text className="text-xs text-muted mt-1">
                  ダークテーマを使用します
                </Text>
              </View>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
              />
            </View>
          </View>

          {/* Privacy */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">
              プライバシー
            </Text>

            <TouchableOpacity className="bg-surface rounded-lg p-4 border border-border flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  ブロック一覧
                </Text>
                <Text className="text-xs text-muted mt-1">
                  ブロック中のユーザーを管理します
                </Text>
              </View>
              <Text className="text-lg text-muted">›</Text>
            </TouchableOpacity>

            <TouchableOpacity className="bg-surface rounded-lg p-4 border border-border flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  通報履歴
                </Text>
                <Text className="text-xs text-muted mt-1">
                  通報したユーザーを確認します
                </Text>
              </View>
              <Text className="text-lg text-muted">›</Text>
            </TouchableOpacity>
          </View>

          {/* About */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">
              について
            </Text>

            <TouchableOpacity className="bg-surface rounded-lg p-4 border border-border flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  バージョン
                </Text>
                <Text className="text-xs text-muted mt-1">
                  v1.0.0
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity className="bg-surface rounded-lg p-4 border border-border flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  プライバシーポリシー
                </Text>
              </View>
              <Text className="text-lg text-muted">›</Text>
            </TouchableOpacity>

            <TouchableOpacity className="bg-surface rounded-lg p-4 border border-border flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  利用規約
                </Text>
              </View>
              <Text className="text-lg text-muted">›</Text>
            </TouchableOpacity>
          </View>

          {/* Danger Zone */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-error">
              危険ゾーン
            </Text>

            <TouchableOpacity
              onPress={handleResetData}
              className="bg-error/10 border border-error rounded-lg p-4 items-center justify-center"
            >
              <Text className="text-error font-semibold text-base">
                すべてのデータをリセット
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View className="items-center py-4">
            <Text className="text-xs text-muted">
              © 2026 匿名DM. All rights reserved.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
