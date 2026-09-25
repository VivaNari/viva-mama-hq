import Lucide from '@react-native-vector-icons/lucide';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';

interface ICreditSummaryCardProps {
    credits: number;
    /**
     * Fee to charge when there are no credits left. Omit for care-manager bookings,
     * which have no pay-per-session route — running out means the paywall, not a payment.
     */
    feeAmount?: number;
    /**
     * Whether the balance above can be spent on *this* consultant. False for an
     * off-panel expert, who sets their own fee.
     *
     * Without this the card reads the balance alone and would tell someone holding two
     * credits "2 available · this booking uses 1" on a booking that will in fact charge
     * them — the balance is true but the promise is not. Defaults to true so counsellor
     * callers, which have no notion of a panel, are unaffected.
     */
    creditsApply?: boolean;
}

/**
 * What this booking will cost, before the patient commits to it.
 *
 * Previously the only signal was the button label ("Book with 2 free credits"), which
 * says what you have but not what you are about to spend or what will be left. Someone
 * about to burn their last credit should be able to see that before they tap.
 */
const CreditSummaryCard = ({
    credits,
    feeAmount,
    creditsApply = true,
}: ICreditSummaryCardProps) => {
    const { t } = useTranslation();
    const hasCredits = credits > 0 && creditsApply;

    // A balance that cannot be spent here is not worth naming — showing it would only
    // invite the reader to expect it to be used. This state says what will be charged
    // and why, and leaves the balance out of it.
    if (!creditsApply) {
        return (
            <View style={styles.card}>
                <View style={styles.header}>
                    <Lucide name="wallet" size={18} color={colors.darkPurple} />
                    <Text style={[styles.title, globalStyles.fontSemiBold]}>
                        {t('consultation.credits.title')}
                    </Text>
                </View>

                {feeAmount !== undefined && (
                    <Text style={[styles.headline, globalStyles.fontBold]}>
                        {t('consultation.credits.payPerSession', { amount: feeAmount })}
                    </Text>
                )}
                <Text style={[styles.detail, globalStyles.fontRegular]}>
                    {/* Only reassure about a balance that exists. Someone with no
                        credits — a free user, or Viva Lite — must not be told hers are
                        being kept safe for other experts. */}
                    {credits > 0
                        ? t('consultation.credits.notApplicableHelper')
                        : t('consultation.credits.notApplicableHelperNoCredits')}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Lucide
                    name={hasCredits ? 'ticket' : 'wallet'}
                    size={18}
                    color={colors.darkPurple}
                />
                <Text style={[styles.title, globalStyles.fontSemiBold]}>
                    {t('consultation.credits.title')}
                </Text>
            </View>

            {hasCredits ? (
                <>
                    <Text style={[styles.headline, globalStyles.fontBold]}>
                        {t('consultation.credits.available', { count: credits })}
                    </Text>
                    <Text style={[styles.detail, globalStyles.fontRegular]}>
                        {t('consultation.credits.usage', { remaining: credits - 1 })}
                    </Text>
                </>
            ) : (
                <>
                    {/* Care-manager bookings pass no fee: there is nothing to pay, the
                        paywall handles it, so only the "no credits" line is shown. */}
                    {feeAmount !== undefined && (
                        <Text style={[styles.headline, globalStyles.fontBold]}>
                            {t('consultation.credits.payPerSession', { amount: feeAmount })}
                        </Text>
                    )}
                    <Text style={[styles.detail, globalStyles.fontRegular]}>
                        {t('consultation.credits.payHelper')}
                    </Text>
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.lightPurple,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    title: {
        fontSize: 13,
        color: colors.darkPurple,
    },
    headline: {
        fontSize: 18,
        color: colors.text,
    },
    detail: {
        fontSize: 12,
        color: colors.darkGray,
    },
});

export default CreditSummaryCard;
