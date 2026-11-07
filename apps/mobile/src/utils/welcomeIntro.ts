const ART_WIDTH = 390;
const ART_HEIGHT = 616;

/** Don't let large screens blow the artwork up past the point it stops looking sharp. */
const MAX_ART_SCALE = 1.25;

const SWIPE_DISTANCE = 56;
const SWIPE_VELOCITY = 600;

/** How far to scale the design's fixed artboard so it fits the space a page has. */
export const fitArtScale = (pageWidth: number, pageHeight: number): number =>
    Math.min(pageWidth / ART_WIDTH, pageHeight / ART_HEIGHT, MAX_ART_SCALE);

/** Which slide a finished swipe lands on: a long drag or a quick flick turns the page. */
export const resolveSwipe = (
    translation: number,
    velocity: number,
    current: number,
    last: number,
): number => {
    if ((translation < -SWIPE_DISTANCE || velocity < -SWIPE_VELOCITY) && current < last) {
        return current + 1;
    }
    if ((translation > SWIPE_DISTANCE || velocity > SWIPE_VELOCITY) && current > 0) {
        return current - 1;
    }
    return current;
};
