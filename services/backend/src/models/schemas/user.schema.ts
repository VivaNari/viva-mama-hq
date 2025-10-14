import { Schema } from "mongoose";
import { IUser } from "../../types";

const userSchema = new Schema<IUser>({
    id: Number,
    name: String,
    email: String,
    mobile_number: String,
    profile_pic: String,
    is_onboarded: Boolean,
});

export default userSchema;
