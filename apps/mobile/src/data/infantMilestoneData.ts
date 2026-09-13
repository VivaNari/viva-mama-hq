import { IMilestoneBand } from '../types/infantLog.types';

/**
 * Developmental milestones by age band, to two years (PRD 4.2, "our focus is till 2 years").
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * CONTENT PENDING. The authoritative list lives in the team's milestone sheet linked from
 * the PRD, with illustrations still to come from Dr Harsha. What follows is the widely
 * published WHO/CDC set, four per band, so the screen has real structure to lay out —
 * replace it wholesale when the sheet is final rather than editing around it.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * `photoHintKey` stands in for the illustration each card is designed around. It renders
 * as the hatched placeholder in the design, which is honest about what is missing instead
 * of shipping a blank tile.
 */
export const MILESTONE_BANDS: IMilestoneBand[] = [
  {
    key: '0-3',
    labelKey: 'infant.milestone.band0to3',
    milestones: [
      {
        key: 'holds_head_up',
        nameKey: 'infant.milestone.holdsHeadUp',
        ageKey: 'infant.milestone.age1to2Months',
        photoHintKey: 'infant.milestone.photoHoldsHeadUp',
      },
      {
        key: 'social_smile',
        nameKey: 'infant.milestone.socialSmile',
        ageKey: 'infant.milestone.age2Months',
        photoHintKey: 'infant.milestone.photoSocialSmile',
      },
      {
        key: 'follows_objects',
        nameKey: 'infant.milestone.followsObjects',
        ageKey: 'infant.milestone.age2to3Months',
        photoHintKey: 'infant.milestone.photoFollowsObjects',
      },
      {
        key: 'pushes_up',
        nameKey: 'infant.milestone.pushesUp',
        ageKey: 'infant.milestone.age3Months',
        photoHintKey: 'infant.milestone.photoPushesUp',
      },
    ],
  },
  {
    key: '4-6',
    labelKey: 'infant.milestone.band4to6',
    milestones: [
      {
        key: 'reaches_for_toys',
        nameKey: 'infant.milestone.reachesForToys',
        ageKey: 'infant.milestone.age4Months',
        photoHintKey: 'infant.milestone.photoReachesForToys',
      },
      {
        key: 'rolls_over',
        nameKey: 'infant.milestone.rollsOver',
        ageKey: 'infant.milestone.age4to6Months',
        photoHintKey: 'infant.milestone.photoRollsOver',
      },
      {
        key: 'babbles',
        nameKey: 'infant.milestone.babbles',
        ageKey: 'infant.milestone.age4to6Months',
        photoHintKey: 'infant.milestone.photoBabbles',
      },
      {
        key: 'sits_with_support',
        nameKey: 'infant.milestone.sitsWithSupport',
        ageKey: 'infant.milestone.age6Months',
        photoHintKey: 'infant.milestone.photoSitsWithSupport',
      },
    ],
  },
  {
    key: '7-12',
    labelKey: 'infant.milestone.band7to12',
    milestones: [
      {
        key: 'sits_unsupported',
        nameKey: 'infant.milestone.sitsUnsupported',
        ageKey: 'infant.milestone.age7to9Months',
        photoHintKey: 'infant.milestone.photoSitsUnsupported',
      },
      {
        key: 'crawls',
        nameKey: 'infant.milestone.crawls',
        ageKey: 'infant.milestone.age8to10Months',
        photoHintKey: 'infant.milestone.photoCrawls',
      },
      {
        key: 'pulls_to_stand',
        nameKey: 'infant.milestone.pullsToStand',
        ageKey: 'infant.milestone.age9to12Months',
        photoHintKey: 'infant.milestone.photoPullsToStand',
      },
      {
        key: 'first_words',
        nameKey: 'infant.milestone.firstWords',
        ageKey: 'infant.milestone.age10to12Months',
        photoHintKey: 'infant.milestone.photoFirstWords',
      },
    ],
  },
  {
    key: '13-18',
    labelKey: 'infant.milestone.band13to18',
    milestones: [
      {
        key: 'walks_alone',
        nameKey: 'infant.milestone.walksAlone',
        ageKey: 'infant.milestone.age12to15Months',
        photoHintKey: 'infant.milestone.photoWalksAlone',
      },
      {
        key: 'points_to_show',
        nameKey: 'infant.milestone.pointsToShow',
        ageKey: 'infant.milestone.age15to18Months',
        photoHintKey: 'infant.milestone.photoPointsToShow',
      },
      {
        key: 'drinks_from_cup',
        nameKey: 'infant.milestone.drinksFromCup',
        ageKey: 'infant.milestone.age15to18Months',
        photoHintKey: 'infant.milestone.photoDrinksFromCup',
      },
      {
        key: 'stacks_blocks',
        nameKey: 'infant.milestone.stacksBlocks',
        ageKey: 'infant.milestone.age15to18Months',
        photoHintKey: 'infant.milestone.photoStacksBlocks',
      },
    ],
  },
  {
    key: '19-24',
    labelKey: 'infant.milestone.band19to24',
    milestones: [
      {
        key: 'runs',
        nameKey: 'infant.milestone.runs',
        ageKey: 'infant.milestone.age18to24Months',
        photoHintKey: 'infant.milestone.photoRuns',
      },
      {
        key: 'kicks_ball',
        nameKey: 'infant.milestone.kicksBall',
        ageKey: 'infant.milestone.age20to24Months',
        photoHintKey: 'infant.milestone.photoKicksBall',
      },
      {
        key: 'two_word_phrases',
        nameKey: 'infant.milestone.twoWordPhrases',
        ageKey: 'infant.milestone.age20to24Months',
        photoHintKey: 'infant.milestone.photoTwoWordPhrases',
      },
      {
        key: 'uses_spoon',
        nameKey: 'infant.milestone.usesSpoon',
        ageKey: 'infant.milestone.age18to24Months',
        photoHintKey: 'infant.milestone.photoUsesSpoon',
      },
    ],
  },
];
