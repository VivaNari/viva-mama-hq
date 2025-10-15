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
            console.log(await schema.validateAsync(req.body));
            next();
        } catch (errors: any) {
            console.log(errors);
            return res.status(400).json({
                error: errors,
            });
        }
    };
};

export default requestValidator;
