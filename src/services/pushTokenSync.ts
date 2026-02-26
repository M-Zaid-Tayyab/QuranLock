import { convexClient } from "@/services/convexClient";

export type NotificationPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined";

export interface PushTokenSyncPayload {
  appUserId: string;
  expoPushToken?: string;
  clearExpoPushToken?: boolean;
  notificationPermissionStatus: NotificationPermissionStatus;
}

export interface PushTokenSyncResult {
  updated: boolean;
  appUserId?: string;
  expoPushToken?: string;
  notificationPermissionStatus?: NotificationPermissionStatus;
  reason?: string;
}

export const syncPushToken = async (
  payload: PushTokenSyncPayload,
): Promise<PushTokenSyncResult | null> => {
  if (!convexClient) return null;
  if (!payload.appUserId) return null;

  const client = convexClient as unknown as {
    mutation: (
      name: string,
      args: PushTokenSyncPayload,
    ) => Promise<PushTokenSyncResult>;
  };

  try {
    return await client.mutation("users:upsertPushToken", payload);
  } catch {
    // Silent background sync; ignore failures.
    return null;
  }
};
