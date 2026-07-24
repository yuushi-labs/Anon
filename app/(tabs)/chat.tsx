import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import * as WebSocket from "@/lib/websocket";
import * as CryptoLib from "@/lib/crypto";
import { getApiBaseUrl } from "@/constants/oauth";
import { getSessionToken } from "@/lib/_core/auth";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  senderLabel: string;
  senderIcon: string | null;
  content: string;
  createdAt: Date | string;
  readAt?: Date | string | null;
}

function formatMessageTime(
  createdAt: Date | string | null | undefined,
): string {
  try {
    if (!createdAt) throw new Error("empty date");
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) {
      throw new Error("invalid date");
    }
    return date.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return new Date().toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

export default function ChatScreen() {
  const router = useRouter();
  const colors = useColors();
  const { conversationId, title } = useLocalSearchParams<{ conversationId: string; title?: string }>();
  const { state: authState } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSocketInitialized, setIsSocketInitialized] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);
  const submittedReadMessageIds = useRef(new Set<number>());

  const convId = Number.parseInt(conversationId || "0", 10);
  const getMessagesQuery = trpc.dm.getMessages.useQuery(
    { conversationId: convId },
    { enabled: convId > 0 },
  );

  const markIncomingMessagesAsRead = useCallback(
    (messagesToMark: readonly Message[]) => {
      const currentUser = authState.user;
      if (convId <= 0 || !currentUser) return;

      const unreadIncomingMessageIds = messagesToMark
        .filter(
          (message) =>
            message.senderId !== currentUser.id &&
            !submittedReadMessageIds.current.has(message.id),
        )
        .map((message) => message.id);
      if (unreadIncomingMessageIds.length === 0) return;

      // Only add to submitted list AFTER the server acknowledges receipt.
      // This ensures that if the server rejects (e.g. rate limiting), we can retry later.
      WebSocket.markMessagesAsRead(
        convId,
        unreadIncomingMessageIds,
        (acknowledgedIds) => {
          acknowledgedIds.forEach((messageId) => {
            submittedReadMessageIds.current.add(messageId);
          });
        },
      );
    },
    [authState.user, convId],
  );

  useEffect(() => {
    submittedReadMessageIds.current.clear();
  }, [convId]);

  useEffect(() => {
    if (!getMessagesQuery.data) return;

    // The API returns messages in descending order; show them oldest first.
    setMessages([...(getMessagesQuery.data as Message[])].reverse());
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
  }, [getMessagesQuery.data]);

  useEffect(() => {
    if (!isSocketInitialized) return;
    markIncomingMessagesAsRead(messages);
  }, [isSocketInitialized, markIncomingMessagesAsRead, messages]);

  useEffect(() => {
    const currentUser = authState.user;
    if (convId <= 0 || !currentUser) return;

    let isActive = true;
    const setup = async () => {
      const token = await getSessionToken();
      const apiBase = getApiBaseUrl();
      // If apiBase is empty, it will fall back to relative URL which might not work for WS in native
      const wsUrl = apiBase ? apiBase.replace(/^http/, "ws") : "";

      const handleMessage = (message: Message) => {
        setMessages((previousMessages) => {
          if (
            previousMessages.some(
              (existingMessage) => existingMessage.id === message.id,
            )
          ) {
            return previousMessages;
          }
          return [...previousMessages, message];
        });
        setTimeout(
          () => flatListRef.current?.scrollToEnd({ animated: true }),
          50,
        );
      };

      const handleMessagesRead = (receipt: WebSocket.ReadReceipt) => {
        if (
          receipt.conversationId !== convId ||
          receipt.readerId === currentUser.id
        ) {
          return;
        }

        const readMessageIds = new Set(receipt.messageIds);
        setMessages((previousMessages) =>
          previousMessages.map((message) =>
            message.senderId === currentUser.id &&
            readMessageIds.has(message.id)
              ? { ...message, readAt: receipt.readAt }
              : message,
          ),
        );
      };

      const handleTyping = (user: WebSocket.TypingUser) => {
        console.log("User typing:", user);
      };
      const handleStopTyping = (userId: number) => {
        console.log("User stopped typing:", userId);
      };
      const handleError = (error: string) => {
        console.error("WebSocket error:", error);
      };

      const socket = WebSocket.initializeWebSocket(
        wsUrl,
        token || "",
        currentUser.publicId,
        handleMessage,
        handleMessagesRead,
        handleTyping,
        handleStopTyping,
        handleError,
      );
      
      if (socket) {
        WebSocket.joinConversation(convId);
        if (isActive) {
          setIsSocketInitialized(true);
        }
      } else {
        console.error("[Chat] Failed to initialize WebSocket: socket is null");
      }
    };

    void setup();
    return () => {
      isActive = false;
      setIsSocketInitialized(false);
      WebSocket.leaveConversation(convId);
    };
  }, [authState.user, convId]);

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
        timestamp,
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
          <Text
            className={`text-sm ${isOwn ? "text-white" : "text-foreground"}`}
          >
            {item.content}
          </Text>
          <View className="flex-row items-center justify-end gap-2 mt-1">
            <Text
              className={`text-xs ${isOwn ? "text-white/70" : "text-muted"}`}
            >
              {formatMessageTime(item.createdAt)}
            </Text>
            {isOwn && item.readAt && (
              <Text className="text-xs text-white/70">既読</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer className="bg-background" edges={["top", "left", "right"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <TouchableOpacity 
          onPress={() => router.back()}
          className="mr-3"
        >
          <IconSymbol name="chevron.left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-foreground flex-1" numberOfLines={1}>
          {title || "チャット"}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        className="flex-1"
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingVertical: 8 }}
          scrollEnabled
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        <View className="border-t border-border px-4 py-3 flex-row items-center gap-2 bg-background">
          <TextInput
            className="flex-1 bg-surface border border-border rounded-2xl px-4 py-2 text-foreground min-h-[40px] max-h-[100px]"
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
