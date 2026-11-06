import React, { useState } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { recordError } from '../../analytics';
import { JourneyHelpSet } from '../../data/journey/journeyTypes';
import { globalStyles } from '../../public/styles';
import { journeyStyles as styles } from '../../public/styles/journeyStyles';

/**
 * The danger signs for where she is now, and the numbers to call. On every Journey screen.
 * The words are bundled with the app, so it opens with no network, when it matters most.
 */
const WhenToGetHelp: React.FC<{ helpSet: JourneyHelpSet }> = ({ helpSet }) => {
    const { t } = useTranslation();
    const { t: content } = useTranslation('journeyContent');
    const [open, setOpen] = useState(false);

    const signs = content(`help.sets.${helpSet}`, { returnObjects: true });
    const numbers = content('help.numbers', { returnObjects: true });

    const call = (number: string) => {
        Linking.openURL(`tel:${number}`).catch(error => recordError(error, 'WhenToGetHelp.call'));
    };

    return (
        <View>
            <TouchableOpacity
                style={styles.helpLink}
                onPress={() => setOpen(on => !on)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={t(open ? 'journey.help.hide' : 'journey.help.link')}
            >
                <Text style={[styles.helpLinkText, globalStyles.fontSemiBold]}>{t('journey.help.link')}</Text>
            </TouchableOpacity>

            {open ? (
                <View style={styles.helpBox}>
                    <Text style={[styles.helpHeading, globalStyles.fontBold]}>{t('journey.help.heading')}</Text>
                    {(Array.isArray(signs) ? (signs as unknown as string[]) : []).map(sign => (
                        <Text key={sign} style={[styles.helpSign, globalStyles.fontRegular]}>
                            {sign}
                        </Text>
                    ))}
                    <View style={styles.helpNumbers}>
                        {(Array.isArray(numbers) ? (numbers as unknown as { label: string; dial: string[] }[]) : []).map(
                            ({ label, dial }) => (
                                <View key={label} style={styles.helpNumberRow}>
                                    <Text style={[styles.helpNumberLabel, globalStyles.fontRegular]}>{label}</Text>
                                    {dial.map(number => (
                                        <TouchableOpacity
                                            key={number}
                                            style={styles.helpCall}
                                            onPress={() => call(number)}
                                            accessibilityRole="button"
                                            accessibilityLabel={t('journey.help.call', { number })}
                                        >
                                            <Text style={[styles.helpCallText, globalStyles.fontBold]}>{number}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ),
                        )}
                    </View>
                </View>
            ) : null}
        </View>
    );
};

export default WhenToGetHelp;
