import { colors } from "@/constants/colors";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const buildUpdateKey = (update?: Updates.UpdateInfo): string | null => {
  if (!update) return null;
  const createdAt = update.createdAt
    ? new Date(update.createdAt).toISOString()
    : "unknown";
  return `${update.type}:${update.updateId ?? "rollback"}:${createdAt}`;
};

export const UpdateBanner = () => {
  const isCheckingRef = useRef(false);
  const [dismissedUpdateKey, setDismissedUpdateKey] = useState<string | null>(
    null,
  );
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const { isUpdatePending, downloadedUpdate } = Updates.useUpdates();

  const updateKey = useMemo(
    () => buildUpdateKey(downloadedUpdate),
    [downloadedUpdate],
  );

  useEffect(() => {
    if (!updateKey) return;
    if (dismissedUpdateKey && dismissedUpdateKey !== updateKey) {
      setDismissedUpdateKey(null);
    }
  }, [dismissedUpdateKey, updateKey]);

  const checkForUpdate = useCallback(async () => {
    if (Platform.OS === "web" || __DEV__ || !Updates.isEnabled) return;
    if (isCheckingRef.current) return;
    if (isUpdatePending) return;

    try {
      isCheckingRef.current = true;
      const checkResult = await Updates.checkForUpdateAsync();
      if (checkResult.isAvailable) {
        await Updates.fetchUpdateAsync();
      }
    } catch {
    } finally {
      isCheckingRef.current = false;
    }
  }, [isUpdatePending]);

  useEffect(() => {
    checkForUpdate();
  }, []);

  const onReload = useCallback(async () => {
    if (Platform.OS === "web" || __DEV__ || !Updates.isEnabled) return;
    if (!isUpdatePending) return;

    try {
      setIsApplyingUpdate(true);
      await Updates.reloadAsync();
    } catch {
      // No-op: if update fetch/reload fails we leave current app state unchanged.
    } finally {
      setIsApplyingUpdate(false);
    }
  }, [isUpdatePending]);

  const onLater = useCallback(() => {
    if (updateKey) {
      setDismissedUpdateKey(updateKey);
    }
  }, [updateKey]);

  if (!isUpdatePending || !updateKey || dismissedUpdateKey === updateKey) {
    return null;
  }

  const title = isApplyingUpdate ? "Applying update..." : "Update is ready";

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-4 right-4 z-50 pt-safe"
    >
      <View
        className="flex-row items-center justify-between rounded-xl border px-3 py-2"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.outline,
        }}
      >
        <Text className="mr-3 flex-1 text-sm font-sfPro-medium text-foreground">
          {title}
        </Text>

        <View className="flex-row items-center">
          <TouchableOpacity
            activeOpacity={0.8}
            className="rounded-md px-2 py-1"
            onPress={onLater}
            disabled={isApplyingUpdate}
          >
            <Text className="text-sm font-sfPro-semibold text-muted">
              Later
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            className="ml-4 flex-row items-center rounded-md bg-primary px-3 py-1.5"
            onPress={onReload}
            disabled={isApplyingUpdate}
          >
            {isApplyingUpdate ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : null}
            <Text className="ml-1 text-sm font-sfPro-bold text-primaryForeground">
              Reload
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
