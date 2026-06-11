import { Request, Response, NextFunction } from "express";
import { Schema } from "joi";

const requestValidator = (schema: Schema) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.body) {
                return res.status(400).json({
                    error: "Request body is missing",
                });
            }
            await schema.validateAsync(req.body);
            next();
        } catch (errors: any) {
            return res.status(400).json({
                error: errors,
            });
        }
    };
};

export default requestValidator;
