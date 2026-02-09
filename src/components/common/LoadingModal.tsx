import { colors, rgba } from "@/constants/colors";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface Props {
  isVisible: boolean;
  message?: string;
  rotatingMessages?: string[];
  rotationInterval?: number;
}
export const LoadingModal = ({
  isVisible,
  message,
  rotatingMessages,
  rotationInterval = 2000,
}: Props) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    if (!isVisible || !rotatingMessages || rotatingMessages.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentMessageIndex(
        (prevIndex) => (prevIndex + 1) % rotatingMessages.length,
      );
    }, rotationInterval);

    return () => clearInterval(interval);
  }, [isVisible, rotatingMessages, rotationInterval]);

  useEffect(() => {
    if (isVisible) {
      setCurrentMessageIndex(0);
    }
  }, [isVisible]);

  const getDisplayMessage = () => {
    if (rotatingMessages && rotatingMessages.length > 0) {
      return rotatingMessages[currentMessageIndex];
    }
    return message || "Please wait...";
  };

  return (
    <Modal transparent={true} visible={isVisible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.alertContainer}>
          <ActivityIndicator
            size={Platform.OS === "ios" ? "large" : 40}
            color={colors.primary}
          />
          <Text className="font-sfPro text-base text-center text-foreground">
            {getDisplayMessage()}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: rgba(colors.black, 0.5),
  },
  alertContainer: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: "8%",
    width: "50%",
    alignItems: "center",
  },
});
