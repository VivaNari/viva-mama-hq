import { Request, Response, NextFunction } from "express";
import { Schema } from "joi";

const requestValidator = (schema: Schema) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await schema.validateAsync(req.body);
            console.log("Validated Data:", req.body);
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
