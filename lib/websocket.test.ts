import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const socketMock = vi.hoisted(() => ({
  connected: true,
  disconnect: vi.fn(),
  emit: vi.fn(),
  off: vi.fn(),
  on: vi.fn(),
}));

const ioMock = vi.hoisted(() => vi.fn(() => socketMock));

vi.mock("socket.io-client", () => ({
  io: ioMock,
}));

import {
  disconnectWebSocket,
  initializeWebSocket,
  markMessagesAsRead,
  type ReadReceipt,
} from "./websocket";

function initializeForTest(onMessagesRead = vi.fn()) {
  return initializeWebSocket(
    "ws://localhost:3000",
    "test-token",
    "test-user",
    vi.fn(),
    onMessagesRead,
    vi.fn(),
    vi.fn(),
    vi.fn(),
  );
}

describe("read receipt WebSocket events", () => {
  beforeEach(() => {
    socketMock.connected = true;
    vi.clearAllMocks();
  });

  afterEach(() => {
    disconnectWebSocket();
  });

  it("forwards a received read receipt to the current chat callback", () => {
    const onMessagesRead = vi.fn();
    initializeForTest(onMessagesRead);

    const listener = socketMock.on.mock.calls.find(
      ([eventName]) => eventName === "messages_read",
    )?.[1] as ((receipt: ReadReceipt) => void) | undefined;
    const receipt: ReadReceipt = {
      conversationId: 12,
      messageIds: [33, 34],
      readerId: 9,
      readAt: "2026-07-18T00:00:00.000Z",
    };

    listener?.(receipt);

    expect(listener).toBeDefined();
    expect(onMessagesRead).toHaveBeenCalledWith(receipt);
  });

  it("sends only unique valid message IDs when marking messages as read", () => {
    initializeForTest();

    const sent = markMessagesAsRead(12, [33, 33, 34, Number.NaN]);

    expect(sent).toBe(true);
    expect(socketMock.emit).toHaveBeenCalledWith(
      "mark_messages_read",
      {
        conversationId: 12,
        messageIds: [33, 34],
      },
      expect.any(Function),
    );
  });

  it("does not send a read receipt before a socket is initialized", () => {
    disconnectWebSocket();

    const sent = markMessagesAsRead(12, [33]);

    expect(sent).toBe(false);
    expect(socketMock.emit).not.toHaveBeenCalledWith(
      "mark_messages_read",
      expect.anything(),
    );
  });
});
