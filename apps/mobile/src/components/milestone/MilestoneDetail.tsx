import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { MILESTONE_GIFS } from '../../data/milestoneGifs';
import MilestoneGif from './MilestoneGif';

interface MilestoneDetailProps {
    milestoneKey: string | null;
    /** The band's other milestones, for the "most babies" list below. */
    bandMilestones: string[];
    bandLabelKey: string;
    logged: boolean;
    onToggle: () => void;
    onClose: () => void;
}

/**
 * One milestone, large.
 *
 * The same animation as its card, at the full width of the screen.
 */
const MilestoneDetail: React.FC<MilestoneDetailProps> = ({
    milestoneKey,
    bandMilestones,
    bandLabelKey,
    logged,
    onToggle,
    onClose,
}) => {
    const { t } = useTranslation();
    const { width } = useWindowDimensions();

    // The content's full width (16 padding a side), so on a phone the animation runs edge to
    // edge of the rounded stage rather than sitting in a letterbox inside it.
    const stageWidth = Math.min(width - 32, 520);

    return (
        <Modal
            visible={!!milestoneKey}
            animationType="slide"
            onRequestClose={onClose}
            transparent={false}
        >
            <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.back')}
                        hitSlop={12}
                    >
                        <MaterialDesignIcons
                            name="arrow-left"
                            size={24}
                            color={colors.black}
                        />
                    </TouchableOpacity>

                    <Text style={[styles.headerTitle, globalStyles.fontBold]}>
                        {t('infant.milestone.heading')}
                    </Text>
                </View>

                {milestoneKey && (
                    <ScrollView
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.stage}>
                            <MilestoneGif
                                // A new milestone starts fresh, so the last one's size and
                                // error state do not carry over.
                                key={milestoneKey}
                                source={MILESTONE_GIFS[milestoneKey]}
                                width={stageWidth}
                            />
                        </View>

                        <Text style={[styles.name, globalStyles.fontBold]}>
                            {t(`infant.milestone.items.${milestoneKey}`)}
                        </Text>
                        <Text style={[styles.age, globalStyles.fontRegular]}>
                            {t(bandLabelKey)}
                        </Text>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={onToggle}
                            accessibilityRole="button"
                            accessibilityState={{ selected: logged }}
                            style={[styles.action, logged && styles.actionLogged]}
                        >
                            <Text
                                style={[
                                    styles.actionLabel,
                                    logged && styles.actionLabelLogged,
                                    globalStyles.fontSemiBold,
                                ]}
                            >
                                {logged
                                    ? t('infant.milestone.logged')
                                    : t('infant.milestone.logThis')}
                            </Text>
                            {logged && (
                                <MaterialDesignIcons
                                    name="check"
                                    size={16}
                                    color={colors.success}
                                />
                            )}
                        </TouchableOpacity>

                        <View style={styles.listCard}>
                            <Text style={[styles.listTitle, globalStyles.fontSemiBold]}>
                                {t('infant.milestone.mostBabies')}
                            </Text>

                            {bandMilestones.map((key) => (
                                <View key={key} style={styles.listRow}>
                                    <View style={styles.bullet} />
                                    <Text
                                        style={[styles.listItem, globalStyles.fontRegular]}
                                    >
                                        {t(`infant.milestone.items.${key}`)}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        <Text style={[styles.source, globalStyles.fontRegular]}>
                            {t('infant.milestone.source')}
                        </Text>
                    </ScrollView>
                )}
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.pageBG,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },

    headerTitle: {
        fontSize: 20,
        color: colors.black,
    },

    content: {
        paddingHorizontal: 16,
        paddingBottom: 32,
        gap: 10,
    },

    stage: {
        alignItems: 'center',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: colors.white,
    },

    name: {
        marginTop: 6,
        fontSize: 20,
        color: colors.black,
    },

    age: {
        fontSize: 13,
        color: colors.gray,
    },

    action: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 8,
        paddingVertical: 15,
        borderRadius: 26,
        backgroundColor: colors.lightPurple,
    },

    actionLogged: {
        backgroundColor: '#E8F5E9',
    },

    actionLabel: {
        fontSize: 15,
        color: colors.purple,
    },

    actionLabelLogged: {
        color: colors.success,
    },

    listCard: {
        marginTop: 8,
        padding: 14,
        borderRadius: 14,
        backgroundColor: colors.white,
        gap: 10,
    },

    listTitle: {
        fontSize: 15,
        color: colors.black,
    },

    listRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
    },

    bullet: {
        width: 5,
        height: 5,
        borderRadius: 3,
        marginTop: 7,
        backgroundColor: colors.purple,
    },

    listItem: {
        flex: 1,
        fontSize: 13,
        lineHeight: 19,
        color: colors.black,
    },

    source: {
        marginTop: 10,
        fontSize: 11,
        lineHeight: 16,
        textAlign: 'center',
        color: colors.gray,
    },
});

export default MilestoneDetail;
