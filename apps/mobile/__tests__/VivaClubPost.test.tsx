/**
 * Frontend test: VivaClub community (VivaClub Community — Activity 2).
 *
 * Covers the discussion-forum screens that previously had no app-side Jest test:
 *  - VivaClubPost feed loads on focus and renders each post's author + content.
 *  - Empty feed renders no post content (no crash).
 *  - FLVivaClubPostItem "like" control calls the toggle-like endpoint.
 *
 * Mocks: the API client, navigation hooks (useNavigation / useFocusEffect), and
 * safe-area-context. LinearGradient and vector icons are already mocked globally
 * in jest.setup.js, so they are not re-mocked here.
 *
 * Run:  npx jest VivaClubPost
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import VivaClubPost from "../src/screens/VivaClubPost";
import FLVivaClubPostItem from "../src/components/vivaClub/FLVivaClubPostItem";

// ---- API client mock (default export is a factory returning { get, post }) ----
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock("../src/api/apiClientInterceptor", () => ({
    __esModule: true,
    default: () => ({ get: mockGet, post: mockPost }),
}));

// ---- Navigation mock: run the focus callback immediately so the feed fetches ----
jest.mock("@react-navigation/native", () => {
    const React = require("react");
    return {
        useNavigation: () => ({ navigate: jest.fn() }),
        useFocusEffect: (cb: () => void) => React.useEffect(cb, []),
    };
});

// ---- safe-area-context: passthrough so SafeAreaView renders without a provider ----
jest.mock("react-native-safe-area-context", () => {
    const { View } = require("react-native");
    return {
        SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
        SafeAreaProvider: ({ children }: any) => <>{children}</>,
        useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    };
});

const makePost = (over = {}) => ({
    _id: "post1",
    user: { _id: "u_author", user_name: "Asha" },
    content: "First night with the baby — any tips?",
    isLiked: false,
    totalLikes: 7,
    commentCount: 2,
    mediaUrls: [],
    createdAt: new Date("2026-05-01T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-05-01T10:00:00Z").toISOString(),
    ...over,
});

const feedResponse = (posts: any[], totalPages = 1) => ({
    data: { data: { posts, pagination: { currentPage: 1, totalPages, totalPosts: posts.length, limit: 10 } } },
});

jest.setTimeout(30000);
const WAIT = { timeout: 15000 };

describe("VivaClub community", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("loads the feed on focus and renders author + content", async () => {
        mockGet.mockResolvedValue(feedResponse([makePost(), makePost({ _id: "post2", user: { _id: "u2", user_name: "Meera" }, content: "Loving the support here." })]));

        const { findByText } = render(<VivaClubPost />);

        expect(await findByText("Asha", {}, WAIT)).toBeTruthy();
        expect(await findByText("First night with the baby — any tips?", {}, WAIT)).toBeTruthy();
        expect(await findByText("Meera", {}, WAIT)).toBeTruthy();
        expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("/posts?page=1&limit=10"));
    });

    it("renders no post content when the feed is empty", async () => {
        mockGet.mockResolvedValue(feedResponse([]));

        const { queryByText } = render(<VivaClubPost />);

        await waitFor(() => expect(mockGet).toHaveBeenCalled());
        expect(queryByText("First night with the baby — any tips?")).toBeNull();
    });

    it("calls the toggle-like endpoint when the like control is pressed", async () => {
        mockPost.mockResolvedValue({ data: { success: true } });

        // Render the item directly with a known like count to target the control reliably.
        const { getByText } = render(
            <FLVivaClubPostItem item={makePost({ totalLikes: 7 }) as any} navigation={{ navigate: jest.fn() }} />,
        );

        // The like count Text sits inside the like TouchableOpacity; pressing it bubbles to onPress.
        fireEvent.press(getByText("7"));

        await waitFor(() => {
            expect(mockPost).toHaveBeenCalledTimes(1);
            expect(mockPost).toHaveBeenCalledWith(expect.stringContaining("/posts/post1/like"));
        });
    });
});