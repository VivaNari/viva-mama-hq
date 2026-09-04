import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import GradientButtonWithSlightRadius from './GradientButtonWithSlightRadius';
import { PreferredSlot } from '../constants/consultationSlots';
import { useCareManagerBooking } from '../hooks/useCareManagerBooking';
import ConsultationBookingSheet from './consultation/ConsultationBookingSheet';
import BookingConfirmedModal from './consultation/BookingConfirmedModal';

const CareManagerCard = () => {
    const { t } = useTranslation();

    const [showBookingSheet, setShowBookingSheet] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    // Credit first, payment when the bucket is empty — the branch itself lives in the
    // hook, shared with the chat-side entry point.
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
                marginTop: 15,
            }}
        >
            <View
                style={{
                    backgroundColor: colors.white,
                    padding: 10,
                    borderRadius: 10,
                    overflow: 'hidden',
                    boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)',
                    paddingBottom: 20
                }}
            >
                <View>
                    <View
                        style={{
                            ...StyleSheet.absoluteFillObject,
                            backgroundColor: colors.white,
                        }}
                    />
                    <View
                        style={{
                            paddingTop: 20,
                            alignItems: 'center'
                        }}
                    >
                        <Text
                            style={[{
                                fontSize: 20,
                                textAlign: 'center'

                            }, globalStyles.fontBold]}
                        >
                            {t('careManager.title')}
                        </Text>
                    </View>

                    <View style={{ marginTop: 20 }}>
                        <View

                        >

                            <Text style={[globalStyles.fontRegular, { fontSize: 16, color: colors.darkGray, textAlign: 'center' }]}>
                                {t('careManager.intro')}
                            </Text>
                        </View>
                    </View>

                    <View
                        style={{

                            flexDirection: "row",
                        }}
                    >
                        <GradientButtonWithSlightRadius
                            // Without a credit the next tap opens a payment sheet, so the
                            // button says so rather than letting the price be a surprise.
                            title={
                                hasCareManagerCredit
                                    ? t('careManager.requestWithCredit', { count: careManagerCredits })
                                    : fee
                                        ? t('careManager.requestWithFee', { amount: fee })
                                        : t('careManager.requestCallback')
                            }
                            fullWidth={true}
                            fullRounded={true}
                            style={{
                                marginTop: 20,
                                opacity: loading ? 0.5 : 1
                            }}
                            disabled={loading}
                            onPress={() => {
                                if (careManagerId) {
                                    setShowBookingSheet(true);
                                }
                            }}
                        />
                    </View>
                </View>
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
        </View>
    );
};

export default CareManagerCard;
