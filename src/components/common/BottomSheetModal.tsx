import { colors } from "@/constants/colors";
import {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
  BottomSheetModal as GorhomBottomSheetModal,
  type BottomSheetModalProps,
} from "@gorhom/bottom-sheet";
import React, { useCallback, useMemo } from "react";
import { widthPercentageToDP } from "react-native-responsive-screen";

type Props = {
  children: React.ReactNode;
  title?: string;
  snapPoints?: (string | number)[];
  enablePanDownToClose?: boolean;
  backdropPressBehavior?: "close" | "collapse" | "none";
  onChange?: BottomSheetModalProps["onChange"];
  showHandle?: boolean;
  sheetRef: React.RefObject<GorhomBottomSheetModal | null>;
  onDismiss?: () => void;
  scrollView?: boolean;
  keyboardBlurBehavior?: "restore" | "none";
  maxDynamicContentSize?: number;
  scrollEnabled?: boolean;
};

export const BottomSheetModal: React.FC<Props> = ({
  children,
  snapPoints,
  enablePanDownToClose = true,
  backdropPressBehavior = "close",
  onChange,
  showHandle,
  sheetRef,
  onDismiss,
  scrollView = false,
  keyboardBlurBehavior = "restore",
  maxDynamicContentSize,
  scrollEnabled,
}) => {
  const memoizedSnapPoints = useMemo(() => snapPoints, [snapPoints]);

  const renderBackdrop = useCallback(
    (backdropProps: any) => (
      <BottomSheetBackdrop
        {...backdropProps}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.7}
        pressBehavior={backdropPressBehavior}
      />
    ),
    [backdropPressBehavior],
  );

  return (
    <GorhomBottomSheetModal
      ref={sheetRef}
      snapPoints={memoizedSnapPoints}
      enablePanDownToClose={enablePanDownToClose}
      onChange={onChange}
      backdropComponent={renderBackdrop}
      onDismiss={onDismiss}
      keyboardBehavior="interactive"
      keyboardBlurBehavior={keyboardBlurBehavior}
      android_keyboardInputMode="adjustResize"
      handleIndicatorStyle={
        showHandle ? { backgroundColor: colors.white } : { opacity: 0 }
      }
      backgroundStyle={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: widthPercentageToDP(8),
        borderTopRightRadius: widthPercentageToDP(8),
      }}
      maxDynamicContentSize={maxDynamicContentSize}
    >
      {scrollView ? (
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          alwaysBounceVertical={false}
          scrollEnabled={scrollEnabled}
          className={"flex-1"}
        >
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView className={"flex-1"}>{children}</BottomSheetView>
      )}
    </GorhomBottomSheetModal>
  );
};
