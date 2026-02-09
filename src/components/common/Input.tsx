import { colors } from "@/constants/colors";
import clsx from "clsx";
import React, { useState } from "react";
import { Platform, Text, TextInput, TextInputProps, View } from "react-native";

export interface InputProps extends TextInputProps {
  error?: string;
  containerClassName?: string;
  className?: string;
  inputClassName?: string;
  errorClassName?: string;
  leftComponent?: React.ReactNode;
  rightComponent?: React.ReactNode;
  borderColor?: string;
  border?: boolean;
}

export const Input: React.FC<InputProps> = ({
  error,
  containerClassName = "",
  className = "",
  inputClassName = "",
  errorClassName = "",
  leftComponent,
  rightComponent,
  borderColor,
  border = true,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const { onFocus: onFocusProp, onBlur: onBlurProp, ...restProps } = props;
  const handleFocus: TextInputProps["onFocus"] = (e) => {
    setIsFocused(true);
    onFocusProp?.(e);
  };
  const handleBlur: TextInputProps["onBlur"] = (e) => {
    setIsFocused(false);
    onBlurProp?.(e);
  };
  return (
    <View className={` ${containerClassName}`}>
      <View
        className={clsx(
          "flex-row items-center px-4 rounded-xl bg-surface min-h-12",
          error ? "border-2 border-error" : border ? (isFocused ? "border-2 border-primary" : "border-2 border-outline") : "",
          className,
        )}
      >
        {leftComponent && <View className="mr-2">{leftComponent}</View>}

        <TextInput
          className={clsx(
            "flex-1 font-sfPro text-base text-textPrimary",
            inputClassName,
          )}
          placeholderTextColor={colors.muted}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={
            Platform.OS === "android"
              ? {
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                }
              : {
                  lineHeight: 0,
                }
          }
          {...restProps}
        />

        {rightComponent && rightComponent}
      </View>

      {error && (
        <Text className={clsx("mt-1 text-error font-sfPro", errorClassName)}>
          {error}
        </Text>
      )}
    </View>
  );
};
