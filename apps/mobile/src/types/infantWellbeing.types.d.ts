/**
 * The infant dashboard's wellbeing card, as the API returns it.
 *
 * Mirrors `services/backend/src/types/infant-wellbeing.types.ts` — hand-duplicated, as the
 * other infant log types are, because there is no shared contracts package for these.
 *
 * Copy arrives as i18n keys plus params rather than as sentences: the server does not know
 * which language the reader wants, and a second server-side render in Hindi is how the two
 * drift apart.
 */

/**
 * Two states, and no red.
 *
 * `attention` never means "something is wrong with this baby" — it means there is something
 * to *do*, which is a different question. A baby on the 3rd percentile is a healthy small
 * baby and stays `on_track`; a baby whose vaccines are overdue needs a clinic visit
 * whatever their percentile says.
 */
export type TWellbeingStatus = 'on_track' | 'attention';

export type TWellbeingDomain = 'growth' | 'feeding' | 'vaccines' | 'milestones';

export interface IWellbeingTile {
  domain: TWellbeingDomain;
  status: TWellbeingStatus;
  /** Which rule fired. Carried for analytics and tests, not rendered. */
  reason: string;
  /** The tile's headline value — the child. The status beside it is the to-do. */
  valueKey: string;
  valueParams?: Record<string, string | number>;
  /** What to do about it. Present only when `status` is `attention`. */
  actionKey?: string;
  actionParams?: Record<string, string | number>;
}

export interface IInfantWellbeing {
  childId: string;
  status: TWellbeingStatus;
  /** A child too new, or too unlogged, for the card to fairly say anything yet. */
  firstRun: boolean;
  summaryKey: string;
  summaryParams?: Record<string, string | number>;
  tiles: IWellbeingTile[];
}
