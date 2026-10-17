import Lucide from '@react-native-vector-icons/lucide';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PreferredSlot, isSlotBookable } from '../../constants/consultationSlots';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import CustomDatePicker from '../CustomDatePicker';
import GradientButtonWithSlightRadius from '../GradientButtonWithSlightRadius';
import CreditSummaryCard from './CreditSummaryCard';
import SlotPicker from './SlotPicker';

interface IConsultationBookingSheetProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (date: Date, slot: PreferredSlot) => void;
    title: string;
    credits: number;
    /** Fee charged when there are no credits left. Omit to show only the credit state. */
    feeAmount?: number;
    /**
     * Whether `credits` can be spent on this consultant. False for an off-panel expert,
     * who is pay-per-session however many credits the user holds. Defaults to true.
     */
    creditsApply?: boolean;
    /**
     * Label for the confirm button. Supplied by the caller because it has to name the
     * actual outcome — spending a credit, or paying a specific fee — and that wording
     * differs between an expert consultation and a counsellor call.
     */
    confirmLabel: string;
    submitting?: boolean;
}

/**
 * Date + preferred window + cost + confirm, in a bottom sheet.
 *
 * Every booking entry point renders this, so the flow cannot drift between them. It also
 * keeps the host screen uncluttered: the expert profile used to spend half its height on
 * a permanently-visible booking form the user only needs once.
 */
const ConsultationBookingSheet = ({
    visible,
    onClose,
    onConfirm,
    title,
    credits,
    feeAmount,
    creditsApply = true,
    confirmLabel,
    submitting = false,
}: IConsultationBookingSheetProps) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<PreferredSlot | null>(null);

    const reset = () => {
        setSelectedDate(null);
        setSelectedSlot(null);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    // Changing the date can strand a slot that is no longer bookable on the new day —
    // clear it rather than silently submitting a window the patient can't have.
    const handleDateSelected = (date: Date) => {
        setSelectedDate(date);
        if (selectedSlot && !isSlotBookable(date, selectedSlot)) {
            setSelectedSlot(null);
        }
    };

    const canConfirm =
        !submitting &&
        selectedDate !== null &&
        selectedSlot !== null &&
        isSlotBookable(selectedDate, selectedSlot);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
            <View style={styles.backdrop}>
                {/* Bottom-anchored sheet: under enforced edge-to-edge the confirm button
                    lands under the gesture bar without this. 28 is the design padding. */}
                <View style={[styles.sheet, { paddingBottom: 28 + insets.bottom }]}>
                    <View style={styles.headerRow}>
                        <Text style={[styles.title, globalStyles.fontBold]}>{title}</Text>
                        <TouchableOpacity onPress={handleClose} hitSlop={10}>
                            <Lucide name="x" size={22} color={colors.darkGray} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setShowDatePicker(true)}
                        style={styles.dateRow}
                    >
                        <Lucide name="calendar" size={18} color={colors.darkPurple} />
                        <Text style={[styles.dateText, globalStyles.fontSemiBold]}>
                            {selectedDate
                                ? selectedDate.toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                })
                                : t('common.selectDate')}
                        </Text>
                    </TouchableOpacity>

                    <SlotPicker
                        date={selectedDate}
                        selectedSlot={selectedSlot}
                        onSelect={setSelectedSlot}
                        disabled={submitting}
                    />

                    <CreditSummaryCard
                        credits={credits}
                        feeAmount={feeAmount}
                        creditsApply={creditsApply}
                    />

                    <View
                        style={{
                            flexDirection: "row"
                        }}
                    >

                        <GradientButtonWithSlightRadius
                            fullRounded
                            title={submitting ? t('expertDetails.processing') : confirmLabel}
                            disabled={!canConfirm}
                            onPress={() => {
                                if (selectedDate && selectedSlot) {
                                    onConfirm(selectedDate, selectedSlot);
                                    reset();
                                }
                            }}
                        />
                    </View>

                    <CustomDatePicker
                        show={showDatePicker}
                        setShow={setShowDatePicker}
                        selectedDate={selectedDate}
                        onSelect={handleDateSelected}
                        minimumDate={true}
                    />
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: colors.white,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 28,
        gap: 16,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    title: {
        fontSize: 18,
        color: colors.text,
        flexShrink: 1,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1.5,
        borderColor: colors.purple,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    dateText: {
        fontSize: 14,
        color: colors.darkPurple,
    },
});

export default ConsultationBookingSheet;
