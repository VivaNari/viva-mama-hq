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
 * The API validates `milestoneKey` against this list, so a stale or tampered client
 * cannot store a row that no screen can ever render. Mirrors MILESTONE_KEYS in
 * apps/mobile/src/data/infantMilestoneData.ts — both are emitted from the same sheet in
 * the same run, which is what keeps them from drifting.
 */
export const MILESTONE_KEYS = [
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
] as const;

export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

export const isMilestoneKey = (value: unknown): value is MilestoneKey =>
    typeof value === "string" && (MILESTONE_KEYS as readonly string[]).includes(value);
