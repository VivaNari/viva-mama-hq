import mongoose from "mongoose";
import userSchema from "./schemas/user.schema";
import { IUser } from "../types";

const UserModel = mongoose.model<IUser>("users", userSchema);

export default UserModel;
