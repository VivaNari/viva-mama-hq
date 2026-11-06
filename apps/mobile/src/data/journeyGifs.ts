import { ImageURISource } from 'react-native';

/**
 * Journey card animations, keyed by content row id, served from assets.vivamama.in.
 *
 * Hosted rather than bundled, for the same reason as `milestoneGifs.ts`: they download on
 * first view and are then served from the image cache, so they add nothing to the install.
 *
 * Empty until the clips are uploaded. A row missing from this list shows the card's plain
 * colour panel. To add one, upload `<row id>.gif` and add the id below.
 */
const ASSET_BASE_URL = 'https://assets.vivamama.in/journey';

const HOSTED: string[] = [];

const JOURNEY_GIFS: Record<string, ImageURISource> = Object.fromEntries(
    HOSTED.map(id => [id, { uri: `${ASSET_BASE_URL}/${id}.gif` }]),
);

export const journeyGif = (rowId: string): ImageURISource | undefined => JOURNEY_GIFS[rowId];
