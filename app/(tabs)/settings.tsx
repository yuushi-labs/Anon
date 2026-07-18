import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { useThemeContext } from "@/lib/theme-provider";
import { trpc } from "@/lib/trpc";

const STORAGE_KEY_NOTIFICATIONS = "settings_notifications";
const STORAGE_KEY_READ_RECEIPTS = "settings_read_receipts";

export default function SettingsScreen() {
  const { colorScheme, setColorScheme } = useThemeContext();
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [readReceipts, setReadReceiptsState] = useState(true);
  const readReceiptSettingsQuery = trpc.dm.getReadReceiptSettings.useQuery();
  const updateReadReceiptSettingsMutation =
    trpc.dm.updateReadReceiptSettings.useMutation();

  // AsyncStorage is supported by both Expo Web and native builds.
  useEffect(() => {
    let isMounted = true;

    const loadLocalSettings = async () => {
      try {
        const [storedNotifications, storedReadReceipts] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_NOTIFICATIONS),
          AsyncStorage.getItem(STORAGE_KEY_READ_RECEIPTS),
        ]);
        if (!isMounted) return;

        if (storedNotifications !== null) {
          setNotificationsEnabledState(storedNotifications === "true");
        }
        if (storedReadReceipts !== null) {
          setReadReceiptsState(storedReadReceipts === "true");
        }
      } catch (error) {
        console.error("[Settings] Failed to load local settings:", error);
      }
    };

    void loadLocalSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  // The server is the source of truth because read receipts may be sent from
  // either the Web client or a native client for the same account.
  useEffect(() => {
    const enabled = readReceiptSettingsQuery.data?.readReceiptsEnabled;
    if (typeof enabled !== "boolean") return;

    setReadReceiptsState(enabled);
    AsyncStorage.setItem(STORAGE_KEY_READ_RECEIPTS, String(enabled)).catch(
      (error) => {
        console.error(
          "[Settings] Failed to persist read receipts setting from server:",
          error,
        );
      },
    );
  }, [readReceiptSettingsQuery.data?.readReceiptsEnabled]);

  const handleNotificationsChange = async (val: boolean) => {
    setNotificationsEnabledState(val);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_NOTIFICATIONS, String(val));
    } catch (error) {
      console.error("[Settings] Failed to save notifications setting:", error);
    }
  };

  const handleReadReceiptsChange = async (val: boolean) => {
    const previousValue = readReceipts;
    setReadReceiptsState(val);

    try {
      // Try local storage first
      await AsyncStorage.setItem(STORAGE_KEY_READ_RECEIPTS, String(val));
      // Then sync with server
      await updateReadReceiptSettingsMutation.mutateAsync({
        readReceiptsEnabled: val,
      });
    } catch (error) {
      // Revert UI and local storage on failure
      setReadReceiptsState(previousValue);
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY_READ_RECEIPTS,
          String(previousValue),
        );
      } catch (innerError) {
        console.error("[Settings] Failed to revert local setting:", innerError);
      }

      Alert.alert(
        "設定を保存できませんでした",
        error instanceof Error
          ? error.message
          : "既読表示の設定を保存できませんでした。",
      );
    }
  };

  const handleDarkModeChange = (val: boolean) => {
    setColorScheme(val ? "dark" : "light");
    // Persist to localStorage
    if (typeof window !== "undefined") {
      window.localStorage.setItem("settings_dark_mode", val ? "dark" : "light");
    }
  };

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
      ],
    );
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-6 py-8 gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground">設定</Text>
          </View>

          {/* Notifications */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">通知</Text>

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
                onValueChange={handleNotificationsChange}
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
                onValueChange={handleReadReceiptsChange}
                disabled={updateReadReceiptSettingsMutation.isPending}
              />
            </View>
          </View>

          {/* Display */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">表示</Text>

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
                value={colorScheme === "dark"}
                onValueChange={handleDarkModeChange}
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
                <Text className="text-xs text-muted mt-1">v1.0.0</Text>
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
            <Text className="text-sm font-semibold text-error">危険ゾーン</Text>

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
