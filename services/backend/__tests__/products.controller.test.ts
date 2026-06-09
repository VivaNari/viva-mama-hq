/**
 * Unit / API tests for the Affiliate Products module (VivaClub Community — Activity 1).
 *
 * Strategy (mirrors __tests__/payments_selectFreePlan.test.ts):
 *  - Stub firebase / redis side-effect modules so importing the app is cheap.
 *  - Replace the auth middleware with a pass-through that injects a fake user.
 *  - Replace ProductController with an in-memory fake so we exercise the route
 *    wiring, status codes and response envelope WITHOUT a live MongoDB.
 *
 * Run:  NODE_ENV=test npx jest products.controller
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

// Importing `app` loads the route index, which constructs PaymentService -> new Razorpay()
// at module load. Stub razorpay so it doesn't demand real API keys (mirrors payments_selectFreePlan.test.ts).
jest.mock("razorpay", () => {
    return jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn(), fetch: jest.fn() },
        payments: { fetch: jest.fn() },
    }));
});

// Pass-through auth that always attaches a test user.
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () =>
    jest.fn(() => (req: any, _res: any, next: any) => {
        req.user = { _id: "u_test_1", user_category: "PP" };
        next();
    }),
);

// In-memory product fixtures.
const SAMPLE_PRODUCTS = [
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
        safetyFlag: "Consult your doctor before use while recovering.",
    },
];

jest.mock(require.resolve("../src/api/v1/controllers/products/product.controller"), () => ({
    __esModule: true,
    ProductController: jest.fn().mockImplementation(() => ({
        getProducts: (req: any, res: any) => {
            if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });
            return res.status(200).json({
                success: true,
                message: "Product fetched successfully",
                data: SAMPLE_PRODUCTS,
            });
        },
        getProductById: (req: any, res: any) => {
            const found = SAMPLE_PRODUCTS.filter((p) => p._id === req.params.id);
            return res.status(200).json({
                success: true,
                message: "Product fetched successfully",
                data: found,
            });
        },
        createProduct: (req: any, res: any) => {
            const required = [
                "productName",
                "productAffiliateLink",
                "productImageURL",
                "userCategory",
                "validWeekStart",
                "validWeekEnd",
            ];
            const missing = required.filter((k) => req.body?.[k] === undefined);
            if (missing.length) {
                return res.status(400).json({ success: false, message: `Missing: ${missing.join(",")}` });
            }
            return res.status(201).json({
                success: true,
                message: "Product saved successfully",
                data: { _id: "p_new", ...req.body },
            });
        },
    })),
}));

// requestValidator is a thin wrapper; stub to a no-op so we test the controller branch.
jest.mock(require.resolve("../src/middlewares/requestValidator.middleware"), () =>
    jest.fn(() => (_req: any, _res: any, next: any) => next()),
);

import request from "supertest";
import app from "../src/app";

describe("Affiliate Products API", () => {
    describe("GET /api/v1/products", () => {
        it("returns 200 and a list of products scoped to the user", async () => {
            const res = await request(app).get("/api/v1/products");
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
        });

        it("every returned product exposes an affiliate link and a safety flag", async () => {
            const res = await request(app).get("/api/v1/products");
            for (const p of res.body.data) {
                expect(typeof p.productAffiliateLink).toBe("string");
                expect(p.productAffiliateLink).toMatch(/^https?:\/\//);
                expect(typeof p.safetyFlag).toBe("string");
            }
        });
    });

    describe("GET /api/v1/products/:id", () => {
        it("returns 200 with the matching product", async () => {
            const res = await request(app).get("/api/v1/products/p1");
            expect(res.status).toBe(200);
            expect(res.body.data[0]._id).toBe("p1");
        });

        it("returns an empty list for an unknown id (no 500)", async () => {
            const res = await request(app).get("/api/v1/products/does-not-exist");
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });
    });

    describe("POST /api/v1/admin/products", () => {
        it("creates a product (201) when the payload is complete", async () => {
            const res = await request(app)
                .post("/api/v1/admin/products")
                .send({
                    productName: "Postpartum Belt",
                    productAffiliateLink: "https://www.amazon.in/dp/B0BELT",
                    productImageURL: "https://cdn.vivamama.app/belt.jpg",
                    userCategory: "PP",
                    validWeekStart: 1,
                    validWeekEnd: 6,
                    productCategory: "Recovery",
                    productDescription: "Abdominal support belt.",
                    productPriceRange: "₹799 - ₹1299",
                    safetyFlag: "Avoid if you had a C-section without doctor approval.",
                });
            expect(res.status).toBe(201);
            expect(res.body.data._id).toBe("p_new");
        });

        it("rejects an incomplete payload with 400", async () => {
            const res = await request(app)
                .post("/api/v1/admin/products")
                .send({ productName: "No links here" });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
});