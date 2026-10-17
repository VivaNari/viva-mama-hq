/**
 * GENERATED — do not edit by hand.
 *
 * Source:     content/mcp-card/VivaMama_Vaccinations_and_Milestones.xlsx (sheet "Milestones")
 * sha256:     49480011db00a6d5446a0f1f8c1fe217d9868f72563893293cfbeb16e92e7450
 * Content:    India Mother and Child Protection (MCP) Card, 2018 Version.
 *             Ministry of Health & Family Welfare · Ministry of Women & Child Development.
 * Counts:     6 bands, 29 milestones, 33 warning signs
 * Regenerate: node scripts/generate-milestone-catalogue.mjs
 *
 * Milestone keys only. The words a parent reads live in the locale files, keyed
 * `infant.milestone.items.<key>` and `infant.milestone.warnings.<key>`, so that Hindi is a
 * translation rather than a second transcription of the card.
 */
import { IMilestoneBand } from "../types/infantLog.types";

export const MILESTONE_BANDS: IMilestoneBand[] = [
    {
        key: "2-3m",
        labelKey: "infant.milestone.bands.2-3m",
        ageMonths: { from: 2, to: 3 },
        milestones: [
            "begins_to_recognize_the_mothers_face",
            "develops_a_social_smile",
            "makes_eye_contact",
            "raises_head_at_times_when_on_tummy",
            "moves_both_arms_and_both_legs_when_excited",
            "keeps_hands_open_and_relaxed",
        ],
        warnings: [
            "no_social_smile",
            "does_not_make_eye_contact_when_being_fed_cuddled_or_spoken",
            "persistent_squinting_after_2_months",
            "does_not_startle_wake_up_cry_in_response_to_a_sudden_loud",
            "head_pushed_back_with_stiff_arms_and_legs",
            "persistently_holds_thumb_inside_the_palm_with_hands_kept",
        ],
    },
    {
        key: "4-6m",
        labelKey: "infant.milestone.bands.4-6m",
        ageMonths: { from: 4, to: 6 },
        milestones: [
            "keeps_head_steady_when_held_upright_and_can_sit_with_support",
            "turns_head_towards_the_direction_of_sound",
            "attempts_to_reach_and_grasp_an_object",
            "laughs_aloud_or_makes_squealing_sounds",
            "begins_to_babble_ah_ee_oo_other_than_when_crying",
            "likes_to_look_at_self_in_a_mirror",
        ],
        warnings: [
            "lacks_head_control",
            "cannot_sit_up_even_with_help",
            "does_not_grasp_things_within_reach",
            "unable_to_raise_head_when_on_tummy",
            "head_and_eyes_do_not_move_to_follow_track_a_moving_object",
            "does_not_vocalize_by_making_different_sounds_such_as_ah_eh",
        ],
    },
    {
        key: "7-9m",
        labelKey: "infant.milestone.bands.7-9m",
        ageMonths: { from: 7, to: 9 },
        milestones: [
            "rolls_over_in_both_directions",
            "grasps_a_toy_using_all_fingers",
            "turns_head_to_visually_follow_familiar_faces_or_toys",
            "looks_for_toys_that_have_been_hidden_in_front_of_them",
            "responds_to_name_being_called",
        ],
        warnings: [
            "cannot_roll_over",
            "needs_support_to_sit",
            "does_not_turn_towards_a_sound_out_of_sight",
            "tilts_head_always_to_one_side_each_time_when_looking",
            "does_not_utter_pa_pa_pa_ma_ma_ba_ba_ba",
        ],
    },
    {
        key: "10-12m",
        labelKey: "infant.milestone.bands.10-12m",
        ageMonths: { from: 10, to: 12 },
        milestones: [
            "sits_without_support_and_reaches_for_toys_without_falling",
            "raises_arms_to_be_picked_up",
            "crawls_to_get_desired_toys_without_bumping_into_objects",
            "uses_one_or_two_common_words_in_mother_tongue",
            "responds_to_simple_requests_like_no_come_here",
        ],
        warnings: [
            "cannot_pick_up_small_objects_with_finger_and_thumb",
            "does_not_stretch_hands_to_be_picked_up",
            "does_not_respond_to_own_name",
            "does_not_search_for_half_hidden_toys_that_the_child_sees",
            "does_not_play_social_games_like_peek_a_boo_jhalak_anakh",
        ],
    },
    {
        key: "18m",
        labelKey: "infant.milestone.bands.18m",
        ageMonths: { from: 18, to: 18 },
        milestones: [
            "stands_and_takes_several_independent_steps",
            "uses_a_variety_of_familiar_gestures_like_waving_clapping",
            "puts_pebbles_small_objects_in_a_container",
            "names_and_identifies_common_objects_and_their_pictures",
        ],
        warnings: [
            "cannot_stand_on_his_her_own_without_support",
            "cannot_put_small_objects_in_a_container",
            "does_not_use_both_hands_for_everyday_activities_shows",
            "does_not_point_a_finger_at_an_object_when_named",
            "does_not_say_single_words_like_mama_or_dada",
            "does_not_respond_to_mothers_gestures_and_seems",
        ],
    },
    {
        key: "24m",
        labelKey: "infant.milestone.bands.24m",
        ageMonths: { from: 24, to: 24 },
        milestones: [
            "walks_steadily_even_while_pulling_a_toy",
            "imitates_household_chores",
            "correctly_points_out_and_names_one_or_more_body_parts",
        ],
        warnings: [
            "does_not_walk_steadily_while_pulling_a_toy",
            "cannot_scribble",
            "does_not_use_two_word_phrases_such_as_give_milk",
            "does_not_point_to_body_parts",
            "does_not_respond_appropriately_to_gestures_such_as_bye_bye",
        ],
    },
];

/** Every milestone key, in card order. The catalogue the API validates against. */
export const MILESTONE_KEYS: string[] = [
    "begins_to_recognize_the_mothers_face",
    "develops_a_social_smile",
    "makes_eye_contact",
    "raises_head_at_times_when_on_tummy",
    "moves_both_arms_and_both_legs_when_excited",
    "keeps_hands_open_and_relaxed",
    "keeps_head_steady_when_held_upright_and_can_sit_with_support",
    "turns_head_towards_the_direction_of_sound",
    "attempts_to_reach_and_grasp_an_object",
    "laughs_aloud_or_makes_squealing_sounds",
    "begins_to_babble_ah_ee_oo_other_than_when_crying",
    "likes_to_look_at_self_in_a_mirror",
    "rolls_over_in_both_directions",
    "grasps_a_toy_using_all_fingers",
    "turns_head_to_visually_follow_familiar_faces_or_toys",
    "looks_for_toys_that_have_been_hidden_in_front_of_them",
    "responds_to_name_being_called",
    "sits_without_support_and_reaches_for_toys_without_falling",
    "raises_arms_to_be_picked_up",
    "crawls_to_get_desired_toys_without_bumping_into_objects",
    "uses_one_or_two_common_words_in_mother_tongue",
    "responds_to_simple_requests_like_no_come_here",
    "stands_and_takes_several_independent_steps",
    "uses_a_variety_of_familiar_gestures_like_waving_clapping",
    "puts_pebbles_small_objects_in_a_container",
    "names_and_identifies_common_objects_and_their_pictures",
    "walks_steadily_even_while_pulling_a_toy",
    "imitates_household_chores",
    "correctly_points_out_and_names_one_or_more_body_parts",
];
