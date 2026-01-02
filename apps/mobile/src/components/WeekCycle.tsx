import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';

// CONFIG
const TOTAL_DAYS = 8;

// Example:
// 0 = last check-in day
// 3 = today
// 7 = next check-in day
const LAST_CHECKIN_INDEX = 0;
const TODAY_INDEX = 3;
const NEXT_CHECKIN_INDEX = 7;

const CheckinDayTimeline = () => {
    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
            >
                {Array.from({ length: TOTAL_DAYS }).map((_, index) => {
                    const isLastCheckin = index === LAST_CHECKIN_INDEX;
                    const isToday = index === TODAY_INDEX;
                    const isNextCheckin = index === NEXT_CHECKIN_INDEX;

                    return (
                        <View key={index} style={styles.dayWrapper}>
                            <Text style={styles.dayLabel}>
                                Day {index + 1}
                            </Text>

                            <View
                                style={[
                                    styles.capsule,
                                    isToday && styles.todayCapsule,
                                    isNextCheckin && styles.nextCapsule,
                                ]}
                            >
                                {(isLastCheckin || isNextCheckin) && (
                                    <View
                                        style={[
                                            styles.dot,
                                            isNextCheckin && styles.nextDot,
                                        ]}
                                    />
                                )}
                            </View>

                            {isLastCheckin && (
                                <Text style={styles.caption}>Last check-in</Text>
                            )}

                            {isToday && (
                                <Text style={styles.caption}>Today</Text>
                            )}

                            {isNextCheckin && (
                                <Text style={styles.caption}>Next check-in</Text>
                            )}
                        </View>
                    );
                })}
            </ScrollView>

            <Text style={styles.bottomText}>
                Next check-in in {NEXT_CHECKIN_INDEX - TODAY_INDEX} days
            </Text>
        </View>
    );
};

export default CheckinDayTimeline;

// ---------------- STYLES ----------------

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginVertical: 25,

    },

    dayWrapper: {
        alignItems: 'center',
        marginHorizontal: 8,
    },

    dayLabel: {
        fontSize: 11,
        color: colors.gray,
        marginBottom: 6,
        ...globalStyles.fontRegular
    },

    capsule: {
        width: 42,
        height: 60,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 10,
        backgroundColor: colors.lightGray,
    },

    todayCapsule: {
        backgroundColor: colors.SubscriptionOptionsBG,
        borderColor: colors.purple,
        borderWidth: 3,
    },

    nextCapsule: {
        borderColor: colors.greenBadgeText,
        borderWidth: 3,
        backgroundColor: colors.greenBadgeBG,
    },

    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.purple,
    },

    nextDot: {
        backgroundColor: colors.greenBadgeText,
    },

    caption: {
        fontSize: 10,
        marginTop: 4,
        color: colors.darkGray,
        ...globalStyles.fontRegular
    },

    bottomText: {
        marginTop: 14,
        fontSize: 13,
        color: colors.purple,
        ...globalStyles.fontBold
    },
});
