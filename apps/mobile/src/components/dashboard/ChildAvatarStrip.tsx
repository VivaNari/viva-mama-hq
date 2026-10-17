import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { IChild } from '../../types/user.types';
import { getChildAgeLabel, getChildInitial } from '../../utils/childAge';

interface ChildAvatarStripProps {
    /** Named childList, not children: this is data, not the JSX children slot. */
    childList: IChild[];
    selectedChildId: string | undefined;
    onSelectChild: (childId: string) => void;
    onAddChild: () => void;
}

/**
 * The row of child avatars above the growth card, plus the "Add" affordance.
 *
 * Horizontally scrollable rather than wrapping: the count is small but unbounded, and a
 * second row would push the growth card below the fold on smaller devices.
 */
const ChildAvatarStrip: React.FC<ChildAvatarStripProps> = ({
    childList,
    selectedChildId,
    onSelectChild,
    onAddChild,
}) => {
    const { t } = useTranslation();

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
        >
            {childList.map((child) => {
                const childId = child._id ?? '';
                const isSelected = childId === selectedChildId;

                return (
                    <TouchableOpacity
                        key={childId}
                        activeOpacity={0.7}
                        onPress={() => onSelectChild(childId)}
                        style={styles.item}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={child.name}
                    >
                        <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                            <Text
                                style={[
                                    styles.initial,
                                    globalStyles.fontBold,
                                    isSelected && styles.initialSelected,
                                ]}
                            >
                                {getChildInitial(child)}
                            </Text>
                        </View>

                        <Text
                            numberOfLines={1}
                            style={[
                                styles.name,
                                globalStyles.fontSemiBold,
                                isSelected && styles.nameSelected,
                            ]}
                        >
                            {child.name}
                        </Text>

                        <Text style={[styles.age, globalStyles.fontRegular]} numberOfLines={1}>
                            {getChildAgeLabel(child.date_of_birth, t)}
                        </Text>
                    </TouchableOpacity>
                );
            })}

            <TouchableOpacity
                activeOpacity={0.7}
                onPress={onAddChild}
                style={styles.item}
                accessibilityRole="button"
                accessibilityLabel={t('infant.emptyCta')}
            >
                <View style={[styles.avatar, styles.addAvatar]}>
                    <Text style={[styles.addGlyph, globalStyles.fontRegular]}>+</Text>
                </View>

                <Text style={[styles.name, styles.addLabel, globalStyles.fontSemiBold]}>
                    {t('infant.add')}
                </Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const AVATAR_SIZE = 62;

const styles = StyleSheet.create({
    strip: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 18,
        paddingVertical: 12,
        paddingHorizontal: 2,
    },

    item: {
        alignItems: 'center',
        width: 72,
    },

    avatar: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        backgroundColor: colors.lightGray,
        justifyContent: 'center',
        alignItems: 'center',
        // Transparent rather than absent, so selecting a child does not resize the circle
        // and shift every avatar beside it.
        borderWidth: 2,
        borderColor: 'transparent',
    },

    avatarSelected: {
        borderColor: colors.darkPurple,
        backgroundColor: colors.lightPurple,
    },

    addAvatar: {
        backgroundColor: colors.white,
        borderStyle: 'dashed',
        borderColor: colors.darkPurple,
    },

    initial: {
        fontSize: 24,
        color: colors.gray,
    },

    initialSelected: {
        color: colors.darkPurple,
    },

    addGlyph: {
        fontSize: 28,
        lineHeight: 32,
        color: colors.darkPurple,
    },

    name: {
        marginTop: 6,
        fontSize: 13,
        color: colors.black,
    },

    nameSelected: {
        color: colors.darkPurple,
    },

    addLabel: {
        color: colors.darkPurple,
    },

    age: {
        fontSize: 11,
        color: colors.gray,
    },
});

export default ChildAvatarStrip;
