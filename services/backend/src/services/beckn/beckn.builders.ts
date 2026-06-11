import { BecknRequest } from "../../types/beckn.types";

// ─────────────────────────────────────────────────────────────────────────────
// STUB callback builders: on_select / on_init / on_confirm.
//
// All three share one contract body (catalog detail + participants pulled from the
// incoming request); they differ only in the contract/quote status and the payment
// fields, which is exactly how the reference UC1-B samples progress:
//
//   on_select  → consideration PENDING (a quote)
//   on_init    → consideration QUOTED  + selectedPaymentMethod
//   on_confirm → contract ACTIVE, consideration ACTIVE + paymentAuthorisation
//
// Everything below is PLACEHOLDER pricing/catalog — replace buildContract with a
// real catalog + pricing + payment lookup. The dispatch wiring stays unchanged.
// ─────────────────────────────────────────────────────────────────────────────

const STUB_PRICE_PER_UNIT = 250;
const STUB_CURRENCY = "INR";

const HEALTH_RESOURCE_CTX = "https://schema.beckn.io/HealthResource/v2.1/context.jsonld";
const HEALTH_OFFER_CTX = "https://schema.beckn.io/HealthOffer/v2.1/context.jsonld";
const HEALTH_CONSIDERATION_CTX = "https://schema.beckn.io/HealthConsideration/v2.1/context.jsonld";
const HEALTH_CONTRACT_CTX = "https://schema.beckn.io/HealthContract/v2.1/context.jsonld";

interface ContractOptions {
    contractStatus: string;
    considerationStatus: string;
    considerationExtra?: Record<string, unknown>;
    descriptor?: Record<string, unknown>;
}

const onContext = (select: BecknRequest, action: string): BecknRequest["context"] => ({
    ...(select.context ?? ({} as BecknRequest["context"])),
    action,
    timestamp: new Date().toISOString(),
});

const buildContract = (select: BecknRequest, opts: ContractOptions) => {
    const ctx = select.context ?? ({} as BecknRequest["context"]);
    const inbound: any = (select.message as any)?.contract ?? {};
    const commitment: any = inbound.commitments?.[0] ?? {};

    const resourceId: string = commitment.resources?.[0]?.id ?? "res-stub-001";
    const offerId: string = commitment.offer?.id ?? "offer-stub-001";
    const commitmentId: string = commitment.id ?? "commitment-stub-001";
    const quantityCount: number = commitment.resources?.[0]?.quantity?.count ?? 1;
    const totalAmount = STUB_PRICE_PER_UNIT * quantityCount;
    // Participants already passed schema validation inbound — echo them back as-is.
    const participants: any[] = inbound.participants ?? [];

    return {
        id: inbound.id ?? `contract-${ctx.transactionId ?? "stub"}`,
        status: { code: opts.contractStatus },
        ...(opts.descriptor ? { descriptor: opts.descriptor } : {}),
        commitments: [
            {
                id: commitmentId,
                status: { descriptor: { code: opts.contractStatus } },
                resources: [
                    {
                        id: resourceId,
                        descriptor: {
                            name: "Stub Health Service",
                            shortDesc: "Placeholder service returned by the BPP stub.",
                            longDesc: "Returned by buildContract. Replace with a real catalog lookup.",
                        },
                        resourceAttributes: {
                            "@context": HEALTH_RESOURCE_CTX,
                            "@type": "hr:HealthResource",
                            healthServiceType: "DIAGNOSTIC_ANALYTICS",
                            clinicalDeliveryUnit: "ANALYSIS",
                            serviceUnit: "PER_UNIT",
                            capacityPerDay: 500,
                            minimumBookingAdvanceHours: 0,
                            languagesSupported: ["en"],
                        },
                        quantity: { count: quantityCount },
                    },
                ],
                offer: {
                    id: offerId,
                    resourceIds: [resourceId],
                    descriptor: {
                        name: "Stub Offer — Single Engagement",
                        shortDesc: `Placeholder offer, Rs.${STUB_PRICE_PER_UNIT} per engagement.`,
                    },
                    offerAttributes: {
                        "@context": HEALTH_OFFER_CTX,
                        "@type": "hof:HealthOffer",
                        healthServiceType: "DIAGNOSTIC_ANALYTICS",
                        offerType: "SINGLE_EVENT",
                        minimumQuantity: 1,
                        maximumQuantity: 1,
                        requiresAdvanceBooking: false,
                        validityPeriodDays: 1,
                    },
                    considerations: [
                        {
                            id: "cons-stub-001",
                            considerationAttributes: {
                                "@context": HEALTH_CONSIDERATION_CTX,
                                "@type": "hcn:HealthConsideration",
                                pricePerUnit: STUB_PRICE_PER_UNIT,
                                currency: STUB_CURRENCY,
                                payerArchetype: "SELF",
                                paymentMethodsAccepted: ["UPI", "CASH_VIA_FLW"],
                            },
                        },
                    ],
                },
            },
        ],
        // The quote — its status + payment fields advance per action.
        consideration: [
            {
                id: "consideration-stub-001",
                status: { code: opts.considerationStatus },
                considerationAttributes: {
                    "@context": HEALTH_CONSIDERATION_CTX,
                    "@type": "hcn:HealthConsideration",
                    pricePerUnit: STUB_PRICE_PER_UNIT,
                    currency: STUB_CURRENCY,
                    totalAmount,
                    netAmount: totalAmount,
                    payerArchetype: "SELF",
                    paymentMethodsAccepted: ["UPI", "CASH_VIA_FLW"],
                    ...(opts.considerationExtra ?? {}),
                },
            },
        ],
        participants,
        contractAttributes: {
            "@context": HEALTH_CONTRACT_CTX,
            "@type": "hct:HealthContract",
            healthServiceType: "DIAGNOSTIC_ANALYTICS",
            bookingChannel: "APP",
        },
    };
};

export const buildOnSelectStub = (select: BecknRequest): BecknRequest => ({
    context: onContext(select, "on_select"),
    message: {
        contract: buildContract(select, {
            contractStatus: "DRAFT",
            considerationStatus: "PENDING",
        }),
    },
});

export const buildOnInitStub = (select: BecknRequest): BecknRequest => ({
    context: onContext(select, "on_init"),
    message: {
        contract: buildContract(select, {
            contractStatus: "DRAFT",
            considerationStatus: "QUOTED",
            considerationExtra: { selectedPaymentMethod: "UPI" },
        }),
    },
});

const stubPaymentAuthorisation = (quantityCount: number) => ({
    selectedPaymentMethod: "UPI",
    paymentAuthorisation: {
        authCode: `stub-auth-${Date.now()}`,
        authProvider: "NPCI-UPI",
        authTimestamp: new Date().toISOString(),
        authAmount: STUB_PRICE_PER_UNIT * quantityCount,
    },
});

const quantityOf = (select: BecknRequest): number =>
    (select.message as any)?.contract?.commitments?.[0]?.resources?.[0]?.quantity?.count ?? 1;

export const buildOnConfirmStub = (select: BecknRequest): BecknRequest => ({
    context: onContext(select, "on_confirm"),
    message: {
        contract: buildContract(select, {
            contractStatus: "ACTIVE",
            considerationStatus: "ACTIVE",
            considerationExtra: stubPaymentAuthorisation(quantityOf(select)),
        }),
    },
});

export const buildOnStatusStub = (select: BecknRequest): BecknRequest => ({
    context: onContext(select, "on_status"),
    message: {
        contract: buildContract(select, {
            contractStatus: "COMPLETE",
            considerationStatus: "ACTIVE",
            descriptor: {
                name: "Stub Service — Complete",
                shortDesc: "Placeholder status: engagement complete.",
            },
            considerationExtra: stubPaymentAuthorisation(quantityOf(select)),
        }),
    },
});
