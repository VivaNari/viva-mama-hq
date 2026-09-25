import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import Lucide from '@react-native-vector-icons/lucide';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';

interface ChatDropdownMenuProps {
    visible: boolean;
    onClose: () => void;
    onOptionSelect: (option: 'Bookmarks' | 'About') => void;
}

const ChatDropdownMenu: React.FC<ChatDropdownMenuProps> = ({
    visible,
    onClose,
    onOptionSelect,
}) => {
    const { t } = useTranslation();
    // Under edge-to-edge (B6) a Modal's window is forced translucent by RN itself —
    // ReactModalHostView returns `field || isEdgeToEdgeFeatureFlagOn` for both
    // translucency props — so this dialog now starts at the physical top of the screen
    // rather than below the status bar. The 60dp offset was measured against the old
    // inset window, so without adding the inset back the menu rides up under the bar.
    const insets = useSafeAreaInsets();
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <View style={[styles.menuContainer, { marginTop: 60 + insets.top }]}>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                onOptionSelect('Bookmarks');
                                onClose();
                            }}
                        >
                            <Lucide name="bookmark" size={20} color={colors.black} />
                            <Text style={[styles.menuText, globalStyles.fontMedium]}>{t('chat.bookmarks')}</Text>
                        </TouchableOpacity>

                        <View style={styles.separator} />

                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                onOptionSelect('About');
                                onClose();
                            }}
                        >
                            <Lucide name="info" size={20} color={colors.black} />
                            <Text style={[styles.menuText, globalStyles.fontMedium]}>{t('chat.about')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
    },
    menuContainer: {
        backgroundColor: colors.white,
        borderRadius: 12,
        paddingVertical: 8,
        marginRight: 20,
        width: 180,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 12,
    },
    menuText: {
        fontSize: 16,
        color: colors.text,
        fontWeight: '500',
    },
    separator: {
        height: 1,
        backgroundColor: colors.lightGray,
        marginHorizontal: 10,
    }
});

export default ChatDropdownMenu;
