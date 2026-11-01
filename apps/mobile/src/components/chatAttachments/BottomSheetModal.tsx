import React from 'react';
import { Modal, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../public/assets/colors';

interface IBottomSheetModalProps {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    accessibilityLabel?: string;
}

/**
 * A bottom-anchored modal sheet with a dimmed backdrop and a grab handle.
 *
 * A plain RN Modal rather than AppBottomSheet: that provider has fixed 50%/75% snap
 * points, and these sheets should be exactly as tall as their content.
 */
const BottomSheetModal = ({ visible, onClose, children, accessibilityLabel }: IBottomSheetModalProps) => {
    const insets = useSafeAreaInsets();
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
            navigationBarTranslucent
        >
            <TouchableWithoutFeedback onPress={onClose} accessibilityLabel="Close">
                <View style={styles.backdrop} />
            </TouchableWithoutFeedback>
            <View
                style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
                accessibilityViewIsModal
                accessibilityLabel={accessibilityLabel}
            >
                <View style={styles.handle} />
                {children}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.white,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        marginBottom: 12,
    },
});

export default BottomSheetModal;
