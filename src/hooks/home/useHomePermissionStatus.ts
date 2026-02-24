import {
  getAuthStatus,
  getStableAuthStatus,
  requestAuthorization,
} from "@/services/deviceActivity";
import * as Notifications from "expo-notifications";
import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";

const AuthorizationStatus = {
  notDetermined: 0,
  denied: 1,
  approved: 2,
} as const;

export const useHomePermissionStatus = () => {
  const [screenTimeStatus, setScreenTimeStatus] = useState<number | null>(null);
  const [notificationGranted, setNotificationGranted] = useState<boolean | null>(
    null,
  );
  const [requestingScreenTime, setRequestingScreenTime] = useState(false);
  const screenTimeRefreshIdRef = useRef(0);

  const refreshScreenTimeStatus = useCallback(async () => {
    if (Platform.OS !== "ios") return;
    const refreshId = ++screenTimeRefreshIdRef.current;
    try {
      const status = getAuthStatus();
      if (status !== AuthorizationStatus.notDetermined) {
        if (refreshId === screenTimeRefreshIdRef.current) {
          setScreenTimeStatus(status);
        }
        return;
      }

      const stableStatus = await getStableAuthStatus();
      if (refreshId !== screenTimeRefreshIdRef.current) return;
      setScreenTimeStatus(stableStatus);
    } catch {
      if (refreshId === screenTimeRefreshIdRef.current) {
        setScreenTimeStatus(AuthorizationStatus.notDetermined);
      }
    }
  }, []);

  const refreshNotificationStatus = useCallback(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setNotificationGranted(status === "granted");
    } catch {
      setNotificationGranted(null);
    }
  }, []);

  const refreshPermissionStatus = useCallback(async () => {
    await Promise.allSettled([
      refreshScreenTimeStatus(),
      refreshNotificationStatus(),
    ]);
  }, [refreshNotificationStatus, refreshScreenTimeStatus]);

  const requestScreenTimePermission = useCallback(() => {
    setRequestingScreenTime(true);
    requestAuthorization()
      .then(() => refreshScreenTimeStatus())
      .finally(() => setRequestingScreenTime(false));
  }, [refreshScreenTimeStatus]);

  const requestNotificationPermission = useCallback(async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotificationGranted(status === "granted");
  }, []);

  const needsScreenTime =
    Platform.OS === "ios" &&
    screenTimeStatus != null &&
    screenTimeStatus !== AuthorizationStatus.approved;
  const needsNotifications = notificationGranted === false;

  return {
    needsScreenTime,
    needsNotifications,
    requestingScreenTime,
    refreshPermissionStatus,
    requestScreenTimePermission,
    requestNotificationPermission,
  };
};
