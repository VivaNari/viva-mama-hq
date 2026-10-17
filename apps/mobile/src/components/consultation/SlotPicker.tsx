import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
    PREFERRED_SLOT_LABEL_KEYS,
    PREFERRED_SLOT_ORDER,
    PreferredSlot,
    isDateFullyBooked,
    isSlotBookable,
} from '../../constants/consultationSlots';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';

interface ISlotPickerProps {
    /** The consultation date. Slots are disabled relative to this, so it must be set first. */
    date: Date | null;
    selectedSlot: PreferredSlot | null;
    onSelect: (slot: PreferredSlot) => void;
    disabled?: boolean;
}

/**
 * The three preferred windows, as tappable pills.
 *
 * A window is only offered if its start is still far enough out — booking the 3 PM slot
 * at 2:58 PM would leave no time to reach the consultant before it opens. In practice
 * this only greys anything out when the patient has picked today.
 */
const SlotPicker = ({ date, selectedSlot, onSelect, disabled = false }: ISlotPickerProps) => {
    const { t } = useTranslation();

    // Recomputed on every render rather than memoised: the component is cheap, and a
    // stale `now` would keep a slot tappable minutes after it closed.
    const now = new Date();
    const allSlotsGone = isDateFullyBooked(date, now);

    return (
        <View style={styles.container}>
            <Text style={[styles.heading, globalStyles.fontSemiBold]}>
                {t('consultation.slots.title')}
            </Text>

            <View style={styles.pillRow}>
                {PREFERRED_SLOT_ORDER.map((slot) => {
                    const bookable = isSlotBookable(date, slot, now);
                    const isSelected = selectedSlot === slot;
                    const isDisabled = disabled || !date || !bookable;

                    return (
                        <TouchableOpacity
                            key={slot}
                            activeOpacity={0.8}
                            disabled={isDisabled}
                            onPress={() => onSelect(slot)}
                            style={[
                                styles.pill,
                                isSelected && styles.pillSelected,
                                isDisabled && styles.pillDisabled,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.pillText,
                                    isSelected && styles.pillTextSelected,
                                    isDisabled && styles.pillTextDisabled,
                                    globalStyles.fontSemiBold,
                                ]}
                            >
                                {t(PREFERRED_SLOT_LABEL_KEYS[slot])}
                            </Text>
                            {date && !bookable && (
                                <Text style={[styles.pillNote, globalStyles.fontRegular]}>
                                    {t('consultation.slots.unavailableToday')}
                                </Text>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Text style={[styles.helper, globalStyles.fontRegular]}>
                {allSlotsGone
                    ? t('consultation.slots.pickAnotherDate')
                    : t('consultation.slots.helper')}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 10,
    },
    heading: {
        fontSize: 14,
        color: colors.text,
    },
    pillRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    pill: {
        flexGrow: 1,
        flexBasis: '30%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: colors.purple,
        backgroundColor: colors.white,
    },
    pillSelected: {
        backgroundColor: colors.darkPurple,
        borderColor: colors.darkPurple,
    },
    pillDisabled: {
        borderColor: colors.border,
        backgroundColor: colors.lightGray,
    },
    pillText: {
        fontSize: 12,
        textAlign: 'center',
        color: colors.darkPurple,
    },
    pillTextSelected: {
        color: colors.white,
    },
    pillTextDisabled: {
        color: colors.gray,
    },
    pillNote: {
        fontSize: 9,
        marginTop: 2,
        textAlign: 'center',
        color: colors.gray,
    },
    helper: {
        fontSize: 12,
        color: colors.darkGray,
    },
});

export default SlotPicker;
