import React from "react";
import { useTranslation } from "react-i18next";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../public/assets/colors";
import { globalStyles } from "../../public/styles";
import { useSubscriptionContext } from "../../context/SubscriptionContext";
import { IExpert } from "../../types/expert.types";
import { isInPersonOnlyExpert } from "../../utils/expertRules";

/**
 * One expert in the directory.
 *
 * The credit badge renders only for a user who actually holds credits. For everyone else
 * every expert is pay-per-session, so marking each card would add a row of noise to the
 * one screen that most needs to stay scannable — the distinction is shown exactly when it
 * can change which expert she taps.
 */
const ExpertItem = ({ item, navigation }: { item: IExpert, navigation: { navigate: any } }) => {
    const { t } = useTranslation();
    const { entitlements } = useSubscriptionContext();
    const expertCredits = entitlements?.credits?.expert ?? 0;
    // Absent means an older server; fail closed and call it pay-per-session.
    const creditsApply = item.is_empanelled_expert === true;
    const inPersonOnly = isInPersonOnlyExpert(item);

    return (
        <View
            style={{
                padding: 2,
                width: '50%',
                flexShrink: 1
            }}
        >
            <TouchableOpacity
                activeOpacity={0.85}
                style={{
                    justifyContent: 'flex-start',
                    flex: 1,
                    width: '100%',
                    borderRadius: 6,
                    overflow: 'hidden',
                    boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)',
                }}
                onPress={() => navigation.navigate('ExpertDetails', { expertId: item._id })}
            >
                {/* Expert Photo */}
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: item.photograph }}
                        resizeMode="cover"
                        style={styles.image}
                    />
                    {/* Experience Badge */}
                </View>

                {/* Expert Info */}
                <View style={{ paddingVertical: 0 }}>
                    {/* Name */}
                    <Text style={[styles.name, globalStyles.fontSemiBold]}>
                        {item.name}
                    </Text>
                    <Text style={[styles.speciality, globalStyles.fontSemiBold]}>
                        {item.speciality}
                    </Text>
                </View>
                <View style={styles.badgeRow}>
                    <View style={styles.experienceBadge}>
                        <Text style={[styles.experienceText, globalStyles.fontBold]}>
                            {t('experts.yearsExperience', { years: item.yearsOfExperience })}
                        </Text>
                    </View>

                    {/* An in-person-only doctor is never priced: her badge states how she
                        consults, and it shows regardless of credits because it is the one
                        thing that changes what tapping the card leads to. */}
                    {inPersonOnly ? (
                        <View style={styles.creditBadge}>
                            <Text
                                style={[styles.creditBadgeText, globalStyles.fontBold]}
                                numberOfLines={1}
                            >
                                {t('experts.inPersonOnlyBadge')}
                            </Text>
                        </View>
                    ) : expertCredits > 0 ? (
                        <View style={creditsApply ? styles.creditBadge : styles.feeBadge}>
                            <Text
                                style={[
                                    creditsApply ? styles.creditBadgeText : styles.feeBadgeText,
                                    globalStyles.fontBold,
                                ]}
                                numberOfLines={1}
                            >
                                {creditsApply
                                    ? t('experts.creditsApply')
                                    : t('experts.ownFee')}
                            </Text>
                        </View>
                    ) : null}
                </View>
            </TouchableOpacity>
        </View>
    )
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 8,
        overflow: 'hidden',
        padding: 5,
        backgroundColor: colors.white,
        width: '48%',
        marginBottom: 10,
    },
    imageContainer: {
        position: 'relative',
        width: '100%',
        height: 180,
        borderRadius: 8,
        backgroundColor: '#f5f5f5',
    },
    image: {
        width: '100%',
        height: '100%',

    },
    // Wraps so a two-badge row still fits a half-width card on a narrow screen.
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginLeft: 10,
        marginRight: 10,
        marginTop: 10,
        marginBottom: 10,
    },
    experienceBadge: {
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.darkPurple,
        alignContent: "center",
        backgroundColor: colors.lightPurple,
    },
    experienceText: {
        color: colors.purple,
        fontSize: 12
    },
    // Tone carries the meaning before the words are read: green is "your plan covers
    // this", neutral grey is "this one is on you".
    creditBadge: {
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 20,
        backgroundColor: colors.greenBadgeBG,
        flexShrink: 1,
    },
    creditBadgeText: {
        color: colors.greenBadgeText,
        fontSize: 11,
    },
    feeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 20,
        backgroundColor: colors.lightGray,
        flexShrink: 1,
    },
    feeBadgeText: {
        color: colors.darkGray,
        fontSize: 11,
    },
    name: {
        fontSize: 16,
        color: '#1a1a1a',
        marginTop: 5,
        marginLeft: 10
    },
    specialityBadge: {
        alignSelf: 'center',
        alignContent: "center",
        backgroundColor: colors.lightPurple,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 12,
        marginTop: 10,
    },
    speciality: {
        fontSize: 13,
        marginTop: 0,
        fontWeight: '600',
        color: colors.purple,
        marginLeft: 10,
    },
    qualificationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    qualificationLabel: {
        fontSize: 14,
        marginRight: 6,
    },
    qualification: {
        fontSize: 13,
        color: '#555',
        flex: 1,
        lineHeight: 18,
    },
    bio: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
        marginBottom: 16,
    },
    buttonContainer: {
        marginTop: 4,
    },
});

export default ExpertItem;