import { io, Socket } from "socket.io-client";

export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  senderLabel: string;
  senderIcon: string | null;
  content: string;
  createdAt: Date;
}

export interface TypingUser {
  userId: number;
  publicId: string;
}

let socket: Socket | null = null;

/**
 * Initialize WebSocket connection
 */
export function initializeWebSocket(
  serverUrl: string,
  token: string,
  publicId: string,
  onMessage: (message: Message) => void,
  onTyping: (user: TypingUser) => void,
  onStopTyping: (userId: number) => void,
  onError: (error: string) => void
): Socket {
  if (socket?.connected) {
    return socket;
  }

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

  socket.on("message", (message: Message) => {
    console.log("[WebSocket] Message received:", message);
    onMessage(message);
  });

  socket.on("user_typing", (user: TypingUser) => {
    console.log("[WebSocket] User typing:", user);
    onTyping(user);
  });

  socket.on("user_stop_typing", (data: { userId: number }) => {
    console.log("[WebSocket] User stopped typing:", data.userId);
    onStopTyping(data.userId);
  });

  socket.on("error", (error: any) => {
    console.error("[WebSocket] Error:", error);
    onError(error.message || "WebSocket error");
  });

  socket.on("disconnect", () => {
    console.log("[WebSocket] Disconnected");
  });

  return socket;
}

/**
 * Get current socket instance
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Join a conversation room
 */
export function joinConversation(conversationId: number): void {
  if (!socket) {
    console.error("[WebSocket] Socket not initialized");
    return;
  }
  socket.emit("join_conversation", conversationId);
}

/**
 * Leave a conversation room
 */
export function leaveConversation(conversationId: number): void {
  if (!socket) {
    console.error("[WebSocket] Socket not initialized");
    return;
  }
  socket.emit("leave_conversation", conversationId);
}

/**
 * Send a message
 */
export async function sendMessage(
  conversationId: number,
  content: string,
  signature: string,
  timestamp: number
): Promise<void> {
  if (!socket) {
    throw new Error("Socket not initialized");
  }

  return new Promise((resolve, reject) => {
    socket!.emit(
      "send_message",
      {
        conversationId,
        content,
        signature,
        timestamp,
      },
      (error?: any) => {
        if (error) {
          reject(new Error(error.message || "Failed to send message"));
        } else {
          resolve();
        }
      }
    );
  });
}

/**
 * Emit typing indicator
 */
export function emitTyping(conversationId: number): void {
  if (!socket) {
    console.error("[WebSocket] Socket not initialized");
    return;
  }
  socket.emit("typing", conversationId);
}

/**
 * Emit stop typing
 */
export function emitStopTyping(conversationId: number): void {
  if (!socket) {
    console.error("[WebSocket] Socket not initialized");
    return;
  }
  socket.emit("stop_typing", conversationId);
}

/**
 * Disconnect WebSocket
 */
export function disconnectWebSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
