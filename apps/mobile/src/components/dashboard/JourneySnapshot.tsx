import Lucide from '@react-native-vector-icons/lucide';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';

/**
 * STATIC DESIGN of the Journey snapshot (PRD section 3), for reviewing the layout only.
 *
 * Everything here is sample copy from the design, shown to every user whatever their
 * real stage is, so this must not reach production as it stands. The strings are
 * deliberately not in i18n yet, and "Tap to know more" and "Why is this important?" do
 * nothing until the real screen is built.
 */

type IconName = React.ComponentProps<typeof Lucide>['name'];

const STAGES = ['Pregnancy', 'Delivery', 'Postpartum & infancy', 'Motherhood & toddler'];
const CURRENT_STAGE = 0;

const UPCOMING: { icon: IconName; title: string; when: string }[] = [
    { icon: 'calendar', title: 'ANC visit at the PHC', when: 'Thursday' },
    { icon: 'clock', title: 'PMSMA checkup, the 9th', when: 'Free' },
    { icon: 'cup-soda', title: 'Take-home ration', when: 'Due' },
];

const CardLink = ({ label, color }: { label: string; color: string }) => (
    <View style={styles.link}>
        <Text style={[styles.linkText, globalStyles.fontBold, { color }]}>{label}</Text>
        <Lucide name="chevron-right" size={12} color={color} />
    </View>
);

const CardHeader = ({
    icon,
    title,
    color,
    background,
}: {
    icon: IconName;
    title: string;
    color: string;
    background: string;
}) => (
    <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: background }]}>
            <Lucide name={icon} size={17} color={color} />
        </View>
        <Text style={[styles.cardTitle, globalStyles.fontBold, { color }]}>{title}</Text>
    </View>
);

const JourneySnapshot = () => {
    return (
        <View style={styles.container}>
            {/* Stage bar */}
            <View style={styles.card}>
                <Text style={[styles.eyebrow, globalStyles.fontMedium]}>You and your baby, 1000 days</Text>
                <View style={styles.stageHeading}>
                    <Text style={[styles.stageName, globalStyles.fontBold]}>{STAGES[CURRENT_STAGE]}</Text>
                    <Text style={[styles.stageWeek, globalStyles.fontMedium]}>Week 24</Text>
                </View>
                <View style={styles.stageTrack}>
                    <View style={styles.stageLine} />
                    {STAGES.map((stage, index) => (
                        <View key={stage} style={styles.stageDotSlot}>
                            <View style={index === CURRENT_STAGE ? styles.stageDotActive : styles.stageDot} />
                        </View>
                    ))}
                </View>
                <View style={styles.stageLabels}>
                    {STAGES.map((stage, index) => (
                        <Text
                            key={stage}
                            style={[
                                styles.stageLabel,
                                index === CURRENT_STAGE
                                    ? [styles.stageLabelActive, globalStyles.fontBold]
                                    : globalStyles.fontMedium,
                            ]}
                        >
                            {stage}
                        </Text>
                    ))}
                </View>
                <Text style={[styles.dayCount, globalStyles.fontMedium]}>Day 168 of 1000</Text>
            </View>

            {/* Your body */}
            <View style={styles.card}>
                <CardHeader
                    icon="user-round"
                    title="Your body this week"
                    color={colors.darkPurple}
                    background={colors.vivaTint}
                />
                <Text style={[styles.body, globalStyles.fontMedium]}>
                    You may feel stronger kicks and a little breathlessness. Both are normal at week 24.
                </Text>
                <CardLink label="Tap to know more" color={colors.darkPurple} />
            </View>

            {/* Your baby */}
            <View style={styles.card}>
                <CardHeader
                    icon="smile"
                    title="Your baby this week"
                    color={colors.journeyTeal}
                    background={colors.journeyTealBG}
                />
                <Text style={[styles.body, globalStyles.fontMedium]}>
                    About the size of a corn cob, and can hear your voice now.
                </Text>
                <CardLink label="Tap to know more" color={colors.journeyTeal} />
            </View>

            {/* What's upcoming */}
            <View style={styles.card}>
                <CardHeader
                    icon="calendar"
                    title="What's upcoming"
                    color={colors.journeyAmber}
                    background={colors.journeyAmberBG}
                />
                {UPCOMING.map((item, index) => (
                    <View key={item.title} style={[styles.upcomingRow, index > 0 && styles.rowDivider]}>
                        <View style={styles.upcomingIcon}>
                            <Lucide name={item.icon} size={14} color={colors.journeyAmber} />
                        </View>
                        <Text style={[styles.upcomingTitle, globalStyles.fontMedium]}>{item.title}</Text>
                        <Text style={[styles.upcomingWhen, globalStyles.fontMedium]}>{item.when}</Text>
                    </View>
                ))}
                <CardLink label="Why is this important?" color={colors.journeyAmber} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginTop: 12, gap: 12 },
    card: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.vivaBorder,
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 15,
        boxShadow: '0 6px 18px -12px rgba(40, 16, 80, 0.25)',
    },
    eyebrow: { fontSize: 10.5, color: colors.vivaMuted, letterSpacing: 0.3 },
    stageHeading: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 8 },
    stageName: { fontSize: 20, color: colors.darkPurple },
    stageWeek: { fontSize: 12, color: colors.vivaMuted },
    stageTrack: { flexDirection: 'row', alignItems: 'center', height: 18, marginTop: 14, marginBottom: 6 },
    stageLine: {
        position: 'absolute',
        left: '12.5%',
        right: '12.5%',
        height: 3,
        borderRadius: 3,
        backgroundColor: colors.vivaStripOff,
    },
    stageDotSlot: { flex: 1, alignItems: 'center' },
    stageDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.journeyStageDot },
    stageDotActive: {
        width: 17,
        height: 17,
        borderRadius: 9,
        backgroundColor: colors.white,
        borderWidth: 3,
        borderColor: colors.darkPurple,
    },
    stageLabels: { flexDirection: 'row' },
    stageLabel: { flex: 1, textAlign: 'center', fontSize: 9.5, color: colors.vivaFaint },
    stageLabelActive: { color: colors.darkPurple },
    dayCount: { fontSize: 11, color: colors.vivaMuted, marginTop: 10 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    cardIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: 13.5 },
    body: { fontSize: 13, lineHeight: 19.5, color: colors.vivaInk },
    link: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9 },
    linkText: { fontSize: 11.5 },
    upcomingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
    rowDivider: { borderTopWidth: 1, borderTopColor: colors.vivaDivider },
    upcomingIcon: {
        width: 26,
        height: 26,
        borderRadius: 8,
        backgroundColor: colors.journeyAmberBG,
        alignItems: 'center',
        justifyContent: 'center',
    },
    upcomingTitle: { flex: 1, fontSize: 12.5, color: colors.vivaInk },
    upcomingWhen: { fontSize: 11, color: colors.vivaMuted },
});

export default JourneySnapshot;
