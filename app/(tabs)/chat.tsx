import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import * as WebSocket from "@/lib/websocket";
import * as CryptoLib from "@/lib/crypto";

interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  senderLabel: string;
  senderIcon: string | null;
  content: string;
  createdAt: Date;
}

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { state: authState } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const convId = parseInt(conversationId || "0");
  const getMessagesQuery = trpc.dm.getMessages.useQuery(
    { conversationId: convId },
    { enabled: convId > 0 }
  );

  useEffect(() => {
    if (getMessagesQuery.data) {
      setMessages(getMessagesQuery.data as any);
      setIsLoading(false);
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [getMessagesQuery.data]);

  useEffect(() => {
    if (convId > 0 && authState.token) {
      // Initialize WebSocket
      const handleMessage = (msg: Message) => {
        setMessages((prev) => [...prev, msg]);
        flatListRef.current?.scrollToEnd({ animated: true });
      };

      const handleTyping = (user: any) => {
        console.log("User typing:", user);
      };

      const handleStopTyping = (userId: number) => {
        console.log("User stopped typing:", userId);
      };

      const handleError = (error: string) => {
        console.error("WebSocket error:", error);
      };

      WebSocket.initializeWebSocket(
        "http://localhost:3000", // Replace with actual server URL
        authState.token,
        authState.user?.publicId || "",
        handleMessage,
        handleTyping,
        handleStopTyping,
        handleError
      );

      WebSocket.joinConversation(convId);

      return () => {
        WebSocket.leaveConversation(convId);
      };
    }
  }, [convId, authState.token, authState.user?.publicId]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !authState.user) return;

    try {
      setIsSending(true);
      const timestamp = Date.now();
      const privateKey = await CryptoLib.getPrivateKey();

      if (!privateKey) {
        throw new Error("Private key not found");
      }

      const signature = await CryptoLib.createRequestSignature(
        JSON.stringify({ conversationId: convId, content: inputText }),
        timestamp
      );

      await WebSocket.sendMessage(convId, inputText, signature, timestamp);
      setInputText("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.senderId === authState.user?.id;

    return (
      <View
        className={`flex-row px-4 py-2 ${isOwn ? "justify-end" : "justify-start"}`}
      >
        <View
          className={`max-w-xs rounded-lg px-3 py-2 ${
            isOwn ? "bg-primary" : "bg-surface"
          }`}
        >
          {!isOwn && (
            <Text className="text-xs font-semibold text-muted mb-1">
              {item.senderLabel}
            </Text>
          )}
          <Text className={`text-sm ${isOwn ? "text-white" : "text-foreground"}`}>
            {item.content}
          </Text>
          <Text
            className={`text-xs mt-1 ${
              isOwn ? "text-white/70" : "text-muted"
            }`}
          >
            {new Date(item.createdAt).toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer className="bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingVertical: 8 }}
          scrollEnabled={true}
        />

        {/* Input Area */}
        <View className="border-t border-border px-4 py-3 flex-row items-center gap-2">
          <TextInput
            className="flex-1 bg-surface border border-border rounded-full px-4 py-2 text-foreground"
            placeholder="メッセージを入力..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            editable={!isSending}
            multiline
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isSending}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              !inputText.trim() || isSending ? "bg-primary/50" : "bg-primary"
            }`}
          >
            <Text className="text-white text-lg font-bold">→</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
