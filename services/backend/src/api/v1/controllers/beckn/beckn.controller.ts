import { NextFunction, Request, Response } from "express";
import BecknService from "../../../../services/beckn/beckn.service";
import { BecknRequest } from "../../../../types/beckn.types";
import { sendBecknAck } from "../../../../utils/commonFunctions/beckn/becknResponse";

export default class BecknController {
    private becknService: BecknService;
    constructor() {
        this.becknService = new BecknService();
    }

    // Shared flow for every BPP action: ACK synchronously, then fire the on_<action>
    // callback asynchronously (handlers own their errors, so this never rejects).
    private dispatch = (
        req: Request,
        res: Response,
        next: NextFunction,
        handler: (payload: BecknRequest) => void | Promise<void>,
    ) => {
        try {
            const payload = req.body as BecknRequest;
            sendBecknAck(res);
            void handler(payload);
        } catch (err) {
            console.log(err);
            if (!res.headersSent) next(err);
        }
    };

    // POST /api/v1/beckn/select
    select = (req: Request, res: Response, next: NextFunction) =>
        this.dispatch(req, res, next, this.becknService.handleSelect);

    // POST /api/v1/beckn/init
    init = (req: Request, res: Response, next: NextFunction) =>
        this.dispatch(req, res, next, this.becknService.handleInit);

    // POST /api/v1/beckn/confirm
    confirm = (req: Request, res: Response, next: NextFunction) =>
        this.dispatch(req, res, next, this.becknService.handleConfirm);

    // POST /api/v1/beckn/status
    status = (req: Request, res: Response, next: NextFunction) =>
        this.dispatch(req, res, next, this.becknService.handleStatus);
}
