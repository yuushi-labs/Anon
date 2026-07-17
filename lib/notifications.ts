import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Initialize notification handlers
 */
export async function initializeNotifications() {
  // Set notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Request permissions on iOS
  if (Platform.OS === "ios") {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("Failed to get push token for push notification!");
      return null;
    }
  }

  // Get FCM token
  if (Device.isDevice && Platform.OS !== "web") {
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ||
        Constants?.easConfig?.projectId;

      if (!projectId) {
        console.warn("Project ID not found in app config");
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      return token.data;
    } catch (error) {
      console.error("Failed to get Expo push token:", error);
      return null;
    }
  } else {
    console.warn("Must use physical device for push notifications");
    return null;
  }
}

/**
 * Subscribe to notification events
 */
export function subscribeToNotifications(
  onNotificationReceived: (notification: Notifications.Notification) => void,
  onNotificationResponse: (response: Notifications.NotificationResponse) => void
) {
  // Listen for notifications when app is in foreground
  const notificationSubscription =
    Notifications.addNotificationReceivedListener(onNotificationReceived);

  // Listen for notification taps
  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener(
      onNotificationResponse
    );

  // Return unsubscribe function
  return () => {
    notificationSubscription.remove();
    responseSubscription.remove();
  };
}

/**
 * Send local notification (for testing)
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: true,
      badge: 1,
    },
    trigger: { seconds: 2 } as any,
  });
}

/**
 * Get notification permissions status
 */
export async function getNotificationPermissions() {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}
