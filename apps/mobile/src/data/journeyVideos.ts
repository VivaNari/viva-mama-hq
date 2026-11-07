import { ImageSourcePropType } from 'react-native';

export type JourneyVideoKind = 'mother' | 'baby';

export interface IJourneyVideo {
    /** Streamed from the CDN, so the clips add nothing to the install. */
    uri: string;
    /** The clip's first frame. Bundled, so the card looks right before any download. */
    poster: ImageSourcePropType;
    /** Identifies the clip in analytics. */
    contentId: string;
}

const ASSET_BASE_URL = 'https://assets.vivamama.in/journey';

/**
 * One clip per view, each running through the whole 1000-day journey, so the same clip
 * suits every stage. File names on the host are case-sensitive.
 */
export const JOURNEY_VIDEOS: Record<JourneyVideoKind, IJourneyVideo> = {
    mother: {
        uri: `${ASSET_BASE_URL}/mother-journey.mp4`,
        poster: require('../public/assets/images/journey/mother_journey_poster.jpg'),
        contentId: 'journey_mother',
    },
    baby: {
        uri: `${ASSET_BASE_URL}/baby-journey.mp4`,
        poster: require('../public/assets/images/journey/baby_journey_poster.jpg'),
        contentId: 'journey_baby',
    },
};
