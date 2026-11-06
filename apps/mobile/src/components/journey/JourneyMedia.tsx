import React from 'react';
import { Image, Text, View } from 'react-native';

import { journeyGif } from '../../data/journeyGifs';
import { globalStyles } from '../../public/styles';
import { journeyStyles as styles } from '../../public/styles/journeyStyles';

interface JourneyMediaProps {
    rowId: string;
    height: number;
    backgroundColor: string;
    badge?: string;
    badgeColor: string;
    badgeTextColor: string;
}

/**
 * The looping GIF at the top of a card. With no GIF for the row, or before an offline first
 * download, the coloured panel stays and the rest of the card reads as normal.
 */
const JourneyMedia: React.FC<JourneyMediaProps> = ({
    rowId,
    height,
    backgroundColor,
    badge,
    badgeColor,
    badgeTextColor,
}) => {
    const gif = journeyGif(rowId);

    return (
        <View style={[styles.media, { height, backgroundColor }]}>
            {gif ? <Image source={gif} style={styles.mediaImage} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
            {badge ? (
                <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                    <Text style={[styles.badgeText, { color: badgeTextColor }, globalStyles.fontBold]}>{badge}</Text>
                </View>
            ) : null}
        </View>
    );
};

export default JourneyMedia;
