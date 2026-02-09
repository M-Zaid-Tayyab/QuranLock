import clsx from "clsx";
import React from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from "react-native";

export interface PrimaryButtonProps extends TouchableOpacityProps {
  title: string;
  isLoading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  textClassName?: string;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  isLoading,
  disabled,
  leftIcon,
  rightIcon,
  className = "",
  textClassName = "",
  ...props
}: PrimaryButtonProps) => {
  const isDisabled = disabled || isLoading;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      className={clsx(
        "flex-row items-center justify-center rounded-2xl px-6 py-4",
        "bg-primary",
        {
          "opacity-50": isDisabled,
          "active:opacity-80": !isDisabled,
        },
        className,
      )}
      disabled={isDisabled}
      {...props}
    >
      {isLoading ? (
        <View className="flex-row items-center">
          <ActivityIndicator size="small" color="white" />
          <Text className="ml-2 text-primaryForeground font-sfPro-semibold">
            Loading...
          </Text>
        </View>
      ) : (
        <>
          {leftIcon && <View className="mr-2">{leftIcon}</View>}

          <Text
            className={clsx(
              "text-primaryForeground font-sfPro-bold text-lg",
              textClassName,
            )}
          >
            {title}
          </Text>

          {rightIcon && <View className="ml-2">{rightIcon}</View>}
        </>
      )}
    </TouchableOpacity>
  );
};
