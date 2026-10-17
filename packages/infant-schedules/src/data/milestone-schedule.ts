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
 * The narrower slice @vivamama/infant-schedules needs: which bands exist, their age
 * window, and which milestone keys they cover. No copy — that stays in
 * apps/mobile/src/data/infantMilestoneData.ts, the one place that renders it.
 */
import { MilestoneBandWindow } from "../types";

export const MILESTONE_BAND_WINDOWS: MilestoneBandWindow[] = [
    {
        key: "2-3m",
        ageMonths: { from: 2, to: 3 },
        milestoneKeys: [
            "begins_to_recognize_the_mothers_face",
            "develops_a_social_smile",
            "makes_eye_contact",
            "raises_head_at_times_when_on_tummy",
            "moves_both_arms_and_both_legs_when_excited",
            "keeps_hands_open_and_relaxed",
        ],
    },
    {
        key: "4-6m",
        ageMonths: { from: 4, to: 6 },
        milestoneKeys: [
            "keeps_head_steady_when_held_upright_and_can_sit_with_support",
            "turns_head_towards_the_direction_of_sound",
            "attempts_to_reach_and_grasp_an_object",
            "laughs_aloud_or_makes_squealing_sounds",
            "begins_to_babble_ah_ee_oo_other_than_when_crying",
            "likes_to_look_at_self_in_a_mirror",
        ],
    },
    {
        key: "7-9m",
        ageMonths: { from: 7, to: 9 },
        milestoneKeys: [
            "rolls_over_in_both_directions",
            "grasps_a_toy_using_all_fingers",
            "turns_head_to_visually_follow_familiar_faces_or_toys",
            "looks_for_toys_that_have_been_hidden_in_front_of_them",
            "responds_to_name_being_called",
        ],
    },
    {
        key: "10-12m",
        ageMonths: { from: 10, to: 12 },
        milestoneKeys: [
            "sits_without_support_and_reaches_for_toys_without_falling",
            "raises_arms_to_be_picked_up",
            "crawls_to_get_desired_toys_without_bumping_into_objects",
            "uses_one_or_two_common_words_in_mother_tongue",
            "responds_to_simple_requests_like_no_come_here",
        ],
    },
    {
        key: "18m",
        ageMonths: { from: 18, to: 18 },
        milestoneKeys: [
            "stands_and_takes_several_independent_steps",
            "uses_a_variety_of_familiar_gestures_like_waving_clapping",
            "puts_pebbles_small_objects_in_a_container",
            "names_and_identifies_common_objects_and_their_pictures",
        ],
    },
    {
        key: "24m",
        ageMonths: { from: 24, to: 24 },
        milestoneKeys: [
            "walks_steadily_even_while_pulling_a_toy",
            "imitates_household_chores",
            "correctly_points_out_and_names_one_or_more_body_parts",
        ],
    },
];
