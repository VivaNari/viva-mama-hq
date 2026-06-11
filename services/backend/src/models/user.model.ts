import mongoose from "mongoose";
import { IUser } from "../types";
import userSchema from "./schema/user.schema";

const UserModel = mongoose.model<IUser>("users", userSchema);

export default UserModel;
