import admin from "firebase-admin";
import { IPuhNotificationParams } from "../types";
import { Message } from "firebase-admin/messaging";

export const sendPushNotification = async ({
    token,
    title,
    body,
    data,
}: IPuhNotificationParams) => {
    const message: Message = {
        notification: {
            title: title,
            body: body,
        },
        data: data || {},
        apns: {
            payload: {
                aps: {
                    sound: "default",
                },
            },
        },
        android: {
            priority: "high",
            notification: {
                sound: "default",
            },
        },
        token: token,
    };
    try {
        const response = await admin.messaging().send(message);
        console.log("Successfully sent message:", response);
    } catch (error) {
        console.error("Error sending message:", error);
    }
};
