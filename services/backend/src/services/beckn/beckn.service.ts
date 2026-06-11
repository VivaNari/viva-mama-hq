import logger from "../../utils/logger";
import { BecknRequest } from "../../types/beckn.types";
import {
    buildOnSelectStub,
    buildOnInitStub,
    buildOnConfirmStub,
    buildOnStatusStub,
} from "./beckn.builders";
import { dispatchToBppCaller } from "./beckn.caller";

// BPP-side Beckn handlers.
//
// Beckn is asynchronous: the controller ACKs the incoming request synchronously, then
// the matching handler here builds the `on_<action>` callback and dispatches it back to
// the BAP via the BPP caller. The callback bodies are currently STUBS (see
// beckn.builders) — swap in real catalog/pricing/payment logic without changing wiring.
//
// `handle` never throws: it runs after the ACK is already sent, so any failure is
// logged, not propagated.
class BecknService {
    private handle = async (
        incomingAction: string,
        callbackAction: string,
        payload: BecknRequest,
        build: (p: BecknRequest) => BecknRequest,
    ): Promise<void> => {
        const { context } = payload;

        logger.info(
            {
                action: incomingAction,
                transactionId: context?.transactionId,
                messageId: context?.messageId,
                bapId: context?.bapId,
                bppId: context?.bppId,
            },
            `Beckn ${incomingAction} received`,
        );

        try {
            const callback = build(payload);
            await dispatchToBppCaller(callbackAction, callback);
        } catch (err) {
            logger.error(
                { err, action: incomingAction, transactionId: context?.transactionId },
                `Failed to build/dispatch ${callbackAction}`,
            );
        }
    };

    handleSelect = (payload: BecknRequest) =>
        this.handle("select", "on_select", payload, buildOnSelectStub);

    handleInit = (payload: BecknRequest) =>
        this.handle("init", "on_init", payload, buildOnInitStub);

    handleConfirm = (payload: BecknRequest) =>
        this.handle("confirm", "on_confirm", payload, buildOnConfirmStub);

    handleStatus = (payload: BecknRequest) =>
        this.handle("status", "on_status", payload, buildOnStatusStub);
}

export default BecknService;
