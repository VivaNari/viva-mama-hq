/**
 * The Meet space service exists to be *unreliable safely*: a booking has already taken
 * money or a credit by the time it runs, so its contract is "return a link or return
 * null, never throw". These tests pin that contract, because every caller depends on it
 * and a thrown error would unwind a paid booking.
 */

const mockRequest = jest.fn();
// Declared out here so it survives jest.resetModules() — the factory below is hoisted,
// which is why both names have to start with "mock".
const mockJwtConstructor = jest.fn((opts: any) => ({ ...opts, request: mockRequest }));

jest.mock("google-auth-library", () => ({
    __esModule: true,
    JWT: mockJwtConstructor,
}));

const SA_KEY = JSON.stringify({
    client_email: "meet-link-creator@vivamama-prod-100.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n",
});

/**
 * The service caches its JWT client in module state, so each case needs a fresh module
 * registry — otherwise a client built under one env config leaks into the next test.
 */
function loadService(env: Record<string, unknown>) {
    jest.resetModules();
    mockRequest.mockReset();
    mockJwtConstructor.mockClear();

    jest.doMock("../src/config/env", () => ({
        __esModule: true,
        default: {
            GOOGLE_MEET_ENABLED: false,
            GOOGLE_MEET_IMPERSONATED_USER: undefined,
            GOOGLE_MEET_SA_KEY_JSON: undefined,
            ...env,
        },
    }));

    // require, not import(): this suite runs as CommonJS, where a dynamic import needs
    // --experimental-vm-modules.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../src/services/google-meet/meet-space.service").meetSpaceService;
}

const enabledEnv = {
    GOOGLE_MEET_ENABLED: true,
    GOOGLE_MEET_IMPERSONATED_USER: "consultations@vivamama.in",
    GOOGLE_MEET_SA_KEY_JSON: SA_KEY,
};

const okResponse = {
    data: {
        name: "spaces/LLBNczMx8-8B",
        meetingUri: "https://meet.google.com/knh-fyph-cuc",
        meetingCode: "knh-fyph-cuc",
        config: { accessType: "OPEN", entryPointAccess: "ALL" },
    },
};

beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("createMeetSpace — happy path", () => {
    it("returns the join URL and the space handle", async () => {
        const service = loadService(enabledEnv);
        mockRequest.mockResolvedValue(okResponse);

        expect(await service.createMeetSpace()).toEqual({
            meetingUri: "https://meet.google.com/knh-fyph-cuc",
            spaceName: "spaces/LLBNczMx8-8B",
        });
    });

    it("asks for an OPEN space", async () => {
        const service = loadService(enabledEnv);
        mockRequest.mockResolvedValue(okResponse);

        await service.createMeetSpace();

        // OPEN is the entire reason for using this API over a Calendar event. Anything
        // else drops an external patient into a lobby to wait for the doctor to admit
        // them, which is precisely the flow this feature promises to avoid.
        expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                url: "https://meet.googleapis.com/v2/spaces",
                method: "POST",
                data: { config: { accessType: "OPEN", entryPointAccess: "ALL" } },
            }),
        );
    });

    it("impersonates the workspace user with the space-created scope", async () => {
        const service = loadService(enabledEnv);
        mockRequest.mockResolvedValue(okResponse);

        await service.createMeetSpace();

        // The scope is principal-scoped: without `subject` the service account is acting
        // as itself and cannot create spaces at all.
        expect(mockJwtConstructor).toHaveBeenCalledWith(
            expect.objectContaining({
                subject: "consultations@vivamama.in",
                scopes: ["https://www.googleapis.com/auth/meetings.space.created"],
            }),
        );
    });

    it("builds the client once and reuses it across bookings", async () => {
        const service = loadService(enabledEnv);
        mockRequest.mockResolvedValue(okResponse);

        await service.createMeetSpace();
        await service.createMeetSpace();
        await service.createMeetSpace();

        // The JWT client caches its access token; rebuilding it per booking would mean a
        // fresh token round-trip on every consultation.
        expect(mockJwtConstructor).toHaveBeenCalledTimes(1);
        expect(mockRequest).toHaveBeenCalledTimes(3);
    });
});

describe("createMeetSpace — degrades to null, never throws", () => {
    it("returns null when the feature is switched off", async () => {
        const service = loadService({ GOOGLE_MEET_ENABLED: false });

        expect(await service.createMeetSpace()).toBeNull();
        // The kill switch must not reach Google at all.
        expect(mockRequest).not.toHaveBeenCalled();
        expect(mockJwtConstructor).not.toHaveBeenCalled();
    });

    it.each([
        ["the key JSON is missing", { ...enabledEnv, GOOGLE_MEET_SA_KEY_JSON: undefined }],
        [
            "the impersonated user is missing",
            { ...enabledEnv, GOOGLE_MEET_IMPERSONATED_USER: undefined },
        ],
    ])("returns null when %s", async (_label, env) => {
        const service = loadService(env);

        expect(await service.createMeetSpace()).toBeNull();
        expect(mockRequest).not.toHaveBeenCalled();
    });

    it("returns null when the key JSON is unparseable", async () => {
        const service = loadService({ ...enabledEnv, GOOGLE_MEET_SA_KEY_JSON: "{not json" });

        expect(await service.createMeetSpace()).toBeNull();
    });

    it("returns null when the Meet API rejects the call", async () => {
        const service = loadService(enabledEnv);
        mockRequest.mockRejectedValue({
            response: { data: { error: { code: 403, message: "PERMISSION_DENIED" } } },
        });

        // A booking is already paid for by this point — a Google outage degrades to
        // "link to follow", it does not fail the booking.
        await expect(service.createMeetSpace()).resolves.toBeNull();
    });

    it("returns null when the response carries no meetingUri", async () => {
        const service = loadService(enabledEnv);
        mockRequest.mockResolvedValue({ data: { name: "spaces/abc" } });

        // A space with no join URL is useless to the patient, and storing it would show
        // an enabled Join button that goes nowhere.
        expect(await service.createMeetSpace()).toBeNull();
    });
});
