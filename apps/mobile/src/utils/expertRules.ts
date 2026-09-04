import { IExpert } from '../types/expert.types';

/**
 * Whether this expert consults in person only, and takes no bookings through the app.
 *
 * A remuneration of zero is not a free online consultation — it is how a referring
 * doctor who sees her own patients at her own clinic is recorded. Razorpay cannot raise
 * an order for ₹0 and a plan credit would buy a session nobody arranged, so both booking
 * routes are closed and the profile offers to meet her in person instead.
 *
 * Such a doctor is served only to her own referred patients: the server drops her from
 * everyone else's directory (ExpertService.getVisibleExperts), so anywhere this returns
 * true the expert is, by construction, this user's own doctor.
 *
 * Read defensively rather than as `=== 0`: an absent or non-numeric fee is just as
 * unbookable as an explicit zero, and matches the server's own guard.
 */
export const isInPersonOnlyExpert = (
    expert: Pick<IExpert, 'remuneration'> | undefined | null,
): boolean => {
    const fee = Number(expert?.remuneration);
    return !Number.isFinite(fee) || fee <= 0;
};
