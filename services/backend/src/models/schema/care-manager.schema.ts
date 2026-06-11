import { Schema } from "mongoose";
import { ICareManager } from "../../types/care-manager.types";

const careManagerSchema = new Schema<ICareManager>({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    imageUrl: { type: String, required: false },
});

export default careManagerSchema;
