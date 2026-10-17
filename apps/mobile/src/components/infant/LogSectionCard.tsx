import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { globalStyles } from '../../public/styles';
import { infantLogStyles } from '../../public/styles/infantLogStyles';

interface LogSectionCardProps {
    /** Already-translated section name shown in the blue pill. */
    title: string;
    /** Already-translated line under the pill. Omitted sections render none. */
    caption?: string;
    /** Already-translated small print at the foot of the card. */
    footnote?: string;
    /** Rendered to the right of the pill — a count, a total, a status. */
    headerRight?: ReactNode;
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
}

/**
 * A white card titled by the blue pill the design uses on every log section.
 *
 * Takes translated strings rather than keys: several call sites need interpolation
 * (the child's name, a running total), and passing keys would push t() plumbing into
 * this component for no gain.
 */
const LogSectionCard: React.FC<LogSectionCardProps> = ({
    title,
    caption,
    footnote,
    headerRight,
    children,
    style,
}) => (
    <View style={[infantLogStyles.card, style]}>
        <View style={styles.header}>
            <View style={infantLogStyles.pill}>
                <Text style={[infantLogStyles.pillText, globalStyles.fontSemiBold]}>
                    {title}
                </Text>
            </View>

            {headerRight}
        </View>

        {!!caption && (
            <Text style={[infantLogStyles.caption, globalStyles.fontRegular]}>
                {caption}
            </Text>
        )}

        {children}

        {!!footnote && (
            <Text style={[infantLogStyles.footnote, globalStyles.fontRegular]}>
                {footnote}
            </Text>
        )}
    </View>
);

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 14,
    },
});

export default LogSectionCard;
