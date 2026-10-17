import { TFunction } from "i18next";

import { IChild, EChildOnboardingStatus } from "../types/user.types";

/**
 * Human-readable age for a child, in the largest unit that still reads naturally.
 *
 * Newborns are the common case here and days matter to a parent ("15 days old"), so the
 * thresholds deliberately favour the smaller unit for longer than a generic age formatter
 * would: days up to 8 weeks, then months up to two years, then years.
 *
 * Pluralisation is explicit rather than left to i18next's count suffixes, because Hindi's
 * plural rules do not line up with English's and the two locales would drift.
 */
export const getChildAgeLabel = (
  dateOfBirth: Date | string | undefined | null,
  t: TFunction,
): string => {
  if (!dateOfBirth) return "";

  const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return "";

  const msPerDay = 24 * 60 * 60 * 1000;
  // Floor at 0: a device clock running behind the server would otherwise render a
  // negative age on a child added moments ago.
  const days = Math.max(0, Math.floor((Date.now() - dob.getTime()) / msPerDay));

  if (days < 56) {
    return days === 1 ? t("infant.ageDay", { count: 1 }) : t("infant.ageDays", { count: days });
  }

  const months = Math.floor(days / 30.44);
  if (months < 24) {
    return months === 1
      ? t("infant.ageMonth", { count: 1 })
      : t("infant.ageMonths", { count: months });
  }

  const years = Math.floor(days / 365.25);
  return years === 1
    ? t("infant.ageYear", { count: 1 })
    : t("infant.ageYears", { count: years });
};

/**
 * The children worth showing.
 *
 * DRAFT rows are live baby-onboarding runs, not children — an abandoned "Add your baby"
 * leaves one behind, and rendering it would put a nameless circle on the dashboard.
 *
 * Legacy rows predate onboarding_status entirely and carry no status at all; they are
 * real children, so absence of the field is treated as complete rather than draft.
 */
export const getVisibleChildren = (children: IChild[] | undefined | null): IChild[] => {
  if (!children?.length) return [];

  return children.filter(
    (child) =>
      child.onboarding_status !== EChildOnboardingStatus.DRAFT && !!child.name,
  );
};

/** First letter for the avatar circle, with a neutral fallback for an unnamed child. */
export const getChildInitial = (child: IChild): string => {
  const trimmed = child.name?.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
};
