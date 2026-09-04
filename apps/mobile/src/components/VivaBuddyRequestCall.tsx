import Lucide from '@react-native-vector-icons/lucide'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'
import { PreferredSlot } from '../constants/consultationSlots'
import { useCareManagerBooking } from '../hooks/useCareManagerBooking'
import ConsultationBookingSheet from './consultation/ConsultationBookingSheet'
import BookingConfirmedModal from './consultation/BookingConfirmedModal'

const VivaBuddyRequestCall = () => {
    const { t } = useTranslation();
    const [showBookingSheet, setShowBookingSheet] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    // Credit first, payment when the bucket is empty — shared with the dashboard card.
    const {
        careManagerId,
        credits: careManagerCredits,
        hasCredit: hasCareManagerCredit,
        fee,
        loading,
        book,
    } = useCareManagerBooking(() => setShowConfirmation(true));

    const handleBookingConfirmed = async (date: Date, slot: PreferredSlot) => {
        setShowBookingSheet(false);
        await book(date, slot);
    };

    return (
        <View
            style={{
                backgroundColor: colors.white,
                padding: 20,
                gap: 15,
                justifyContent: "space-between",
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.purple
            }}
        >
            <View
            >
                <Text
                    style={[{
                        fontSize: 16,
                        textAlign: 'center'
                    }, globalStyles.fontSemiBold]}
                >
                    {t('careManager.requestCallTitle')}
                </Text>
                <Text
                    style={[{
                        textAlign: 'center',
                        marginTop: 4,
                        fontSize: 12
                    }, globalStyles.fontLight]}
                >
                    {t('careManager.intro')}
                </Text>
            </View>
            <View
            >
                <TouchableOpacity
                    style={{
                        marginVertical: 0,
                        opacity: loading ? 0.5 : 1, borderRadius: 10,
                        paddingVertical: 13,
                        paddingHorizontal: 5,
                        backgroundColor: colors.darkPurple,
                        flex: 1,
                        justifyContent: 'center'
                    }}
                    disabled={loading}
                    activeOpacity={1}
                    onPress={() => {
                        if (careManagerId) {
                            setShowBookingSheet(true);
                        }
                    }}
                >
                    {
                        loading ? (
                            <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                            <View
                                style={{
                                    alignItems: 'center',
                                    flexDirection: 'row',
                                    gap: 10,
                                    justifyContent: 'center',
                                }}
                            >

                                <Lucide name="phone-incoming" color={colors.white} size={17} />
                                <Text
                                    style={[{
                                        color: colors.white,
                                        fontSize: 14
                                    }, globalStyles.fontSemiBold]}
                                >
                                    {hasCareManagerCredit
                                        ? t('careManager.requestShortWithCredit', { count: careManagerCredits })
                                        : fee
                                            ? t('careManager.requestShortWithFee', { amount: fee })
                                            : t('careManager.requestShort')}
                                </Text>
                            </View>
                        )
                    }
                </TouchableOpacity>
            </View>

            <ConsultationBookingSheet
                visible={showBookingSheet}
                onClose={() => setShowBookingSheet(false)}
                onConfirm={handleBookingConfirmed}
                title={t('careManager.requestCallTitle')}
                credits={careManagerCredits}
                feeAmount={fee}
                confirmLabel={
                    hasCareManagerCredit
                        ? t('careManager.requestWithCredit', { count: careManagerCredits })
                        : fee
                            ? t('careManager.requestWithFee', { amount: fee })
                            : t('careManager.requestCallback')
                }
                submitting={loading}
            />

            <BookingConfirmedModal
                visible={showConfirmation}
                onDismiss={() => setShowConfirmation(false)}
            />
        </View >
    )
}

export default VivaBuddyRequestCall