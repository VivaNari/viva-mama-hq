/**
 * Automation test — MoodLog screen (mood-log module, frontend).
 *
 * Verifies the screen against the real component code:
 *  - loads existing logs on mount and renders the selector + prompt,
 *  - selecting a face then "Save mood" calls upsertMoodLog(mood, todayKey),
 *  - when a log already exists for the day, the button reads "Update mood",
 *    a "Remove this log" action appears, and pressing it calls deleteMoodLog(todayKey).
 *
 * Mocks only what the global jest.setup.js does not already cover: the mood API,
 * AuthContext, the sqlite cache, Lucide icons and safe-area-context. LinearGradient,
 * datetimepicker, vector-icons(MDI) and Toast are mocked globally.
 *
 * Run:  npx jest MoodLog
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import MoodLog from "../src/screens/MoodLog";
import { EMood } from "../src/types/moodLog.types";
import { toISODateKey, startOfDay } from "../src/utils/dateKey";

const { getMoodLogs, upsertMoodLog, deleteMoodLog } = require("../src/api/moodLog.api");

jest.mock("../src/api/moodLog.api", () => ({
    getMoodLogs: jest.fn(),
    upsertMoodLog: jest.fn(),
    deleteMoodLog: jest.fn(),
}));

jest.mock("../src/context/AuthContext", () => ({
    useAuth: () => ({ userId: "u1" }),
}));

jest.mock("../src/db/sqlite", () => ({
    chatDB: { getUserData: jest.fn().mockResolvedValue(null) },
}));

jest.mock("@react-native-vector-icons/lucide", () => {
    const React = require("react");
    return { Lucide: (props: any) => React.createElement("Icon", props) };
});

jest.mock("react-native-safe-area-context", () => {
    const { View } = require("react-native");
    return {
        SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
        SafeAreaProvider: ({ children }: any) => <>{children}</>,
        useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    };
});

const TODAY_KEY = toISODateKey(startOfDay(new Date()));

jest.setTimeout(30000);
const WAIT = { timeout: 15000 };

describe("MoodLog screen", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getMoodLogs.mockResolvedValue([]);
        upsertMoodLog.mockResolvedValue({
            _id: "m1",
            userId: "u1",
            mood: EMood.HAPPY,
            logDate: TODAY_KEY,
            createdAt: "",
            updatedAt: "",
        });
        deleteMoodLog.mockResolvedValue(undefined);
    });

    it("loads logs on mount and renders the prompt and mood faces", async () => {
        const { findByText, getByText } = render(<MoodLog />);

        expect(await findByText("How are you feeling?", {}, WAIT)).toBeTruthy();
        expect(getByText("Happy")).toBeTruthy();
        expect(getByText("Very sad")).toBeTruthy();
        expect(getMoodLogs).toHaveBeenCalled();
    });

    it("saves the selected mood for today", async () => {
        const { findByText, getByText } = render(<MoodLog />);
        await findByText("How are you feeling?", {}, WAIT);

        fireEvent.press(getByText("Happy")); // select a face
        fireEvent.press(getByText("Save mood")); // submit

        await waitFor(() => {
            expect(upsertMoodLog).toHaveBeenCalledWith(EMood.HAPPY, TODAY_KEY);
        });
    });

    it("shows Update/Remove and deletes when a log already exists for the day", async () => {
        getMoodLogs.mockResolvedValue([
            {
                _id: "m1",
                userId: "u1",
                mood: EMood.SAD,
                logDate: TODAY_KEY,
                createdAt: "",
                updatedAt: "",
            },
        ]);

        const { findByText, getByText } = render(<MoodLog />);

        // Existing log → primary action becomes "Update mood" and a remove action appears.
        expect(await findByText("Update mood", {}, WAIT)).toBeTruthy();
        const remove = getByText("Remove this log");

        fireEvent.press(remove);
        await waitFor(() => {
            expect(deleteMoodLog).toHaveBeenCalledWith(TODAY_KEY);
        });
    });
});
