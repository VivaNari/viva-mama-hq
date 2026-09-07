/**
 * Frontend test: Products screen (VivaClub Community — Activity 1).
 *
 * Verifies:
 *  - The screen fetches the affiliate catalog on mount and renders product names.
 *  - The Amazon Associates disclaimer is shown (compliance requirement).
 *  - The search box filters the rendered list by product name.
 *
 * Mocks the getUserProducts API and navigation so the test is hermetic.
 * Matches the repo convention (@testing-library/react-native, see LoginwithPhone.test.tsx).
 *
 * Run:  npx jest Products
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import Products from "../src/screens/Products";

const mockProducts = [
    {
        _id: "p1",
        productName: "Nursing Pillow",
        productAffiliateLink: "https://www.amazon.in/dp/B0NURSING",
        productImageURL: "https://cdn.vivamama.app/p1.jpg",
        userCategory: "PP",
        validWeekStart: 1,
        validWeekEnd: 12,
        productCategory: "Feeding",
        productDescription: "Ergonomic feeding support pillow.",
        productPriceRange: "₹999 - ₹1499",
        safetyFlag: "Consult your doctor before use.",
    },
    {
        _id: "p2",
        productName: "Postpartum Belt",
        productAffiliateLink: "https://www.amazon.in/dp/B0BELT",
        productImageURL: "https://cdn.vivamama.app/p2.jpg",
        userCategory: "PP",
        validWeekStart: 1,
        validWeekEnd: 6,
        productCategory: "Recovery",
        productDescription: "Abdominal support belt.",
        productPriceRange: "₹799 - ₹1299",
        safetyFlag: "Avoid without doctor approval after a C-section.",
    },
];

jest.mock("../src/api/getUserProducts", () => ({
    getUserProducts: jest.fn(() =>
        Promise.resolve({ statusCode: 200, success: true, message: "ok", data: mockProducts }),
    ),
}));

// Spread the real module rather than replacing it: Products pulls in
// useScreenEdges -> @react-navigation/bottom-tabs, which reads createScreenFactory
// from this module at import time and would get undefined from a bare stub.
// Each ItemProduct row reads openPaywall() to gate locked products. This suite
// covers the catalog list, not the paywall, so a bare stub is enough.
jest.mock("../src/context/SubscriptionContext", () => ({
    useSubscriptionContext: () => ({ openPaywall: jest.fn() }),
}));

// Products re-fetches the catalog whenever the active language changes; it only
// reads `language`, so a fixed stub keeps the effect deterministic.
jest.mock("../src/context/LanguageContext", () => ({
    useLanguage: () => ({ language: "en" }),
}));

jest.mock("@react-navigation/native", () => ({
    ...jest.requireActual("@react-navigation/native"),
    useNavigation: () => ({ navigate: jest.fn() }),
}));

// The first render in the suite pays a one-time cold-start cost (Babel transform,
// RN module init), so allow generous timeouts; subsequent tests run warm and fast.
jest.setTimeout(30000);
const WAIT = { timeout: 15000 };

describe("Products screen", () => {
    it("loads the affiliate catalog and renders product names", async () => {
        const { findByText } = render(<Products />);
        // findByText polls with its own timeout — robust against the cold-start delay.
        expect(await findByText("Nursing Pillow", {}, WAIT)).toBeTruthy();
        expect(await findByText("Postpartum Belt", {}, WAIT)).toBeTruthy();
    }, 30000);

    it("shows the Amazon Associates affiliate disclaimer", async () => {
        const { findByText } = render(<Products />);
        expect(await findByText(/Amazon Associates Program/i, {}, WAIT)).toBeTruthy();
    }, 30000);

    it("filters the list when the user types in the search box", async () => {
        const { getByText, queryByText, findByText, UNSAFE_getByType } = render(<Products />);
        await findByText("Nursing Pillow", {}, WAIT);

        // SearchInput wraps a TextInput; type a query that matches only one product.
        const { TextInput } = require("react-native");
        const input = UNSAFE_getByType(TextInput);
        fireEvent.changeText(input, "belt");

        await waitFor(() => {
            expect(getByText("Postpartum Belt")).toBeTruthy();
            expect(queryByText("Nursing Pillow")).toBeNull();
        });
    });
});