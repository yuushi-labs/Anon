import { io, Socket } from "socket.io-client";

export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  senderLabel: string;
  senderIcon: string | null;
  content: string;
  createdAt: Date | string;
  readAt?: Date | string | null;
}

export interface ReadReceipt {
  conversationId: number;
  messageIds: number[];
  readerId: number;
  readAt: Date | string;
}

export interface TypingUser {
  userId: number;
  publicId: string;
}

let socket: Socket | null = null;

/**
 * Initialize WebSocket connection.
 */
export function initializeWebSocket(
  serverUrl: string,
  token: string,
  publicId: string,
  onMessage: (message: Message) => void,
  onMessagesRead: (receipt: ReadReceipt) => void,
  onTyping: (user: TypingUser) => void,
  onStopTyping: (userId: number) => void,
  onError: (error: string) => void,
): Socket {
  if (!socket) {
    socket = io(serverUrl, {
      auth: {
        token,
        publicId,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      console.log("[WebSocket] Connected");
    });

    socket.on("disconnect", () => {
      console.log("[WebSocket] Disconnected");
    });
  }

  // Remove existing listeners to avoid duplicate or stale React state setters.
  socket.off("message");
  socket.off("messages_read");
  socket.off("user_typing");
  socket.off("user_stop_typing");
  socket.off("error");

  // Re-attach listeners with the latest callbacks.
  socket.on("message", (message: Message) => {
    console.log("[WebSocket] Message received:", message);
    onMessage(message);
  });

  socket.on("messages_read", (receipt: ReadReceipt) => {
    console.log("[WebSocket] Messages read:", receipt);
    onMessagesRead(receipt);
  });

  socket.on("user_typing", (user: TypingUser) => {
    console.log("[WebSocket] User typing:", user);
    onTyping(user);
  });

  socket.on("user_stop_typing", (data: { userId: number }) => {
    console.log("[WebSocket] User stopped typing:", data.userId);
    onStopTyping(data.userId);
  });

  socket.on("error", (error: { message?: string }) => {
    console.error("[WebSocket] Error:", error);
    onError(error.message || "WebSocket error");
  });

  return socket;
}

/**
 * Get current socket instance.
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Join a conversation room.
 */
export function joinConversation(conversationId: number): void {
  if (!socket) {
    console.error("[WebSocket] Socket not initialized");
    return;
  }

  socket.emit("join_conversation", conversationId);
}

/**
 * Leave a conversation room.
 */
export function leaveConversation(conversationId: number): void {
  if (!socket) {
    console.error("[WebSocket] Socket not initialized");
    return;
  }

  socket.emit("leave_conversation", conversationId);
}

/**
 * Send a message.
 */
export async function sendMessage(
  conversationId: number,
  content: string,
  signature: string,
  timestamp: number,
): Promise<void> {
  if (!socket) {
    throw new Error("Socket not initialized");
  }

  // Socket.IO emit is asynchronous but we don't need to block client UI waiting for it.
  socket.emit("send_message", {
    conversationId,
    content,
    signature,
    timestamp,
  });
}

/**
 * Tell the server that the current user has read messages sent by the other participant.
 * Uses a callback for acknowledgment to ensure reliability.
 */
export function markMessagesAsRead(
  conversationId: number,
  messageIds: readonly number[],
  onAck?: (readMessageIds: number[]) => void,
): boolean {
  if (!socket || !socket.connected) {
    return false;
  }

  const uniqueMessageIds = [...new Set(messageIds)].filter(
    Number.isSafeInteger,
  );
  if (uniqueMessageIds.length === 0) {
    return false;
  }

  // Socket.IO supports acknowledgments. The server will call the last argument if provided.
  socket.emit(
    "mark_messages_read",
    {
      conversationId,
      messageIds: uniqueMessageIds,
    },
    (response: { success: boolean; messageIds?: number[] }) => {
      if (response?.success && response.messageIds && onAck) {
        onAck(response.messageIds);
      }
    },
  );
  return true;
}

/**
 * Emit typing indicator.
 */
export function emitTyping(conversationId: number): void {
  if (!socket) {
    console.error("[WebSocket] Socket not initialized");
    return;
  }

  socket.emit("typing", conversationId);
}

/**
 * Emit stop typing.
 */
export function emitStopTyping(conversationId: number): void {
  if (!socket) {
    console.error("[WebSocket] Socket not initialized");
    return;
  }

  socket.emit("stop_typing", conversationId);
}

/**
 * Disconnect WebSocket.
 */
export function disconnectWebSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
