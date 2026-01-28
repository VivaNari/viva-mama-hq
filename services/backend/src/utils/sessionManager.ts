import { Response } from "express";
import logger from "./logger";

/**
 * Pending question data with timestamp for TTL cleanup
 */
interface PendingQuestionData {
    questionId: string;
    week: number;
    timestamp: number;
}

/**
 * Session data with timestamp for TTL cleanup
 */
interface SessionData {
    response: Response;
    timestamp: number;
    week: number;
}

/**
 * SessionManager - Single Responsibility: Manage SSE connections and pending questions
 *
 * Features:
 * - Track active SSE connections
 * - Track pending questions per user
 * - TTL-based cleanup to prevent memory leaks
 */
class SessionManager {
    private activeSessions = new Map<string, SessionData>();
    private pendingQuestions = new Map<string, PendingQuestionData>();

    // Configuration
    private readonly SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
    private readonly PENDING_QUESTION_TTL_MS = 60 * 60 * 1000; // 1 hour
    private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.startCleanupJob();
    }

    // ============================================
    // Session Management
    // ============================================

    /**
     * Register a new SSE connection
     */
    setSession(userId: string, response: Response, week: number): void {
        // Close existing session if any
        this.closeSession(userId);

        this.activeSessions.set(userId, {
            response,
            timestamp: Date.now(),
            week,
        });

        logger.debug({ userId, week }, "Session registered");
    }

    /**
     * Get user's active SSE connection
     */
    getSession(userId: string): Response | undefined {
        const session = this.activeSessions.get(userId);
        return session?.response;
    }

    /**
     * Check if user has an active session
     */
    hasSession(userId: string): boolean {
        return this.activeSessions.has(userId);
    }

    /**
     * Get session week
     */
    getSessionWeek(userId: string): number | undefined {
        return this.activeSessions.get(userId)?.week;
    }

    /**
     * Close and remove a session
     */
    closeSession(userId: string): void {
        const session = this.activeSessions.get(userId);
        if (session) {
            try {
                if (!session.response.writableEnded) {
                    session.response.end();
                }
            } catch (error) {
                // Response might already be closed
                logger.debug({ userId, error }, "Error closing session response");
            }
            this.activeSessions.delete(userId);
            logger.debug({ userId }, "Session closed");
        }
    }

    // ============================================
    // Pending Questions Management
    // ============================================

    /**
     * Set pending question for user
     */
    setPendingQuestion(userId: string, questionId: string, week: number): void {
        this.pendingQuestions.set(userId, {
            questionId,
            week,
            timestamp: Date.now(),
        });
        logger.debug({ userId, questionId, week }, "Pending question set");
    }

    /**
     * Get pending question for user
     */
    getPendingQuestion(userId: string): PendingQuestionData | undefined {
        return this.pendingQuestions.get(userId);
    }

    /**
     * Check if user has pending question for specific week
     */
    hasPendingQuestionForWeek(userId: string, week: number): boolean {
        const pending = this.pendingQuestions.get(userId);
        return pending?.week === week;
    }

    /**
     * Clear pending question for user
     */
    clearPendingQuestion(userId: string): void {
        this.pendingQuestions.delete(userId);
        logger.debug({ userId }, "Pending question cleared");
    }

    // ============================================
    // SSE Utilities
    // ============================================

    /**
     * Write data to user's SSE connection
     */
    writeToSession(userId: string, payload: Record<string, unknown>): boolean {
        const session = this.activeSessions.get(userId);
        if (!session || session.response.writableEnded) {
            return false;
        }

        try {
            session.response.write(`data: ${JSON.stringify(payload)}\n\n`);
            return true;
        } catch (error) {
            logger.error({ userId, error }, "Failed to write to SSE");
            this.closeSession(userId);
            return false;
        }
    }

    /**
     * Initialize SSE headers on response
     */
    initSSEHeaders(response: Response): void {
        response.setHeader("Content-Type", "text/event-stream");
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("Connection", "keep-alive");
        response.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
        response.flushHeaders();
    }

    /**
     * Send error and close connection
     */
    sendErrorAndClose(response: Response, message: string, errorType?: string): void {
        const errorPayload = {
            type: "error",
            message,
            errorType,
        };

        try {
            response.write(`data: ${JSON.stringify(errorPayload)}\n\n`);
            response.end();
        } catch (error) {
            logger.debug({ error }, "Error sending error response");
        }
    }

    // ============================================
    // Cleanup Logic
    // ============================================

    /**
     * Start periodic cleanup job
     */
    private startCleanupJob(): void {
        if (this.cleanupInterval) {
            return;
        }

        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleSessions();
            this.cleanupStalePendingQuestions();
        }, this.CLEANUP_INTERVAL_MS);

        // Don't prevent process exit
        this.cleanupInterval.unref();

        logger.info("Session cleanup job started");
    }

    /**
     * Stop cleanup job
     */
    stopCleanupJob(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            logger.info("Session cleanup job stopped");
        }
    }

    /**
     * Clean up stale sessions
     */
    private cleanupStaleSessions(): void {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [userId, session] of this.activeSessions) {
            const age = now - session.timestamp;

            // Check if session is stale or response is ended
            if (age > this.SESSION_TTL_MS || session.response.writableEnded) {
                this.closeSession(userId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            logger.info({ cleanedCount }, "Cleaned up stale sessions");
        }
    }

    /**
     * Clean up stale pending questions
     */
    private cleanupStalePendingQuestions(): void {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [userId, data] of this.pendingQuestions) {
            if (now - data.timestamp > this.PENDING_QUESTION_TTL_MS) {
                this.pendingQuestions.delete(userId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            logger.info({ cleanedCount }, "Cleaned up stale pending questions");
        }
    }

    // ============================================
    // Graceful Shutdown
    // ============================================

    /**
     * Gracefully shutdown all connections
     */
    async shutdown(): Promise<void> {
        logger.info("Shutting down session manager");

        this.stopCleanupJob();

        // Notify all connected users
        for (const [userId, session] of this.activeSessions) {
            try {
                this.writeToSession(userId, {
                    type: "server_shutdown",
                    message: "Server is restarting. Please reconnect.",
                });
                this.closeSession(userId);
            } catch (error) {
                logger.debug({ userId, error }, "Error during shutdown notification");
            }
        }

        this.activeSessions.clear();
        this.pendingQuestions.clear();

        logger.info("Session manager shutdown complete");
    }

    // ============================================
    // Stats (for monitoring)
    // ============================================

    /**
     * Get current stats
     */
    getStats(): { activeSessions: number; pendingQuestions: number } {
        return {
            activeSessions: this.activeSessions.size,
            pendingQuestions: this.pendingQuestions.size,
        };
    }
}

// Export singleton instance
export const sessionManager = new SessionManager();

// Export class for testing
export { SessionManager };
