/**
 * Rules that decide what an expert may be used for. Kept out of ExpertService so the
 * booking services can share them without dragging the whole service in.
 */

/**
 * Whether this expert consults in person only, and can never be booked through the app.
 *
 * A remuneration of zero is not a free online consultation — it is how a referring
 * doctor who sees her own patients at her own clinic is recorded. There is no fee to
 * charge, and Razorpay cannot raise an order for ₹0, so every in-app booking route is
 * closed for them: paid checkout has no amount, and a plan credit would be spent on a
 * session the app never arranged.
 *
 * Read defensively rather than as `=== 0`: a missing or non-numeric remuneration is
 * just as unbookable as an explicit zero, and failing closed here is cheaper than a
 * payment sheet that opens and then errors.
 */
export const isInPersonOnlyExpert = (expert: { remuneration?: unknown }): boolean => {
    const fee = Number(expert?.remuneration);
    return !Number.isFinite(fee) || fee <= 0;
};
