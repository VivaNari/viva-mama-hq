import { FilterQuery } from "mongoose";
import expertModel from "../../models/expert.model";
import organizationModel from "../../models/organization.model";
import referralProgramModel from "../../models/referral-program.model";
import referralRedemptionModel from "../../models/referral-redemption.model";
import {
    EReferralOwnerType,
    EReferralRedemptionStatus,
    IOrganization,
    IReferralProgram,
    IReferralRedemption,
} from "../../types/referral.types";
import { TObjectIdLike } from "../../types/subscription.types";
import { ReferralError, normalizeCode } from "./referral.service";

export interface IPaged<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
}

function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Admin-side reads and writes for organizations, referral programs and the redemption
 * ledger. Kept apart from ReferralService, which owns the redemption path — mixing the
 * two would put a dozen CRUD methods in front of the code that has to stay easy to
 * audit.
 */
export class ReferralAdminService {
    // ── Organizations ───────────────────────────────────────────────────────────

    public async createOrganization(input: Partial<IOrganization>): Promise<IOrganization> {
        const slug = normalizeSlug(input.slug, input.name);

        const existing = await organizationModel.findOne({ slug }).lean();
        if (existing) {
            throw new ReferralError(
                "ORGANIZATION_SLUG_TAKEN",
                `An organization with slug "${slug}" already exists`,
                409,
            );
        }

        return (await organizationModel.create({
            ...input,
            slug,
        })) as unknown as IOrganization;
    }

    public async listOrganizations({
        page = 1,
        limit = 20,
        isActive,
        q,
    }: {
        page?: number | undefined;
        limit?: number | undefined;
        isActive?: boolean | undefined;
        q?: string | undefined;
    }): Promise<IPaged<IOrganization>> {
        const filter: FilterQuery<IOrganization> = {};
        if (isActive != null) filter.isActive = isActive;
        if (q) filter.name = { $regex: q, $options: "i" };

        const [items, total] = await Promise.all([
            organizationModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            organizationModel.countDocuments(filter),
        ]);

        return { items: items as IOrganization[], total, page, limit };
    }

    public async getOrganization(id: TObjectIdLike): Promise<IOrganization> {
        const org = await organizationModel.findById(id).lean();
        if (!org) throw new ReferralError("ORGANIZATION_NOT_FOUND", "Organization not found", 404);
        return org as IOrganization;
    }

    public async updateOrganization(
        id: TObjectIdLike,
        patch: Partial<IOrganization>,
    ): Promise<IOrganization> {
        const updated = await organizationModel
            .findByIdAndUpdate(id, { $set: patch }, { new: true })
            .lean();
        if (!updated) {
            throw new ReferralError("ORGANIZATION_NOT_FOUND", "Organization not found", 404);
        }
        return updated as IOrganization;
    }

    // ── Programs ────────────────────────────────────────────────────────────────

    /**
     * Joi cannot check that a referenced expert or organization actually exists, so the
     * owner is resolved here. A program pointing at a deleted owner would redeem fine
     * and pin nobody, which is the kind of failure that only shows up in support.
     */
    private async assertOwner(
        ownerType: EReferralOwnerType,
        expertId?: TObjectIdLike | null,
        organizationId?: TObjectIdLike | null,
    ): Promise<void> {
        if (ownerType === EReferralOwnerType.EXPERT) {
            const expert = await expertModel.findById(expertId).select("_id").lean();
            if (!expert) throw new ReferralError("EXPERT_NOT_FOUND", "Expert not found", 404);
            return;
        }

        const org = await organizationModel.findById(organizationId).select("_id isActive").lean();
        if (!org) {
            throw new ReferralError("ORGANIZATION_NOT_FOUND", "Organization not found", 404);
        }
    }

    public async createProgram(input: {
        code: string;
        ownerType: EReferralOwnerType;
        expertId?: string | null;
        organizationId?: string | null;
        displayName?: string | null;
        isActive?: boolean;
        startsAt?: Date | null;
        endsAt?: Date | null;
        grant?: { planCode?: string | null };
        seats?: { total?: number | null };
        entitlementOverrides?: any[];
    }): Promise<IReferralProgram> {
        const code = normalizeCode(input.code);
        await this.assertOwner(input.ownerType, input.expertId, input.organizationId);

        try {
            return (await referralProgramModel.create({
                code,
                ownerType: input.ownerType,
                owner_expert_id:
                    input.ownerType === EReferralOwnerType.EXPERT ? input.expertId : null,
                owner_organization_id:
                    input.ownerType === EReferralOwnerType.ORGANIZATION
                        ? input.organizationId
                        : null,
                displayName: input.displayName ?? null,
                isActive: input.isActive ?? true,
                startsAt: input.startsAt ?? null,
                endsAt: input.endsAt ?? null,
                benefits: {
                    grant: { planCode: input.grant?.planCode ?? null },
                    seats: { total: input.seats?.total ?? null, claimed: 0 },
                    entitlementOverrides: input.entitlementOverrides ?? [],
                },
            })) as unknown as IReferralProgram;
        } catch (err: any) {
            if (err?.code === 11000) {
                throw new ReferralError(
                    "REFERRAL_CODE_TAKEN",
                    `Referral code ${code} already exists`,
                    409,
                );
            }
            throw err;
        }
    }

    public async listPrograms({
        page = 1,
        limit = 20,
        ownerType,
        isActive,
        q,
    }: {
        page?: number | undefined;
        limit?: number | undefined;
        ownerType?: EReferralOwnerType | undefined;
        isActive?: boolean | undefined;
        q?: string | undefined;
    }): Promise<IPaged<IReferralProgram & { seatsRemaining: number | null }>> {
        const filter: FilterQuery<IReferralProgram> = {};
        if (ownerType) filter.ownerType = ownerType;
        if (isActive != null) filter.isActive = isActive;
        if (q) filter.code = { $regex: q, $options: "i" };

        const [items, total] = await Promise.all([
            referralProgramModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            referralProgramModel.countDocuments(filter),
        ]);

        return {
            items: (items as IReferralProgram[]).map((p) => ({
                ...p,
                seatsRemaining: seatsRemaining(p),
            })),
            total,
            page,
            limit,
        };
    }

    public async getProgram(
        id: TObjectIdLike,
    ): Promise<IReferralProgram & { seatsRemaining: number | null }> {
        const program = (await referralProgramModel.findById(id).lean()) as IReferralProgram | null;
        if (!program) {
            throw new ReferralError("REFERRAL_PROGRAM_NOT_FOUND", "Referral program not found", 404);
        }
        return { ...program, seatsRemaining: seatsRemaining(program) };
    }

    /**
     * Partial update. `code` and `benefits.seats.claimed` are rejected by the validator,
     * not filtered here — the code is denormalized onto every redemption row, and
     * `claimed` is the live concurrency counter.
     */
    public async updateProgram(id: TObjectIdLike, patch: Record<string, unknown>): Promise<IReferralProgram> {
        const updated = await referralProgramModel
            .findByIdAndUpdate(id, { $set: patch }, { new: true })
            .lean();
        if (!updated) {
            throw new ReferralError("REFERRAL_PROGRAM_NOT_FOUND", "Referral program not found", 404);
        }
        return updated as IReferralProgram;
    }

    /**
     * Top a pool up additively.
     *
     * The only way to change `seats.total`, and the reason PATCH forbids it: two admins
     * each setting an absolute value from a stale read would lose one another's write,
     * whereas two `$inc`s both land.
     */
    public async addSeats(id: TObjectIdLike, addSeats: number): Promise<IReferralProgram> {
        const program = (await referralProgramModel.findById(id).lean()) as IReferralProgram | null;
        if (!program) {
            throw new ReferralError("REFERRAL_PROGRAM_NOT_FOUND", "Referral program not found", 404);
        }
        if (program.benefits.seats.total == null) {
            throw new ReferralError(
                "REFERRAL_SEATS_UNLIMITED",
                "That program has an unlimited pool; there is nothing to top up",
                409,
            );
        }

        return (await referralProgramModel
            .findByIdAndUpdate(
                id,
                { $inc: { "benefits.seats.total": addSeats } },
                { new: true },
            )
            .lean()) as unknown as IReferralProgram;
    }

    // ── Redemptions ─────────────────────────────────────────────────────────────

    public async programUsage(id: TObjectIdLike): Promise<{
        seats: { total: number | null; claimed: number; remaining: number | null };
        redemptions: { total: number; granted: number; skipped: number; failed: number };
    }> {
        const program = await this.getProgram(id);

        const rows = await referralRedemptionModel.aggregate([
            { $match: { program_id: program._id } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ]);

        const byStatus = new Map<string, number>(rows.map((r) => [r._id, r.count]));
        const granted = await referralRedemptionModel.countDocuments({
            program_id: program._id,
            granted_subscription_id: { $ne: null },
        });
        const total = [...byStatus.values()].reduce((a, b) => a + b, 0);
        const failed = byStatus.get(EReferralRedemptionStatus.FAILED) ?? 0;

        return {
            seats: {
                total: program.benefits.seats.total,
                claimed: program.benefits.seats.claimed,
                remaining: program.seatsRemaining,
            },
            redemptions: { total, granted, skipped: total - granted - failed, failed },
        };
    }

    /**
     * The redemption browser.
     *
     * Mobile numbers are masked. An admin needs to recognise a user in a support thread,
     * not to read out a directory of every mother a partner referred.
     */
    public async listRedemptions({
        page = 1,
        limit = 20,
        programId,
        code,
        status,
        from,
        to,
    }: {
        page?: number | undefined;
        limit?: number | undefined;
        programId?: string | undefined;
        code?: string | undefined;
        status?: EReferralRedemptionStatus | undefined;
        from?: Date | undefined;
        to?: Date | undefined;
    }): Promise<IPaged<Record<string, unknown>>> {
        const filter: FilterQuery<IReferralRedemption> = {};
        if (programId) filter.program_id = programId as any;
        if (code) filter.code = normalizeCode(code);
        if (status) filter.status = status;
        if (from || to) {
            filter.redeemedAt = {
                ...(from ? { $gte: from } : {}),
                ...(to ? { $lte: to } : {}),
            } as any;
        }

        const [items, total] = await Promise.all([
            referralRedemptionModel
                .find(filter)
                .sort({ redeemedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate("user_id", "user_id mobile_number email")
                .lean(),
            referralRedemptionModel.countDocuments(filter),
        ]);

        return {
            items: (items as any[]).map((row) => ({
                ...row,
                user_id: row.user_id
                    ? {
                          _id: row.user_id._id,
                          user_id: row.user_id.user_id,
                          mobile_number: maskMobile(row.user_id.mobile_number),
                      }
                    : null,
            })),
            total,
            page,
            limit,
        };
    }
}

function seatsRemaining(program: IReferralProgram): number | null {
    const total = program.benefits?.seats?.total;
    if (total == null) return null;
    return Math.max(0, total - (program.benefits.seats.claimed ?? 0));
}

/** `+919876543210` → `+91••••••3210`. Enough to recognise, not enough to dial a list. */
function maskMobile(mobile?: string | null): string | null {
    if (!mobile) return null;
    const tail = mobile.slice(-4);
    return `${mobile.slice(0, Math.max(0, mobile.length - 8))}••••${tail}`;
}

function normalizeSlug(slug: string | undefined | null, name: string | undefined): string {
    const source = slug?.trim() || name || "";
    const normalized = slugify(source);
    if (!normalized) {
        throw new ReferralError("ORGANIZATION_SLUG_INVALID", "A usable slug is required", 400);
    }
    return normalized;
}

export const referralAdminService = new ReferralAdminService();
