import { IUser } from "../../types";
import { ICareManager } from "../../types/care-manager.types";

export const constructConsultationWhatsappMessage = (
    consultatorInstance: ICareManager,
    userInstance: IUser,
) => {
    const message = `📞 *New Care Manager Callback Request*

            *Care Manager:* ${consultatorInstance.name}
            *User ID:* ${userInstance?._id}
            *User Email/Phone Number:* ${userInstance?.email || userInstance?.mobile_number}
            *Requested At:* ${new Date().toLocaleString()}

            Please respond as soon as possible.`;

    return message;
};
