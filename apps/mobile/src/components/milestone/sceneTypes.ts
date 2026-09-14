import { SkinTone } from './rig/palette';
import { SceneClock } from './rig/useSceneClock';

export type SceneDetail = 'thumb' | 'full';

/**
 * What every milestone scene takes.
 *
 * `still` and `clock` are the two ways a scene is asked to render: a frozen frame for a
 * card thumbnail that has no business animating, or the live clock for the one on screen.
 * A scene never decides for itself which it is.
 */
export interface SceneProps {
    clock?: SceneClock;
    skinTone?: SkinTone;
    /** Render the pose frozen at the scene's most legible frame. */
    still?: boolean;
    /**
     * How much of the performance to draw.
     *
     * A card thumbnail is a couple of hundred pixels across, where a blink, a camera push or
     * a secondary prop is invisible — but still costs a worklet every frame, six times over
     * on a full band. `'thumb'` drops those and keeps the movement that carries the meaning;
     * `'full'` is the detail view, where they are worth having.
     */
    detail?: SceneDetail;
}
