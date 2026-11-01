import axios, { AxiosInstance } from "axios";
import { IUser } from "../../types";
import env from "../../config/env";
import logger, { createModuleLogger } from "../../utils/logger";
import type { TChatbotAttachmentRef } from "../chat-system/chat-attachment.service";

const log = createModuleLogger(logger, "llm-client");

export type TRecordSubjectPayload = {
    type: "mother" | "child";
    child_name?: string | null;
    child_age_text?: string | null;
};

export type TRecordAnalyzePayload = {
    user_id: string;
    record_id: string;
    category: string;
    scan_type?: string | null;
    subject: TRecordSubjectPayload;
    files: TChatbotAttachmentRef[];
    lang: "en" | "hi";
};

export type TRecordAnalyzeResult = {
    request_id: string;
    verdict: string;
    reason_code: string;
    document_type?: string | null;
    message?: string | null;
    title?: string | null;
    report_date?: string | null;
    analysis?: Record<string, unknown> | null;
    summary_markdown?: string | null;
    digest?: string | null;
    severity: "NONE" | "MEDIUM" | "HIGH";
    critical_matches: string[];
};

export type THealthSummaryPayload = {
    user_id: string;
    lang: "en" | "hi";
    records: {
        record_id: string;
        record_date: string;
        category: string;
        scan_type?: string | null;
        subject: TRecordSubjectPayload;
        title?: string | null;
        digest: string;
        severity: "NONE" | "MEDIUM" | "HIGH";
        critical_matches: string[];
        out_of_range: {
            name: string;
            value: string;
            unit?: string | null;
            reference_range?: string | null;
            status: string;
        }[];
    }[];
    vitals: {
        type: string;
        value: string;
        unit?: string | null;
        note?: string | null;
        date: string;
    }[];
    medicines: { name: string; dose?: string | null; frequency?: string | null }[];
    child_names: string[];
};

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

    /** Read one saved health record. Always a verdict, never an HTTP error, on success. */
    analyzeRecord = async (payload: TRecordAnalyzePayload): Promise<TRecordAnalyzeResult> => {
        const startedAt = Date.now();
        const { data } = await this.axiosInstance.post("/v1/records/analyze", payload);
        log.info(
            {
                userId: payload.user_id,
                recordId: payload.record_id,
                files: payload.files.length,
                verdict: data?.verdict,
                reasonCode: data?.reason_code,
                requestId: data?.request_id,
                latencyMs: Date.now() - startedAt,
            },
            "Record analysed",
        );
        return data;
    };

    /** Her overall health summary from the stored per-record summaries. */
    buildHealthSummary = async (
        payload: THealthSummaryPayload,
    ): Promise<{ content: Record<string, unknown>; share_text: string; request_id: string }> => {
        const startedAt = Date.now();
        const { data } = await this.axiosInstance.post("/v1/records/summary", payload);
        log.info(
            {
                userId: payload.user_id,
                records: payload.records.length,
                vitals: payload.vitals.length,
                requestId: data?.request_id,
                latencyMs: Date.now() - startedAt,
            },
            "Health summary built",
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
