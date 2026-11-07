import React from 'react';
import { Text, View } from 'react-native';

import { JourneyVideoKind } from '../../data/journeyVideos';
import { globalStyles } from '../../public/styles';
import { journeyStyles as styles } from '../../public/styles/journeyStyles';
import JourneyVideo from './JourneyVideo';

interface JourneyMediaProps {
    video: JourneyVideoKind;
    backgroundColor: string;
    badge?: string;
    badgeColor: string;
    badgeTextColor: string;
}

/** The journey clip at the top of a card, framed at the clip's own 16:9 so nothing is cropped. */
const JourneyMedia: React.FC<JourneyMediaProps> = ({
    video,
    backgroundColor,
    badge,
    badgeColor,
    badgeTextColor,
}) => (
    <View style={[styles.media, { backgroundColor }]}>
        <JourneyVideo kind={video} />
        {badge ? (
            <View style={[styles.badge, { backgroundColor: badgeColor }]} pointerEvents="none">
                <Text style={[styles.badgeText, { color: badgeTextColor }, globalStyles.fontBold]}>{badge}</Text>
            </View>
        ) : null}
    </View>
);

export default JourneyMedia;
