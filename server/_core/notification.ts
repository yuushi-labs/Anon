import { getDb } from "../db";

/**
 * Notification service for push notifications
 * Currently uses a simple in-memory queue
 * In production, integrate with Firebase Cloud Messaging (FCM)
 */

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// In-memory notification queue
const notificationQueue: Array<{
  userId: number;
  payload: NotificationPayload;
  timestamp: number;
}> = [];

/**
 * Send a notification to a user
 * In production, this should send via FCM
 */
export async function sendNotification(
  userId: number,
  payload: NotificationPayload
): Promise<void> {
  try {
    // Queue the notification
    notificationQueue.push({
      userId,
      payload,
      timestamp: Date.now(),
    });

    console.log(`[notification] Queued notification for user ${userId}:`, payload);

    // In production, integrate with Firebase Cloud Messaging:
    // const admin = require("firebase-admin");
    // const db = await getDb();
    // const user = await db.select().from(appUsers).where(eq(appUsers.id, userId));
    // if (user[0]?.fcmToken) {
    //   await admin.messaging().send({
    //     token: user[0].fcmToken,
    //     notification: {
    //       title: payload.title,
    //       body: payload.body,
    //     },
    //     data: payload.data,
    //   });
    // }
  } catch (error) {
    console.error("[notification] Failed to send notification:", error);
  }
}

/**
 * Send new message notification
 */
export async function sendMessageNotification(
  userId: number,
  senderName: string,
  messagePreview: string,
  conversationId: number
): Promise<void> {
  await sendNotification(userId, {
    title: `New message from ${senderName}`,
    body: messagePreview.substring(0, 100),
    data: {
      conversationId: conversationId.toString(),
      type: "message",
    },
  });
}

/**
 * Get pending notifications for a user
 */
export function getPendingNotifications(userId: number): typeof notificationQueue {
  return notificationQueue.filter((n) => n.userId === userId);
}

/**
 * Clear notifications for a user
 */
export function clearNotifications(userId: number): void {
  const index = notificationQueue.findIndex((n) => n.userId === userId);
  if (index !== -1) {
    notificationQueue.splice(index, 1);
  }
}

/**
 * Notify owner (admin)
 */
export async function notifyOwner(payload: {
  title: string;
  content: string;
}): Promise<boolean> {
  try {
    console.log("[notification] Owner notification:", payload);
    // In production, send to owner via email or push notification
    return true;
  } catch (error) {
    console.error("[notification] Failed to notify owner:", error);
    return false;
  }
}

/**
 * Clean up old notifications (older than 1 hour)
 */
export function cleanupOldNotifications(): void {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const initialLength = notificationQueue.length;

  for (let i = notificationQueue.length - 1; i >= 0; i--) {
    if (notificationQueue[i].timestamp < oneHourAgo) {
      notificationQueue.splice(i, 1);
    }
  }

  if (notificationQueue.length < initialLength) {
    console.log(
      `[notification] Cleaned up ${initialLength - notificationQueue.length} old notifications`
    );
  }
}

// Run cleanup every hour
setInterval(cleanupOldNotifications, 60 * 60 * 1000);
