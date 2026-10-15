import { ImageURISource } from 'react-native';

/**
 * Milestone animations, keyed by milestone, served from assets.vivamama.in.
 *
 * Hosted rather than bundled: each clip is a few MB and GIFs do not compress further, so
 * bundling them would add roughly that much per milestone to the app. Hosted, they cost
 * nothing to install, download on first view, and are then served from the image cache
 * (the host sends a week-long `max-age`). HTTPS, because release builds refuse plain HTTP.
 *
 * A milestone missing from this list shows a placeholder icon. Built at module load, so each
 * card receives the same object on every render and its memo still holds.
 */
const ASSET_BASE_URL = 'https://assets.vivamama.in/milestones';

const HOSTED = [
    'attempts_to_reach_and_grasp_an_object',
    'begins_to_babble_ah_ee_oo_other_than_when_crying',
    'begins_to_recognize_the_mothers_face',
    'correctly_points_out_and_names_one_or_more_body_parts',
    'crawls_to_get_desired_toys_without_bumping_into_objects',
    'develops_a_social_smile',
    'grasps_a_toy_using_all_fingers',
    'imitates_household_chores',
    'keeps_hands_open_and_relaxed',
    'keeps_head_steady_when_held_upright_and_can_sit_with_support',
    'laughs_aloud_or_makes_squealing_sounds',
    'likes_to_look_at_self_in_a_mirror',
    'looks_for_toys_that_have_been_hidden_in_front_of_them',
    'makes_eye_contact',
    'moves_both_arms_and_both_legs_when_excited',
    'names_and_identifies_common_objects_and_their_pictures',
    'puts_pebbles_small_objects_in_a_container',
    'raises_arms_to_be_picked_up',
    'raises_head_at_times_when_on_tummy',
    'responds_to_name_being_called',
    'responds_to_simple_requests_like_no_come_here',
    'rolls_over_in_both_directions',
    'sits_without_support_and_reaches_for_toys_without_falling',
    'stands_and_takes_several_independent_steps',
    'turns_head_to_visually_follow_familiar_faces_or_toys',
    'turns_head_towards_the_direction_of_sound',
    'uses_a_variety_of_familiar_gestures_like_waving_clapping',
    'uses_one_or_two_common_words_in_mother_tongue',
    'walks_steadily_even_while_pulling_a_toy',
];

export const MILESTONE_GIFS: Record<string, ImageURISource> = Object.fromEntries(
    HOSTED.map((key) => [key, { uri: `${ASSET_BASE_URL}/${key}.gif` }]),
);
