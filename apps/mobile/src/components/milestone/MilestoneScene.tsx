import React from 'react';

import { SceneFrame, ScenePhase } from './rig/parts';
import StillPose from './rig/StillPose';
import { DEFAULT_POSE, MILESTONE_POSES } from './rig/poses';
import { SkinTone } from './rig/palette';
import { SceneClock } from './rig/useSceneClock';
import RecognisesFaceScene, {
    RECOGNISES_FACE_CUES,
    RECOGNISES_FACE_DURATION,
} from './scenes/recognisesFace';
import SocialSmileScene, {
    SOCIAL_SMILE_CUES,
    SOCIAL_SMILE_DURATION,
} from './scenes/socialSmile';
import MakesEyeContactScene, {
    MAKES_EYE_CONTACT_CUES,
    MAKES_EYE_CONTACT_DURATION,
} from './scenes/makesEyeContact';
import RaisesHeadOnTummyScene, {
    RAISES_HEAD_CUES,
    RAISES_HEAD_DURATION,
} from './scenes/raisesHeadOnTummy';
import KicksAndWavesScene, {
    KICKS_AND_WAVES_CUES,
    KICKS_AND_WAVES_DURATION,
} from './scenes/kicksAndWaves';
import HandsOpenAndRelaxedScene, {
    HANDS_OPEN_CUES,
    HANDS_OPEN_DURATION,
} from './scenes/handsOpenAndRelaxed';
import HeadSteadyScene, {
    HEAD_STEADY_CUES,
    HEAD_STEADY_DURATION,
} from './scenes/headSteady';
import TurnsToSoundScene, {
    TURNS_TO_SOUND_CUES,
    TURNS_TO_SOUND_DURATION,
} from './scenes/turnsToSound';
import ReachesAndGraspsScene, {
    REACHES_CUES,
    REACHES_DURATION,
} from './scenes/reachesAndGrasps';
import LaughsAloudScene, {
    LAUGHS_ALOUD_CUES,
    LAUGHS_ALOUD_DURATION,
} from './scenes/laughsAloud';
import BabblesScene, { BABBLES_CUES, BABBLES_DURATION } from './scenes/babbles';
import LooksInMirrorScene, { MIRROR_CUES, MIRROR_DURATION } from './scenes/looksInMirror';
import RollsOverBothWaysScene, {
    ROLLS_BOTH_WAYS_CUES,
    ROLLS_BOTH_WAYS_DURATION,
} from './scenes/rollsOverBothWays';
import GraspsScene, { GRASPS_CUES, GRASPS_DURATION } from './scenes/grasps';
import FollowsWithEyesScene, {
    FOLLOWS_CUES,
    FOLLOWS_DURATION,
} from './scenes/followsWithEyes';
import FindsHiddenToyScene, {
    HIDDEN_TOY_CUES,
    HIDDEN_TOY_DURATION,
} from './scenes/findsHiddenToy';
import RespondsToNameScene, {
    RESPONDS_TO_NAME_CUES,
    RESPONDS_TO_NAME_DURATION,
} from './scenes/respondsToName';
import SitsAndReachesScene, {
    SITS_REACHES_CUES,
    SITS_REACHES_DURATION,
} from './scenes/sitsAndReaches';
import ArmsUpScene, { ARMS_UP_CUES, ARMS_UP_DURATION } from './scenes/armsUp';
import CrawlsAroundScene, { CRAWLS_CUES, CRAWLS_DURATION } from './scenes/crawlsAround';
import FirstWordsScene, {
    FIRST_WORDS_CUES,
    FIRST_WORDS_DURATION,
} from './scenes/firstWords';
import FollowsRequestScene, {
    FOLLOWS_REQUEST_CUES,
    FOLLOWS_REQUEST_DURATION,
} from './scenes/followsRequest';
import StandsAndWalksScene, {
    STANDS_WALKS_CUES,
    STANDS_WALKS_DURATION,
} from './scenes/standsAndWalks';
import GesturesScene, { GESTURES_CUES, GESTURES_DURATION } from './scenes/gestures';
import PincerIntoContainerScene, {
    PINCER_CUES,
    PINCER_DURATION,
} from './scenes/pincerIntoContainer';
import NamesPicturesScene, {
    NAMES_PICTURES_CUES,
    NAMES_PICTURES_DURATION,
} from './scenes/namesPictures';
import WalksPullingToyScene, {
    PULLS_TOY_CUES,
    PULLS_TOY_DURATION,
} from './scenes/walksPullingToy';
import ImitatesChoresScene, {
    IMITATES_CUES,
    IMITATES_DURATION,
} from './scenes/imitatesChores';
import NamesBodyPartsScene, {
    BODY_PARTS_CUES,
    BODY_PARTS_DURATION,
} from './scenes/namesBodyParts';
import { SceneDetail, SceneProps } from './sceneTypes';

/**
 * Picks the illustration for a milestone.
 *
 * Four milestones have an authored performance; the rest are drawn still from the same
 * rig. A caller asks for a key and gets the best available picture — it never needs to know
 * which kind it got, which is what lets an animation be added later without touching a
 * single call site.
 */

interface AnimatedScene {
    Component: React.FC<SceneProps>;
    duration: number;
    /** Labelled moments the detail view's step chips seek to. */
    steps: { labelKey: string; at: number }[];
}

export const ANIMATED_SCENES: Record<string, AnimatedScene> = {
    // ---------------------------------------------------------------- 2-3 months

    begins_to_recognize_the_mothers_face: {
        Component: RecognisesFaceScene,
        duration: RECOGNISES_FACE_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.looking', at: RECOGNISES_FACE_CUES.alone },
            { labelKey: 'infant.milestone.steps.followsHer', at: RECOGNISES_FACE_CUES.approach },
            { labelKey: 'infant.milestone.steps.knowsHer', at: RECOGNISES_FACE_CUES.knows },
        ],
    },

    develops_a_social_smile: {
        Component: SocialSmileScene,
        duration: SOCIAL_SMILE_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.settled', at: SOCIAL_SMILE_CUES.quiet },
            { labelKey: 'infant.milestone.steps.someoneComes', at: SOCIAL_SMILE_CUES.arrive },
            { labelKey: 'infant.milestone.steps.smilesBack', at: SOCIAL_SMILE_CUES.smile },
        ],
    },

    makes_eye_contact: {
        Component: MakesEyeContactScene,
        duration: MAKES_EYE_CONTACT_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.eyesWander', at: MAKES_EYE_CONTACT_CUES.wander },
            { labelKey: 'infant.milestone.steps.findsYou', at: MAKES_EYE_CONTACT_CUES.lock },
            { labelKey: 'infant.milestone.steps.holdsIt', at: MAKES_EYE_CONTACT_CUES.hold },
        ],
    },

    raises_head_at_times_when_on_tummy: {
        Component: RaisesHeadOnTummyScene,
        duration: RAISES_HEAD_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.onTummy', at: RAISES_HEAD_CUES.tummy },
            { labelKey: 'infant.milestone.steps.pressUp', at: RAISES_HEAD_CUES.lift },
            { labelKey: 'infant.milestone.steps.holdSteady', at: RAISES_HEAD_CUES.hold },
        ],
    },

    moves_both_arms_and_both_legs_when_excited: {
        Component: KicksAndWavesScene,
        duration: KICKS_AND_WAVES_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.lyingCalm', at: KICKS_AND_WAVES_CUES.calm },
            { labelKey: 'infant.milestone.steps.allFour', at: KICKS_AND_WAVES_CUES.peak },
            { labelKey: 'infant.milestone.steps.settlesAgain', at: KICKS_AND_WAVES_CUES.settle },
        ],
    },

    keeps_hands_open_and_relaxed: {
        Component: HandsOpenAndRelaxedScene,
        duration: HANDS_OPEN_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.softlyCurled', at: HANDS_OPEN_CUES.soft },
            { labelKey: 'infant.milestone.steps.openAndEasy', at: HANDS_OPEN_CUES.open },
        ],
    },

    // ---------------------------------------------------------------- 4-6 months

    keeps_head_steady_when_held_upright_and_can_sit_with_support: {
        Component: HeadSteadyScene,
        duration: HEAD_STEADY_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.propped', at: HEAD_STEADY_CUES.propped },
            { labelKey: 'infant.milestone.steps.bodySways', at: HEAD_STEADY_CUES.sway },
            { labelKey: 'infant.milestone.steps.headStaysLevel', at: HEAD_STEADY_CUES.steady },
        ],
    },

    turns_head_towards_the_direction_of_sound: {
        Component: TurnsToSoundScene,
        duration: TURNS_TO_SOUND_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.quiet', at: TURNS_TO_SOUND_CUES.quiet },
            { labelKey: 'infant.milestone.steps.aSound', at: TURNS_TO_SOUND_CUES.sound },
            { labelKey: 'infant.milestone.steps.headTurns', at: TURNS_TO_SOUND_CUES.turn },
        ],
    },

    attempts_to_reach_and_grasp_an_object: {
        Component: ReachesAndGraspsScene,
        duration: REACHES_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.seesTheToy', at: REACHES_CUES.sees },
            { labelKey: 'infant.milestone.steps.reachesOut', at: REACHES_CUES.reach },
            { labelKey: 'infant.milestone.steps.justShort', at: REACHES_CUES.miss },
            { labelKey: 'infant.milestone.steps.triesAgain', at: REACHES_CUES.again },
        ],
    },

    laughs_aloud_or_makes_squealing_sounds: {
        Component: LaughsAloudScene,
        duration: LAUGHS_ALOUD_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.pleased', at: LAUGHS_ALOUD_CUES.grin },
            { labelKey: 'infant.milestone.steps.outLoud', at: LAUGHS_ALOUD_CUES.laugh },
            { labelKey: 'infant.milestone.steps.catchesBreath', at: LAUGHS_ALOUD_CUES.breathless },
        ],
    },

    begins_to_babble_ah_ee_oo_other_than_when_crying: {
        Component: BabblesScene,
        duration: BABBLES_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.mouthAtRest', at: BABBLES_CUES.quiet },
            { labelKey: 'infant.milestone.steps.openRound', at: BABBLES_CUES.ah },
            { labelKey: 'infant.milestone.steps.wideFlat', at: BABBLES_CUES.ee },
            { labelKey: 'infant.milestone.steps.smallPursed', at: BABBLES_CUES.oo },
        ],
    },

    likes_to_look_at_self_in_a_mirror: {
        Component: LooksInMirrorScene,
        duration: MIRROR_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.something', at: MIRROR_CUES.notices },
            { labelKey: 'infant.milestone.steps.leansIn', at: MIRROR_CUES.leans },
            { labelKey: 'infant.milestone.steps.patsTheGlass', at: MIRROR_CUES.pats },
        ],
    },

    // ---------------------------------------------------------------- 7-9 months

    rolls_over_in_both_directions: {
        Component: RollsOverBothWaysScene,
        duration: ROLLS_BOTH_WAYS_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.onBack', at: ROLLS_BOTH_WAYS_CUES.onBack },
            { labelKey: 'infant.milestone.steps.rollOver', at: ROLLS_BOTH_WAYS_CUES.rollOver },
            { labelKey: 'infant.milestone.steps.onTummy', at: ROLLS_BOTH_WAYS_CUES.onTummy },
            { labelKey: 'infant.milestone.steps.andBack', at: ROLLS_BOTH_WAYS_CUES.rollBack },
        ],
    },

    grasps_a_toy_using_all_fingers: {
        Component: GraspsScene,
        duration: GRASPS_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.handOpen', at: GRASPS_CUES.open },
            { labelKey: 'infant.milestone.steps.allTogether', at: GRASPS_CUES.close },
            { labelKey: 'infant.milestone.steps.holdsIt2', at: GRASPS_CUES.holds },
        ],
    },

    turns_head_to_visually_follow_familiar_faces_or_toys: {
        Component: FollowsWithEyesScene,
        duration: FOLLOWS_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.toyAppears', at: FOLLOWS_CUES.appears },
            { labelKey: 'infant.milestone.steps.eyesFollow', at: FOLLOWS_CUES.across },
            { labelKey: 'infant.milestone.steps.andBackAgain', at: FOLLOWS_CUES.returns },
        ],
    },

    looks_for_toys_that_have_been_hidden_in_front_of_them: {
        Component: FindsHiddenToyScene,
        duration: HIDDEN_TOY_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.toyInView', at: HIDDEN_TOY_CUES.inView },
            { labelKey: 'infant.milestone.steps.coveredUp', at: HIDDEN_TOY_CUES.covered },
            { labelKey: 'infant.milestone.steps.keepsLooking', at: HIDDEN_TOY_CUES.waits },
            { labelKey: 'infant.milestone.steps.findsIt', at: HIDDEN_TOY_CUES.reaches },
        ],
    },

    responds_to_name_being_called: {
        Component: RespondsToNameScene,
        duration: RESPONDS_TO_NAME_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.busyPlaying', at: RESPONDS_TO_NAME_CUES.busy },
            { labelKey: 'infant.milestone.steps.calledOnce', at: RESPONDS_TO_NAME_CUES.firstCall },
            { labelKey: 'infant.milestone.steps.calledAgain', at: RESPONDS_TO_NAME_CUES.secondCall },
            { labelKey: 'infant.milestone.steps.looksRound', at: RESPONDS_TO_NAME_CUES.turns },
        ],
    },

    // -------------------------------------------------------------- 10-12 months

    sits_without_support_and_reaches_for_toys_without_falling: {
        Component: SitsAndReachesScene,
        duration: SITS_REACHES_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.sitting', at: SITS_REACHES_CUES.sitting },
            { labelKey: 'infant.milestone.steps.reachOut', at: SITS_REACHES_CUES.reach },
            { labelKey: 'infant.milestone.steps.nearlyOver', at: SITS_REACHES_CUES.wobble },
            { labelKey: 'infant.milestone.steps.comeBack', at: SITS_REACHES_CUES.recovers },
        ],
    },

    raises_arms_to_be_picked_up: {
        Component: ArmsUpScene,
        duration: ARMS_UP_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.someoneAbove', at: ARMS_UP_CUES.sees },
            { labelKey: 'infant.milestone.steps.armsUp', at: ARMS_UP_CUES.asks },
            { labelKey: 'infant.milestone.steps.andUp', at: ARMS_UP_CUES.lifted },
        ],
    },

    crawls_to_get_desired_toys_without_bumping_into_objects: {
        Component: CrawlsAroundScene,
        duration: CRAWLS_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.setsOff', at: CRAWLS_CUES.setsOff },
            { labelKey: 'infant.milestone.steps.inTheWay', at: CRAWLS_CUES.obstacle },
            { labelKey: 'infant.milestone.steps.goesRound', at: CRAWLS_CUES.steers },
            { labelKey: 'infant.milestone.steps.getsThere', at: CRAWLS_CUES.arrives },
        ],
    },

    uses_one_or_two_common_words_in_mother_tongue: {
        Component: FirstWordsScene,
        duration: FIRST_WORDS_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.someoneListening', at: FIRST_WORDS_CUES.together },
            { labelKey: 'infant.milestone.steps.oneWord', at: FIRST_WORDS_CUES.firstWord },
            { labelKey: 'infant.milestone.steps.thenAnother', at: FIRST_WORDS_CUES.secondWord },
        ],
    },

    responds_to_simple_requests_like_no_come_here: {
        Component: FollowsRequestScene,
        duration: FOLLOWS_REQUEST_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.settledHere', at: FOLLOWS_REQUEST_CUES.settled },
            { labelKey: 'infant.milestone.steps.comeHere', at: FOLLOWS_REQUEST_CUES.asked },
            { labelKey: 'infant.milestone.steps.aMoment', at: FOLLOWS_REQUEST_CUES.thinks },
            { labelKey: 'infant.milestone.steps.andComes', at: FOLLOWS_REQUEST_CUES.comes },
        ],
    },

    // ----------------------------------------------------------------- 18 months

    stands_and_takes_several_independent_steps: {
        Component: StandsAndWalksScene,
        duration: STANDS_WALKS_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.standing', at: STANDS_WALKS_CUES.stands },
            { labelKey: 'infant.milestone.steps.firstStep', at: STANDS_WALKS_CUES.firstStep },
            { labelKey: 'infant.milestone.steps.severalMore', at: STANDS_WALKS_CUES.walking },
            { labelKey: 'infant.milestone.steps.steady', at: STANDS_WALKS_CUES.stops },
        ],
    },

    uses_a_variety_of_familiar_gestures_like_waving_clapping: {
        Component: GesturesScene,
        duration: GESTURES_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.waves', at: GESTURES_CUES.wave },
            { labelKey: 'infant.milestone.steps.claps', at: GESTURES_CUES.clap },
            { labelKey: 'infant.milestone.steps.namaste', at: GESTURES_CUES.namaste },
        ],
    },

    puts_pebbles_small_objects_in_a_container: {
        Component: PincerIntoContainerScene,
        duration: PINCER_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.handReady', at: PINCER_CUES.ready },
            { labelKey: 'infant.milestone.steps.fingerAndThumb', at: PINCER_CUES.pinches },
            { labelKey: 'infant.milestone.steps.overThePot', at: PINCER_CUES.carries },
            { labelKey: 'infant.milestone.steps.letsGo', at: PINCER_CUES.releases },
        ],
    },

    names_and_identifies_common_objects_and_their_pictures: {
        Component: NamesPicturesScene,
        duration: NAMES_PICTURES_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.aPicture', at: NAMES_PICTURES_CUES.shown },
            { labelKey: 'infant.milestone.steps.pointsToIt', at: NAMES_PICTURES_CUES.points },
            { labelKey: 'infant.milestone.steps.namesIt', at: NAMES_PICTURES_CUES.names },
        ],
    },

    // ----------------------------------------------------------------- 24 months

    walks_steadily_even_while_pulling_a_toy: {
        Component: WalksPullingToyScene,
        duration: PULLS_TOY_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.stringInHand', at: PULLS_TOY_CUES.holds },
            { labelKey: 'infant.milestone.steps.setsOff', at: PULLS_TOY_CUES.walks },
            { labelKey: 'infant.milestone.steps.stillSteady', at: PULLS_TOY_CUES.steady },
        ],
    },

    imitates_household_chores: {
        Component: ImitatesChoresScene,
        duration: IMITATES_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.watching', at: IMITATES_CUES.watching },
            { labelKey: 'infant.milestone.steps.joinsIn', at: IMITATES_CUES.joins },
            { labelKey: 'infant.milestone.steps.sameRhythm', at: IMITATES_CUES.together },
        ],
    },

    correctly_points_out_and_names_one_or_more_body_parts: {
        Component: NamesBodyPartsScene,
        duration: BODY_PARTS_DURATION,
        steps: [
            { labelKey: 'infant.milestone.steps.nose', at: BODY_PARTS_CUES.nose },
            { labelKey: 'infant.milestone.steps.ear', at: BODY_PARTS_CUES.ear },
            { labelKey: 'infant.milestone.steps.headPart', at: BODY_PARTS_CUES.head },
        ],
    },


};

export const sceneFor = (milestoneKey: string): AnimatedScene | undefined =>
    ANIMATED_SCENES[milestoneKey];

interface MilestoneSceneProps {
    milestoneKey: string;
    width: number;
    skinTone?: SkinTone;
    /**
     * Provide only for the scene that should actually move. A card thumbnail in a grid
     * passes nothing and gets a frozen frame — six looping performances on one screen is a
     * cost with no reader.
     */
    clock?: SceneClock;
    /**
     * Seconds to offset this card into the shared clock.
     *
     * Cards in a grid share one clock, so without this they perform in unison — six babies
     * lifting their heads on the same frame, which reads as a glitch rather than as six
     * children. The detail view leaves it at zero, because its step chips seek to named
     * moments and a phased clock would land them somewhere else.
     */
    phase?: number;
    detail?: SceneDetail;
}

const MilestoneScene: React.FC<MilestoneSceneProps> = ({
    milestoneKey,
    width,
    skinTone,
    clock,
    phase = 0,
    detail = 'thumb',
}) => {
    const animated = sceneFor(milestoneKey);

    return (
        <ScenePhase.Provider value={phase}>
            <SceneFrame width={width}>
                {animated ? (
                    <animated.Component
                        clock={clock}
                        skinTone={skinTone}
                        still={!clock}
                        detail={detail}
                    />
                ) : (
                    (() => {
                        const pose = MILESTONE_POSES[milestoneKey] ?? DEFAULT_POSE;
                        return (
                            <StillPose
                                posture={pose.posture}
                                prop={pose.prop}
                                skinTone={skinTone}
                            />
                        );
                    })()
                )}
            </SceneFrame>
        </ScenePhase.Provider>
    );
};

export default MilestoneScene;
