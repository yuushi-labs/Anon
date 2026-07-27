import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
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

  const getConversationsQuery = trpc.dm.getConversations.useQuery(
    {},
    { enabled: !!authState.user?.id }
  );

  useEffect(() => {
    if (getConversationsQuery.data) {
      setConversations(getConversationsQuery.data);
    }
  }, [getConversationsQuery.data]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await getConversationsQuery.refetch();
    setIsRefreshing(false);
  };

  const handleConversationPress = (conversation: Conversation) => {
    router.push({
      pathname: "/(tabs)/chat",
      params: { 
        conversationId: conversation.conversationId,
        title: conversation.anonLabel 
      },
    });
  };

  const handleStartDM = () => {
    router.push("/(tabs)/start-dm");
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      onPress={() => handleConversationPress(item)}
      className="flex-row items-center px-4 py-3 border-b border-border active:bg-surface"
    >
      {/* Avatar - always anonymous icon */}
      <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mr-3">
        <Text className="text-xs font-bold text-primary">
          {item.anonLabel.substring(0, 2)}
        </Text>
      </View>

      {/* Content */}
      <View className="flex-1">
        <Text className="text-base font-semibold text-foreground">
          {item.anonLabel}
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
