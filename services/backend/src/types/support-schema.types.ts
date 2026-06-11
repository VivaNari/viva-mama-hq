import { Schema } from "mongoose";

export interface ISupport {
    supportType: string;
    message: string;
    userId: Schema.Types.ObjectId;
    isResolved: boolean;
    resolvedAt: Date;
}
