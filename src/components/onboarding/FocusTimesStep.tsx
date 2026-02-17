import { PRAYER_PRESETS, formatTime } from "@/configs/onboarding";
import { colors } from "@/constants/colors";
import {
  FOCUS_DURATION_STEP,
  FOCUS_LABEL_MAX_LENGTH,
  useFocusTimes,
} from "@/hooks/focus";
import { GOAL_DAYS_MAX, GOAL_DAYS_MIN } from "@/utils/focusPlan";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import DatePicker from "react-native-date-picker";
import { Pressable, Text, TextInput, View } from "react-native";

interface FocusTimesStepProps {
  isEditTimes: boolean;
  scheduleError: string | null;
}

export function FocusTimesStep({
  isEditTimes,
  scheduleError,
}: FocusTimesStepProps) {
  const {
    focusSchedules,
    focusDurationMode,
    goalDaysInput,
    expandedScheduleId,
    pickerDate,
    isTimePickerOpen,
    notificationStatus,
    selectedPrayerIds,
    orderedSchedules,
    summaryMinutesText,
    goalRecommendation,
    setGoalDaysInput,
    onTogglePrayer,
    onRemoveSchedule,
    onOpenTimePicker,
    onOpenNewCustomTime,
    onConfirmTimePicker,
    onCancelTimePicker,
    onToggleExpandedSchedule,
    onChangeMode,
    onStepGoalDays,
    onCommitGoalDays,
    onAdjustDuration,
    onCommitDurationInput,
    onChangeScheduleLabel,
    onCommitScheduleLabel,
  } = useFocusTimes({ isEditTimes });

  return (
    <View className="flex-1">
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        enabled
        bottomOffset={16}
        extraKeyboardSpace={16}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
      >
        <View className="mb-6 rounded-2xl border border-outline bg-surface px-4 py-4">
          <Text className="text-xs font-sfPro-semibold tracking-widest text-muted">
            DURATION MODE
          </Text>
          <View className="mt-3 rounded-xl border border-outline bg-backgroundElevated p-2">
            <View className="flex-row gap-3">
              {(
                [
                  {
                    id: "goal",
                    label: "Goal",
                    icon: "flag-outline",
                  },
                  {
                    id: "manual",
                    label: "Manual",
                    icon: "create-outline",
                  },
                ] as const
              ).map((mode) => {
                const active = focusDurationMode === mode.id;
                return (
                  <Pressable
                    key={mode.id}
                    onPress={() => onChangeMode(mode.id)}
                    className={`flex-1 rounded-lg px-3 py-2.5 ${
                      active ? "bg-primary" : "bg-surface"
                    }`}
                    style={{
                      borderWidth: 1,
                      borderColor: active
                        ? colors.primaryVariant
                        : colors.outline,
                    }}
                  >
                    <View className="flex-row items-center justify-center gap-2">
                      <Ionicons
                        name={mode.icon as any}
                        size={15}
                        color={active ? colors.primaryForeground : colors.muted}
                      />
                      <Text
                        className={`text-center text-sm font-sfPro-semibold ${
                          active ? "text-primaryForeground" : "text-foreground"
                        }`}
                      >
                        {mode.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {focusDurationMode === "goal" && (
            <View className="mt-4 rounded-xl border border-outline bg-backgroundElevated px-3 py-3">
              <Text className="text-xs font-sfPro-semibold tracking-widest text-muted">
                COMPLETE IN DAYS
              </Text>
              <View className="mt-2 flex-row items-center gap-2">
                <Pressable
                  onPress={() => onStepGoalDays(-1)}
                  className="h-10 w-10 items-center justify-center rounded-full border border-outline"
                >
                  <Ionicons name="remove" size={18} color={colors.muted} />
                </Pressable>
                <View className="flex-1 rounded-xl border border-outline bg-surface px-3 py-2">
                  <TextInput
                    value={goalDaysInput}
                    onChangeText={(text) =>
                      setGoalDaysInput(text.replace(/\D/g, ""))
                    }
                    onBlur={onCommitGoalDays}
                    onSubmitEditing={onCommitGoalDays}
                    keyboardType="number-pad"
                    className="text-center font-sfPro-semibold text-foreground"
                    placeholder="30"
                    placeholderTextColor={colors.muted}
                  />
                </View>
                <Pressable
                  onPress={() => onStepGoalDays(1)}
                  className="h-10 w-10 items-center justify-center rounded-full border border-outline"
                >
                  <Ionicons name="add" size={18} color={colors.muted} />
                </Pressable>
              </View>
              <Text className="mt-2 text-xs font-sfPro text-muted">
                Range: {GOAL_DAYS_MIN}-{GOAL_DAYS_MAX} days
              </Text>

              <View className="mt-3 rounded-xl border border-outline bg-surface px-3 py-3">
                <Text className="text-sm font-sfPro text-muted">
                  Sessions/day:{" "}
                  <Text className="font-sfPro-semibold text-foreground">
                    {focusSchedules.length}
                  </Text>
                </Text>
                <Text className="mt-1 text-sm font-sfPro text-muted">
                  Pages/session:{" "}
                  <Text className="font-sfPro-semibold text-foreground">
                    {goalRecommendation.computable
                      ? goalRecommendation.pagesPerSession.toFixed(1)
                      : "—"}
                  </Text>
                </Text>
                <Text className="mt-1 text-sm font-sfPro text-muted">
                  Suggested duration:{" "}
                  <Text className="font-sfPro-semibold text-foreground">
                    {summaryMinutesText}
                  </Text>
                </Text>
              </View>

              {!goalRecommendation.computable ? (
                <Text className="mt-3 text-sm font-sfPro text-warning">
                  Add at least one focus time to generate your plan.
                </Text>
              ) : null}

              {goalRecommendation.capped ? (
                <View className="mt-3 rounded-xl border border-warning/60 bg-warning/10 px-3 py-2">
                  <Text className="text-sm font-sfPro text-warning">
                    Suggested time was capped at 90 minutes/session. Increase
                    days or add more sessions for a more realistic plan.
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        <View className="mb-6">
          <Text className="text-xs font-sfPro-semibold tracking-widest text-muted">
            PRAYER TIMES
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-x-2 gap-y-4">
            {PRAYER_PRESETS.map((preset) => {
              const isSelected = selectedPrayerIds.has(preset.id);
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => onTogglePrayer(preset)}
                  className={`rounded-full border px-4 py-2 ${
                    isSelected
                      ? "border-primary bg-primary/20"
                      : "border-outline bg-surface"
                  }`}
                >
                  <Text
                    className={`font-sfPro-semibold ${
                      isSelected ? "text-foreground" : "text-muted"
                    }`}
                  >
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={onOpenNewCustomTime}
              className="rounded-full border border-dashed border-outline px-4 py-2"
            >
              <Text className="font-sfPro-semibold text-primary">
                + Custom time
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="gap-4">
          {orderedSchedules.length === 0 ? (
            <View className="rounded-2xl border border-dashed border-outline bg-surface px-4 py-6">
              <Text className="text-center font-sfPro text-muted">
                Select a prayer time or add a custom time to continue.
              </Text>
            </View>
          ) : (
            orderedSchedules.map((schedule) => {
              const expanded = expandedScheduleId === schedule.id;
              return (
                <View
                  key={schedule.id}
                  className="rounded-2xl border border-outline bg-surface"
                >
                  <Pressable
                    onPress={() => onToggleExpandedSchedule(schedule.id)}
                    className="flex-row items-center justify-between px-4 py-4"
                  >
                    <View>
                      <Text className="font-sfPro-semibold text-foreground">
                        {schedule.label}
                      </Text>
                      <Text className="mt-1 text-sm font-sfPro text-muted">
                        {formatTime(schedule.hour, schedule.minute)} ·{" "}
                        {schedule.durationMinutes} min
                      </Text>
                    </View>
                    <Ionicons
                      name={expanded ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={colors.muted}
                    />
                  </Pressable>

                  {expanded && (
                    <View className="px-4 pb-4">
                      <View className="mt-1">
                        <Text className="text-xs font-sfPro-semibold tracking-widest text-muted">
                          FOCUS NAME
                        </Text>
                        <View className="mt-2 flex-row items-center rounded-xl border border-outline bg-backgroundElevated px-3 py-2">
                          <Ionicons
                            name="bookmark-outline"
                            size={16}
                            color={colors.primary}
                          />
                          <TextInput
                            value={schedule.label}
                            maxLength={FOCUS_LABEL_MAX_LENGTH}
                            onChangeText={(text) =>
                              onChangeScheduleLabel(schedule.id, text)
                            }
                            onEndEditing={(event) =>
                              onCommitScheduleLabel(
                                schedule,
                                event.nativeEvent.text,
                              )
                            }
                            onSubmitEditing={(event) =>
                              onCommitScheduleLabel(
                                schedule,
                                event.nativeEvent.text,
                              )
                            }
                            className="ml-2 flex-1 py-1.5 font-sfPro text-foreground"
                            placeholder="Focus name"
                            placeholderTextColor={colors.muted}
                          />
                        </View>
                      </View>

                      <Pressable
                        onPress={() => onOpenTimePicker(schedule.id)}
                        className="mt-4 flex-row items-center justify-between rounded-xl border border-outline bg-backgroundElevated px-4 py-3"
                      >
                        <View className="flex-row items-center gap-2">
                          <Ionicons
                            name="time-outline"
                            size={18}
                            color={colors.primary}
                          />
                          <Text className="font-sfPro text-foreground">
                            Time
                          </Text>
                        </View>
                        <Text className="font-sfPro-semibold text-foreground">
                          {formatTime(schedule.hour, schedule.minute)}
                        </Text>
                      </Pressable>

                      <View className="mt-4">
                        <Text className="text-xs font-sfPro-semibold tracking-widest text-muted">
                          FOCUS DURATION
                        </Text>
                        {focusDurationMode === "manual" ? (
                          <View className="mt-3 flex-row items-center gap-2">
                            <Pressable
                              onPress={() =>
                                onAdjustDuration(schedule, -FOCUS_DURATION_STEP)
                              }
                              className="h-10 w-10 items-center justify-center rounded-full border border-outline bg-backgroundElevated"
                            >
                              <Ionicons
                                name="remove"
                                size={18}
                                color={colors.muted}
                              />
                            </Pressable>
                            <View className="flex-1 rounded-xl border border-outline bg-backgroundElevated px-3 py-2">
                              <TextInput
                                key={`${schedule.id}-${schedule.durationMinutes}-${focusDurationMode}`}
                                defaultValue={String(schedule.durationMinutes)}
                                keyboardType="number-pad"
                                onEndEditing={(event) =>
                                  onCommitDurationInput(
                                    schedule.id,
                                    event.nativeEvent.text,
                                  )
                                }
                                onSubmitEditing={(event) =>
                                  onCommitDurationInput(
                                    schedule.id,
                                    event.nativeEvent.text,
                                  )
                                }
                                className="text-center font-sfPro-semibold text-foreground"
                                placeholder="30"
                                placeholderTextColor={colors.muted}
                              />
                            </View>
                            <Pressable
                              onPress={() =>
                                onAdjustDuration(schedule, FOCUS_DURATION_STEP)
                              }
                              className="h-10 w-10 items-center justify-center rounded-full border border-outline bg-backgroundElevated"
                            >
                              <Ionicons
                                name="add"
                                size={18}
                                color={colors.muted}
                              />
                            </Pressable>
                          </View>
                        ) : (
                          <View className="mt-3 rounded-xl border border-outline bg-backgroundElevated px-3 py-3">
                            <Text className="text-center font-sfPro-semibold text-foreground">
                              {schedule.durationMinutes} min
                            </Text>
                          </View>
                        )}
                        <Text className="mt-2 text-xs font-sfPro text-muted">
                          {focusDurationMode === "goal"
                            ? "Duration is managed automatically by your completion goal."
                            : "Set this schedule's minutes manually."}
                        </Text>
                      </View>

                      {schedule.kind === "custom" && (
                        <Pressable
                          onPress={() => onRemoveSchedule(schedule.id)}
                          className="mt-4 self-start"
                        >
                          <Text className="font-sfPro-semibold text-error">
                            Remove custom time
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {scheduleError ? (
          <Text className="mt-4 text-center font-sfPro text-sm text-error">
            {scheduleError}
          </Text>
        ) : null}

        {!isEditTimes && (
          <View className="mt-6 rounded-2xl border border-outline bg-backgroundElevated px-4 py-4">
            <View className="flex-row items-center gap-3">
              <View
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.primary + "22" }}
              >
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View className="flex-1">
                <Text className="font-sfPro-semibold text-foreground">
                  Notifications
                </Text>
                <Text className="mt-1 text-sm font-sfPro text-muted">
                  We will remind you to open QuranLock when the shield appears.
                </Text>
              </View>
            </View>
            {notificationStatus ? (
              <Text className="mt-3 text-sm font-sfPro text-muted">
                Status:{" "}
                <Text className="font-sfPro-semibold text-foreground">
                  {notificationStatus === "granted"
                    ? "Allowed"
                    : notificationStatus === "denied"
                      ? "Denied"
                      : "Not determined"}
                </Text>
              </Text>
            ) : null}
          </View>
        )}
      </KeyboardAwareScrollView>
      <DatePicker
        modal
        mode="time"
        theme="dark"
        open={isTimePickerOpen}
        date={pickerDate}
        title="Select focus time"
        confirmText="Set"
        cancelText="Cancel"
        onConfirm={onConfirmTimePicker}
        onCancel={onCancelTimePicker}
      />
    </View>
  );
}
