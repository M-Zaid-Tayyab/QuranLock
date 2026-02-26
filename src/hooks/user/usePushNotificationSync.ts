import {
  syncPushToken,
  type NotificationPermissionStatus,
  type PushTokenSyncPayload,
} from "@/services/pushTokenSync";
import { useUserStore } from "@/store/user";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { useShallow } from "zustand/react/shallow";

const getExpoProjectId = () => {
  const fromEas = Constants.easConfig?.projectId;
  const fromExtra = (
    Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
  )?.eas?.projectId;
  return fromEas ?? fromExtra;
};

export const usePushNotificationSync = () => {
  const { appUserId, onboardingComplete } = useUserStore(
    useShallow((s) => ({
      appUserId: s.appUserId,
      onboardingComplete: s.onboardingComplete,
    })),
  );
  const lastSyncedRef = useRef("");

  const sync = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (!appUserId || !onboardingComplete) return;

    let permissions = await Notifications.getPermissionsAsync();
    if (permissions.status === "undetermined") {
      permissions = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
    }
    const notificationPermissionStatus =
      permissions.status as NotificationPermissionStatus;

    let payload: PushTokenSyncPayload | null = null;

    if (notificationPermissionStatus === "granted") {
      const projectId = getExpoProjectId();
      if (projectId) {
        try {
          const tokenResponse = await Notifications.getExpoPushTokenAsync({
            projectId,
          });
          payload = {
            appUserId,
            notificationPermissionStatus,
            expoPushToken: tokenResponse.data,
          };
        } catch {
          // Skip sync on transient token fetch failures to avoid clearing
          // a previously saved token.
          return;
        }
      } else {
        return;
      }
    } else {
      payload = {
        appUserId,
        notificationPermissionStatus,
        clearExpoPushToken: true,
      };
    }

    if (!payload) return;

    const serialized = JSON.stringify(payload);
    if (serialized === lastSyncedRef.current) return;
    const result = await syncPushToken(payload);
    if (!result) return;
    if (result.reason === "user_not_found") return;
    lastSyncedRef.current = serialized;
  }, [appUserId, onboardingComplete]);

  useEffect(() => {
    void sync();
  }, [sync]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void sync();
      }
    });
    return () => subscription.remove();
  }, [sync]);
};
