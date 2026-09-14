import { Posture, Prop } from './StillPose';

/**
 * The posture and prop each milestone is drawn in.
 *
 * Assigned by hand rather than derived from the text: "raises arms to be picked up" and
 * "responds to name being called" are both a sitting baby, and no amount of keyword
 * matching would work that out. Thirty-three entries is small enough to be read and
 * checked against the card.
 *
 * Keys come from `infantMilestoneData.ts`, which the catalogue generator emits. A key with
 * no entry here falls back to a sitting pose rather than rendering nothing — a new
 * milestone added to the sheet should appear on the screen, just unremarkably.
 */
export interface Pose {
    posture: Posture;
    prop?: Prop;
}

export const MILESTONE_POSES: Record<string, Pose> = {
    // 2–3 months — mostly face and tummy time
    begins_to_recognize_the_mothers_face: { posture: 'closeUp' },
    develops_a_social_smile: { posture: 'closeUp' },
    makes_eye_contact: { posture: 'closeUp' },
    raises_head_at_times_when_on_tummy: { posture: 'tummy', prop: 'rattle' },
    moves_both_arms_and_both_legs_when_excited: { posture: 'tummy' },
    keeps_hands_open_and_relaxed: { posture: 'closeUp' },

    // 4–6 months — head control, reaching, first sounds
    keeps_head_steady_when_held_upright_and_can_sit_with_support: { posture: 'sitting' },
    turns_head_towards_the_direction_of_sound: { posture: 'sitting' },
    attempts_to_reach_and_grasp_an_object: { posture: 'sitting', prop: 'rattle' },
    laughs_aloud_or_makes_squealing_sounds: { posture: 'closeUp' },
    begins_to_babble_ah_ee_oo_other_than_when_crying: { posture: 'closeUp' },
    likes_to_look_at_self_in_a_mirror: { posture: 'sitting', prop: 'mirror' },

    // 7–9 months — rolling, grasping, responding
    rolls_over_in_both_directions: { posture: 'tummy' },
    grasps_a_toy_using_all_fingers: { posture: 'sitting', prop: 'rattle' },
    turns_head_to_visually_follow_familiar_faces_or_toys: { posture: 'sitting', prop: 'rattle' },
    looks_for_toys_that_have_been_hidden_in_front_of_them: { posture: 'sitting', prop: 'container' },
    responds_to_name_being_called: { posture: 'sitting' },

    // 10–12 months — sitting, crawling, first words
    sits_without_support_and_reaches_for_toys_without_falling: { posture: 'sitting', prop: 'rattle' },
    raises_arms_to_be_picked_up: { posture: 'sitting' },
    crawls_to_get_desired_toys_without_bumping_into_objects: { posture: 'tummy', prop: 'rattle' },
    uses_one_or_two_common_words_in_mother_tongue: { posture: 'sitting' },
    responds_to_simple_requests_like_no_come_here: { posture: 'sitting' },

    // 18 months — on their feet
    stands_and_takes_several_independent_steps: { posture: 'standing' },
    uses_a_variety_of_familiar_gestures_like_waving_clapping: { posture: 'standing' },
    puts_pebbles_small_objects_in_a_container: { posture: 'sitting', prop: 'container' },
    names_and_identifies_common_objects_and_their_pictures: { posture: 'sitting', prop: 'book' },

    // 24 months
    walks_steadily_even_while_pulling_a_toy: { posture: 'standing', prop: 'rattle' },
    imitates_household_chores: { posture: 'standing' },
    correctly_points_out_and_names_one_or_more_body_parts: { posture: 'standing', prop: 'book' },
};

export const DEFAULT_POSE: Pose = { posture: 'sitting' };
