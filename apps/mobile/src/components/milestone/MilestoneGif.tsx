import React, { useState } from 'react';
import { Image, ImageURISource, StyleSheet, View } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';

import { colors } from '../../public/assets/colors';

interface MilestoneGifProps {
    /** The milestone's hosted GIF (`data/milestoneGifs.ts`). */
    source?: ImageURISource;
    width: number;
}

/**
 * A milestone's animation: a looping GIF, nothing drawn over it.
 *
 * ## Sizing
 *
 * The frame takes the GIF's own proportions once it has loaded, so the whole clip fits
 * exactly — nothing cropped, no bars. Until then it is 16:9 on the lavender background,
 * which is also what shows during the first download.
 *
 * A milestone with no GIF, or one that fails to load, shows a placeholder icon rather than
 * an empty box.
 *
 * Android only animates GIFs because `android/app/build.gradle` pulls in Fresco's
 * `animated-gif`; without it the first frame shows and stays.
 */
const MilestoneGif: React.FC<MilestoneGifProps> = ({ source, width }) => {
    const [aspect, setAspect] = useState<number | null>(null);
    const [failed, setFailed] = useState(false);

    const height = Math.round(aspect ? width / aspect : (width * 9) / 16);

    if (!source || failed) {
        return (
            <View style={[styles.frame, styles.placeholder, { width, height }]}>
                <MaterialDesignIcons name="baby-face-outline" size={32} color={colors.purple} />
            </View>
        );
    }

    return (
        <View style={[styles.frame, { width, height }]}>
            <Image
                source={source}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
                onLoad={(event) => {
                    const { width: w, height: h } = event.nativeEvent.source;
                    if (w > 0 && h > 0) setAspect(w / h);
                }}
                onError={() => setFailed(true)}
                accessibilityIgnoresInvertColors
            />
        </View>
    );
};

const styles = StyleSheet.create({
    frame: {
        overflow: 'hidden',
        backgroundColor: colors.lightPurple,
    },

    placeholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default MilestoneGif;
