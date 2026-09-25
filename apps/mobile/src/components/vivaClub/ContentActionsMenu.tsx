import Lucide from '@react-native-vector-icons/lucide';
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
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';

export type TContentAction = 'REPORT' | 'BLOCK' | 'DELETE';

interface IContentActionsMenuProps {
    visible: boolean;
    /** Own content offers Delete; other people's offers Report and Block. */
    isOwn: boolean;
    onClose: () => void;
    onSelect: (action: TContentAction) => void;
}

/**
 * The overflow menu on a post or comment.
 *
 * Follows ChatDropdownMenu's shape (modal, dimmed overlay, separated rows) rather than
 * reusing it: that component hardcodes its two options and has no notion of a
 * destructive row.
 *
 * The options are mutually exclusive by design. Reporting or blocking yourself is
 * meaningless, and deleting someone else's post is refused by the server anyway, so
 * showing both sets would offer actions that cannot succeed.
 */
const ContentActionsMenu = ({
    visible,
    isOwn,
    onClose,
    onSelect,
}: IContentActionsMenuProps) => {
    const { t } = useTranslation();

    const choose = (action: TContentAction) => {
        onClose();
        onSelect(action);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback onPress={() => {}}>
                        <View style={styles.menuContainer}>
                            {isOwn ? (
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => choose('DELETE')}
                                >
                                    <Lucide name="trash-2" size={20} color={colors.error} />
                                    <Text
                                        style={[
                                            styles.menuText,
                                            globalStyles.fontMedium,
                                            { color: colors.error },
                                        ]}
                                    >
                                        {t('vivaClub.actionDelete')}
                                    </Text>
                                </TouchableOpacity>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={styles.menuItem}
                                        onPress={() => choose('REPORT')}
                                    >
                                        <Lucide name="flag" size={20} color={colors.black} />
                                        <Text style={[styles.menuText, globalStyles.fontMedium]}>
                                            {t('vivaClub.actionReport')}
                                        </Text>
                                    </TouchableOpacity>

                                    <View style={styles.separator} />

                                    <TouchableOpacity
                                        style={styles.menuItem}
                                        onPress={() => choose('BLOCK')}
                                    >
                                        <Lucide name="user-x" size={20} color={colors.black} />
                                        <Text style={[styles.menuText, globalStyles.fontMedium]}>
                                            {t('vivaClub.actionBlock')}
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    menuContainer: {
        backgroundColor: colors.white,
        borderRadius: 14,
        paddingVertical: 4,
        width: '100%',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 16,
        paddingHorizontal: 18,
    },
    menuText: { fontSize: 15, color: colors.black },
    separator: { height: 1, backgroundColor: colors.border, marginHorizontal: 14 },
});

export default ContentActionsMenu;
