import React, { useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, View, useWindowDimensions } from 'react-native';

import { journeyStyles as styles } from '../../public/styles/journeyStyles';

const GAP = 12;
const MAX_CARD_WIDTH = 360;
// The next card shows at the edge, so she can see there is more to swipe to.
const PEEK = 70;

export const useCardWidth = (): number => {
    const { width } = useWindowDimensions();
    return Math.min(width - PEEK, MAX_CARD_WIDTH);
};

/** The swipeable cards of the Mother view, with one dot per card. */
const CardRail: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const cardWidth = useCardWidth();
    const [page, setPage] = useState(0);
    const count = React.Children.count(children);

    const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const next = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + GAP));
        if (next !== page) setPage(next);
    };

    return (
        <View>
            <ScrollView
                horizontal
                style={styles.rail}
                contentContainerStyle={styles.railContent}
                showsHorizontalScrollIndicator={false}
                snapToInterval={cardWidth + GAP}
                decelerationRate="fast"
                onScroll={onScroll}
                scrollEventThrottle={32}
            >
                {children}
            </ScrollView>
            <View style={styles.dots}>
                {Array.from({ length: count }, (_, index) => (
                    <View key={index} style={[styles.dot, index === page && styles.dotOn]} />
                ))}
            </View>
        </View>
    );
};

export default CardRail;
