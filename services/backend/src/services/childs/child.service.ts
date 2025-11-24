import { Request, Response } from "express";
import UserModel from "../../models/user.model";

export default class ChildService {
    addChild = async (req: Request, res: Response) => {
        try {
            const userId = req.user?._id;

            const { name, date_of_birth, sex } = req.body;

            const dob = new Date(date_of_birth);

            const newChild = {
                name,
                date_of_birth: dob,
                sex,
            };

            const updatedUser = await UserModel.findByIdAndUpdate(
                userId,
                { $push: { childs: newChild } },
                { new: true, runValidators: true },
            );

            if (!updatedUser) {
                return res.status(404).json({ message: "User not found." });
            }

            return res.status(200).json({
                message: "Child added successfully!",
                success: true,
                user: updatedUser,
            });
        } catch (error: any) {
            console.error("addChild error:", error);
            return res.status(500).json({
                message: "Failed to add child due to a server error.",
                success: false,
                error: error.message,
            });
        }
    };
}
