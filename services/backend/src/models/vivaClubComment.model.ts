import mongoose from "mongoose";
import { IVivaClubComment } from "../types/vivaClub.types";
import vivaClubCommentSchema from "./schema/vivaClubComment.schema";

const VivaClubCommentModel = mongoose.model<IVivaClubComment>("viva_club_comments", vivaClubCommentSchema);

export default VivaClubCommentModel;
