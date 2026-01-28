// Mock env BEFORE importing sendSMS
jest.mock("../src/config/env", () => ({
    __esModule: true,
    default: {
        TWILIO_ACCOUNT_SID: "sid",
        TWILIO_AUTH_TOKEN: "token",
        TWILIO_PHONE_NUMBER: "+10000000000",
    },
}));

// Global mockCreate shared between tests
const mockCreate = jest.fn();

// Mock Twilio BEFORE importing sendSMS
jest.mock("twilio", () => {
    return jest.fn(() => ({
        messages: {
            create: mockCreate,
        },
    }));
});

import sendSMS from "../src/services/twilio/sendSMS"; // adjust path

describe("sendSMS()", () => {
    beforeEach(() => {
        mockCreate.mockReset();
    });

    it("returns true when Twilio sends SMS successfully", async () => {
        mockCreate.mockResolvedValue({ sid: "SM123" });

        const result = await sendSMS("+911234567890", "Hello!");

        expect(result).toBe(true);
        expect(mockCreate).toHaveBeenCalledTimes(1);
        expect(mockCreate).toHaveBeenCalledWith({
            body: "Hello!",
            from: "+10000000000", //comes from mocked env
            to: "+911234567890",
        });
    });

    it("returns false when Twilio throws an error", async () => {
        mockCreate.mockRejectedValue(new Error("Twilio failure"));

        const result = await sendSMS("+911234567890", "Hello!");

        expect(result).toBe(false);
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });
});
