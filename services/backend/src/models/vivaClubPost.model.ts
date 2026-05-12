import mongoose from "mongoose";
import { IVivaClubPost } from "../types/vivaClub.types";
import vivaClubPostSchema from "./schema/vivaClubPost.schema";

const VivaClubPostModel = mongoose.model<IVivaClubPost>("viva_club_posts", vivaClubPostSchema);

export default VivaClubPostModel;
