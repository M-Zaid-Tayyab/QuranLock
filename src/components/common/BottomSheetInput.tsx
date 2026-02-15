import { colors } from "@/constants/colors";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import clsx from "clsx";
import React, { useState } from "react";
import {
  KeyboardTypeOptions,
  Platform,
  StyleProp,
  Text,
  TextInputProps,
  TextStyle,
  View,
} from "react-native";

type BottomSheetTextInputRef = React.ComponentProps<
  typeof BottomSheetTextInput
>["ref"];

export interface BottomSheetInputProps extends TextInputProps {
  error?: string;
  containerClassName?: string;
  className?: string;
  inputClassName?: string;
  errorClassName?: string;
  leftComponent?: React.ReactNode;
  rightComponent?: React.ReactNode;
  border?: boolean;
  inputRef?: BottomSheetTextInputRef;
  inputStyle?: StyleProp<TextStyle>;
  keyboardType?: KeyboardTypeOptions;
}

export const BottomSheetInput: React.FC<BottomSheetInputProps> = ({
  error,
  containerClassName = "",
  className = "",
  inputClassName = "",
  errorClassName = "",
  leftComponent,
  rightComponent,
  border = false,
  inputRef,
  inputStyle,
  keyboardType,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <View className={` ${containerClassName}`}>
      <View
        className={clsx(
          "flex-row items-center px-4 rounded-lg bg-surface min-h-12",
          error
            ? "border-2 border-error"
            : isFocused
              ? "border-2 border-primary"
              : border
                ? "border-2 border-tertiary-4"
                : "",
          className,
        )}
      >
        {leftComponent && <View className="mr-2">{leftComponent}</View>}

        <BottomSheetTextInput
          className={`
            flex-1
            font-sfPro text-base text-textPrimary
            ${inputClassName}
          `}
          ref={inputRef}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholderTextColor={colors.muted}
          style={[
            Platform.OS === "android"
              ? {
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                }
              : {
                  lineHeight: 0,
                },
            inputStyle,
          ]}
          keyboardType={keyboardType}
          {...props}
        />

        {rightComponent && rightComponent}
      </View>

      {error && (
        <Text className={`mt-1 text-error font-sfPro ${errorClassName}`}>
          {error}
        </Text>
      )}
    </View>
  );
};
