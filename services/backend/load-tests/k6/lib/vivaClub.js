/**
 * VivaClub Community endpoint helpers for k6 (Milestone 5).
 *
 * Reuses the Bearer pattern from lib/auth.js. All routes require a JWT obtained
 * from the OTP login flow (see lib/auth.js -> loginWithOtp).
 *
 * Endpoints covered:
 *   GET  /api/v1/products
 *   GET  /api/v1/products/:id
 *   GET  /api/v1/viva-club/posts?page&limit
 *   POST /api/v1/viva-club/posts
 *   POST /api/v1/viva-club/posts/:id/comments
 *   POST /api/v1/viva-club/posts/:id/like
 */

import http from "k6/http";
import { authHeader } from "./auth.js";

/** GET /api/v1/products */
export function getProducts(baseUrl, token) {
    return http.get(`${baseUrl}/api/v1/products`, {
        ...authHeader(token),
        tags: { name: "products_list" },
    });
}

/** GET /api/v1/products/:id */
export function getProductById(baseUrl, token, id) {
    return http.get(`${baseUrl}/api/v1/products/${id}`, {
        ...authHeader(token),
        tags: { name: "products_detail" },
    });
}

/** GET /api/v1/viva-club/posts?page&limit */
export function getPosts(baseUrl, token, page = 1, limit = 10) {
    return http.get(`${baseUrl}/api/v1/viva-club/posts?page=${page}&limit=${limit}`, {
        ...authHeader(token),
        tags: { name: "vivaclub_posts_list" },
    });
}

/** POST /api/v1/viva-club/posts */
export function createPost(baseUrl, token, content) {
    return http.post(`${baseUrl}/api/v1/viva-club/posts`, JSON.stringify({ content }), {
        ...authHeader(token),
        tags: { name: "vivaclub_create_post" },
    });
}

/** POST /api/v1/viva-club/posts/:id/comments */
export function addComment(baseUrl, token, postId, content) {
    return http.post(`${baseUrl}/api/v1/viva-club/posts/${postId}/comments`, JSON.stringify({ content }), {
        ...authHeader(token),
        tags: { name: "vivaclub_add_comment" },
    });
}

/** POST /api/v1/viva-club/posts/:id/like */
export function toggleLike(baseUrl, token, postId) {
    return http.post(`${baseUrl}/api/v1/viva-club/posts/${postId}/like`, null, {
        ...authHeader(token),
        tags: { name: "vivaclub_toggle_like" },
    });
}

/** Safely parse the first post id from a getPosts() response, or null. */
export function firstPostId(res) {
    if (res.status !== 200 || !res.body) return null;
    try {
        const body = JSON.parse(res.body);
        const posts = body?.data?.posts;
        return Array.isArray(posts) && posts.length > 0 ? posts[0]._id : null;
    } catch {
        return null;
    }
}
