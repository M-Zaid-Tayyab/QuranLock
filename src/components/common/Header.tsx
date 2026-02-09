import { colors } from "@/constants/colors";
import { MaterialIcons } from "@expo/vector-icons";
import clsx from "clsx";
import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

type HeaderProps = {
  title?: string;
  onBackPress?: () => void;
  rightIcon?: React.ReactNode;
  centerComponent?: React.ReactNode;
  className?: string;
  titleClassName?: string;
};

export const Header = ({
  title,
  onBackPress,
  rightIcon,
  centerComponent,
  className,
  titleClassName,
}: HeaderProps) => {
  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };
  return (
    <View
      className={clsx(
        "flex-row items-center justify-between pb-3 !android:mt-4",
        className,
      )}
    >
      <View className="flex-row items-center">
        <TouchableOpacity
          hitSlop={10}
          activeOpacity={0.8}
          onPress={handleBackPress}
        >
          <MaterialIcons
            name="arrow-back-ios-new"
            size={18}
            color={colors.foreground}
          />
        </TouchableOpacity>
        {title ? (
          <Text
            className={clsx(
              "text-3xl ml-3 text-foreground font-sfPro-bold max-w-[90%]",
              titleClassName,
            )}
          >
            {title}
          </Text>
        ) : centerComponent ? (
          centerComponent
        ) : null}
      </View>
      {rightIcon && rightIcon}
    </View>
  );
};
