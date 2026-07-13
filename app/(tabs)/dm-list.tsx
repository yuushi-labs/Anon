import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";

interface Conversation {
  conversationId: number;
  otherUser: {
    id: number;
    username: string;
    iconUrl: string | null;
  } | null;
  isInitiator: boolean;
  anonLabel: string;
  lastMessage: {
    content: string;
    createdAt: Date;
  } | null;
  createdAt: Date;
}

export default function DMListScreen() {
  const router = useRouter();
  const { state: authState } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getConversationsQuery = trpc.dm.getConversations.useQuery(
    { userId: authState.user?.id || 0 },
    { enabled: !!authState.user?.id }
  );

  useEffect(() => {
    if (getConversationsQuery.data) {
      setConversations(getConversationsQuery.data);
      setIsLoading(false);
    }
  }, [getConversationsQuery.data]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await getConversationsQuery.refetch();
    setIsRefreshing(false);
  };

  const handleConversationPress = (conversationId: number) => {
    router.push({
      pathname: "/(tabs)",
      params: { screen: "chat", conversationId },
    });
  };

  const handleStartDM = () => {
    router.push({
      pathname: "/(tabs)",
      params: { screen: "start-dm" },
    });
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      onPress={() => handleConversationPress(item.conversationId)}
      className="flex-row items-center px-4 py-3 border-b border-border active:bg-surface"
    >
      {/* Avatar */}
      <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mr-3">
        {item.isInitiator ? (
          <Text className="text-xs font-bold text-primary">
            {item.anonLabel.substring(0, 2)}
          </Text>
        ) : item.otherUser?.iconUrl ? (
          <Image
            source={{ uri: item.otherUser.iconUrl }}
            className="w-full h-full rounded-full"
          />
        ) : (
          <Text className="text-xs font-bold text-foreground">
            {item.otherUser?.username.substring(0, 2).toUpperCase()}
          </Text>
        )}
      </View>

      {/* Content */}
      <View className="flex-1">
        <Text className="text-base font-semibold text-foreground">
          {item.isInitiator ? item.anonLabel : item.otherUser?.username}
        </Text>
        <Text className="text-sm text-muted mt-1" numberOfLines={1}>
          {item.lastMessage?.content || "メッセージなし"}
        </Text>
      </View>

      {/* Timestamp */}
      <Text className="text-xs text-muted">
        {item.lastMessage
          ? new Date(item.lastMessage.createdAt).toLocaleDateString("ja-JP")
          : ""}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer className="bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
        <Text className="text-2xl font-bold text-foreground">DM</Text>
        <TouchableOpacity
          onPress={handleStartDM}
          className="bg-primary rounded-full w-10 h-10 items-center justify-center"
        >
          <Text className="text-white text-xl font-bold">+</Text>
        </TouchableOpacity>
      </View>

      {/* Conversations List */}
      {conversations.length > 0 ? (
        <FlatList
          data={conversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.conversationId.toString()}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
          scrollEnabled={true}
        />
      ) : (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-lg font-semibold text-foreground mb-2">
            DMがまだありません
          </Text>
          <Text className="text-sm text-muted text-center mb-4">
            右上のボタンからDMを開始できます
          </Text>
          <TouchableOpacity
            onPress={handleStartDM}
            className="bg-primary px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-semibold">DM を開始</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScreenContainer>
  );
}
