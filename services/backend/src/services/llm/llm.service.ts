import axios, { AxiosInstance } from "axios";
import { IUser } from "../../types";
import env from "../../config/env";
import logger, { createModuleLogger } from "../../utils/logger";
import type { TChatbotAttachmentRef } from "../chat-system/chat-attachment.service";

const log = createModuleLogger(logger, "llm-client");

/**
 * Longer than the chatbot's own worst case, so its answer or error arrives before we
 * give up. For an attachment turn that is download + triage + analysis = 120 s (see
 * the attachment timeouts in the chatbot's settings.py); the app waits 180 s for the
 * reply. Without a timeout a hung chatbot pinned the turn forever.
 */
const CHAT_TIMEOUT_MS = 150_000;

class LLMService {
    private axiosInstance: AxiosInstance;

    constructor() {
        this.axiosInstance = axios.create({
            baseURL: env.LLM_SERVER_URL,
            timeout: CHAT_TIMEOUT_MS,
            headers: {
                "x-api-key": env.LLM_API_KEY,
            },
        });
    }

    sendUserQuery = async (
        user: IUser,
        message: string,
        sessionId: string,
        model: string,
        options: { attachments?: TChatbotAttachmentRef[]; lang?: string | null } = {},
    ): Promise<Record<string, unknown>> => {
        const attachments = options.attachments ?? [];
        const payload = {
            user_id: user._id.toString(),
            query: message || null,
            session_id: sessionId,
            model,
            ...(options.lang ? { lang: options.lang } : {}),
            ...(attachments.length ? { attachments } : {}),
        };
        // Metadata only. What she asks a maternal-health assistant, and what it reads
        // off her reports, does not belong in logs.
        const startedAt = Date.now();
        const llmResponse = await this.axiosInstance.post("/v1/chat", payload);
        const data = llmResponse.data ?? {};
        log.info(
            {
                userId: payload.user_id,
                sessionId,
                attachments: attachments.length,
                intent: data.intent,
                requestId: data.request_id,
                latencyMs: Date.now() - startedAt,
            },
            "Chatbot answered",
        );
        return data;
    };

    sendNameQuery = async (
        freeText: string,
    ): Promise<{ detected_name: string; has_name: boolean }> => {
        const llmResponse = await this.axiosInstance.post("/v1/chat/username", {
            response: freeText || "",
        });
        return llmResponse.data;
    };
}

export default LLMService;
