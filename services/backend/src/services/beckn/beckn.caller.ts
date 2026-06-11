import axios from "axios";
import env from "../../config/env";
import logger from "../../utils/logger";
import { BecknRequest } from "../../types/beckn.types";

// Dispatch a Beckn callback (on_select / on_init / on_confirm / ...) to the BPP caller,
// which signs it and routes it to the BAP. The caller base URL is configurable
// (local docker: http://localhost:8082, prod: the adapter's Cloud Run URL) so the
// same code works everywhere. Errors are logged here, never thrown — the synchronous
// ACK to the BAP has already been sent, so a callback failure must not crash the request.
export const dispatchToBppCaller = async (
    action: string,
    payload: BecknRequest,
): Promise<void> => {
    const url = `${env.BECKN_BPP_CALLER_URL}/bpp/caller/${action}`;
    const transactionId = payload.context?.transactionId;

    try {
        const response = await axios.post(url, payload, {
            headers: { "Content-Type": "application/json" },
            timeout: 15000,
        });
        logger.info(
            { action, url, status: response.status, transactionId },
            "Beckn callback dispatched to BPP caller",
        );
    } catch (err: any) {
        logger.error(
            {
                action,
                url,
                transactionId,
                status: err?.response?.status,
                error: err?.response?.data ?? err?.message,
            },
            "Failed to dispatch Beckn callback to BPP caller",
        );
    }
};
