import flowInstanceModel from "../models/flowInstance.model";
import UserModel from "../models/user.model";
import { IUser } from "../types";
import { IFlowInstance } from "../types/chat.types";
import { calculateUserCurrentWeek } from "../utils/functions/calculateUserCurrentWeek";
import logger from "../utils/logger";

const getRecentFlowInstances = async ({
    userInstance,
}: {
    userInstance: IUser;
}): Promise<{ latestFlowInstance: IFlowInstance; previousFlowInstance: IFlowInstance }> => {
    const latestFlowInstances: IFlowInstance[] = await flowInstanceModel
        .find({
            userId: userInstance._id,
        })
        .sort({ _id: -1 })
        .limit(1)
        .lean();
    let previousFlowInstances: IFlowInstance[] = await flowInstanceModel
        .find({
            userId: userInstance._id,
        })
        .sort({ _id: -1 })
        .skip(1)
        .limit(1)
        .lean();

    if (latestFlowInstances.length === 0) {
        throw new Error("No flow instances found for user");
    }

    const latestFlowInstance: IFlowInstance = latestFlowInstances[0] as IFlowInstance;
    const previousFlowInstance = (
        previousFlowInstances.length > 0 ? previousFlowInstances[0] : latestFlowInstances[0]
    ) as IFlowInstance;

    return {
        latestFlowInstance,
        previousFlowInstance,
    };
};

const validateUser = (user: IUser): boolean => {
    if (!user.FCM_token) {
        console.warn(
            `User ${user.email ? user.email : user.mobile_number} has no FCM token. Skipping.`,
        );
        return false;
    }

    if (!user.onboarding_data.delivery_date) {
        console.warn(
            `User ${user.email ? user.email : user.mobile_number} has no delivery date. Skipping.`,
        );
        return false;
    }

    return true;
};

const getUserWeekdays = (user: IUser): { weeks: number; days: number } => {
    const currentWeekDays = calculateUserCurrentWeek(user.onboarding_data.delivery_date as Date);

    return currentWeekDays;
};

const formatUserWeek = (weeks: number, days: number): number => {
    return Number(weeks + "." + days);
};

const generateNewFlowInstance = async (
    latestFlowInstance: IFlowInstance,
): Promise<IFlowInstance> => {
    let newFlowInstancePayload: Partial<IFlowInstance & { _id: any }> = latestFlowInstance;
    delete newFlowInstancePayload._id;

    const newFlowInstance: IFlowInstance = await new flowInstanceModel({
        ...newFlowInstancePayload,
        postpartumWeek: latestFlowInstance.postpartumWeek + 1,
    }).save();

    return newFlowInstance;
};

const updateFlowInstance = async (
    userInstance: IUser,
    weeks: number,
    days: number,
): Promise<{
    formattedUserWeek: number;
    latestPostpartumWeek: number;
    previousPostpartumWeek: number;
}> => {
    let { latestFlowInstance, previousFlowInstance } = await getRecentFlowInstances({
        userInstance,
    });

    const formattedUserWeek = formatUserWeek(weeks, days);

    let previousPostpartumWeek = previousFlowInstance.postpartumWeek;
    let latestPostpartumWeek = latestFlowInstance.postpartumWeek;

    if (formattedUserWeek > latestPostpartumWeek) {
        console.log(formatUserWeek, ">", latestPostpartumWeek);
        previousPostpartumWeek = latestPostpartumWeek;

        const newFlowInstance = await generateNewFlowInstance(latestFlowInstance);

        latestPostpartumWeek = newFlowInstance.postpartumWeek;

        previousFlowInstance = latestFlowInstance;
        latestFlowInstance = newFlowInstance;
    }

    return { formattedUserWeek, latestPostpartumWeek, previousPostpartumWeek };
};

const calculateUpcomingAndPreviousDueDays = ({
    formattedUserWeek,
    previousPostpartumWeek,
    latestPostpartumWeek,
}: {
    formattedUserWeek: number;
    previousPostpartumWeek: number;
    latestPostpartumWeek: number;
}): { previousDays: number; upcomingDays: number } => {
    const previousDays = Number(
        (formattedUserWeek - previousPostpartumWeek == 1
            ? 0
            : formattedUserWeek - previousPostpartumWeek
        ).toFixed(1),
    );
    const upcomingDays = Number(
        (latestPostpartumWeek - formattedUserWeek - 0.3 < 0
            ? 0
            : latestPostpartumWeek - formattedUserWeek - 0.3
        ).toFixed(1),
    );

    return { previousDays, upcomingDays };
};

const updateUserDueDays = async ({
    userInstance,
    previousCheckinDueDays,
    upcomingCheckinDueDays,
    weeks,
    days,
}: {
    userInstance: IUser;
    previousCheckinDueDays: number;
    upcomingCheckinDueDays: number;
    weeks: number;
    days: number;
}): Promise<IUser> => {
    await UserModel.findByIdAndUpdate(
        userInstance._id,
        {
            $set: {
                "current_weekdays.previous_checkin_due_days": previousCheckinDueDays,
                "current_weekdays.upcoming_checkin_due_days": upcomingCheckinDueDays,
                "current_weekdays.weeks": weeks,
                "current_weekdays.days": days,
            },
        },
        { new: true },
    );
    const updatedUserInstance = await UserModel.findById(userInstance._id).lean();
    if (!updatedUserInstance) {
        throw new Error("Failed to fetch updated user instance");
    }
    return updatedUserInstance;
};

const fireWeeklyCheckinPushNotification = async (userInstance: IUser) => {
    if (userInstance.current_weekdays.upcoming_checkin_due_days === 0) {
        console.log(`Firing weekly check-in push notification to user ${userInstance._id}`);
        // Implement push notification logic here
    }
};

const processUser = async (userInstance: IUser) => {
    const isValidUser = validateUser(userInstance);
    if (!isValidUser) {
        logger.warn({ userId: userInstance._id }, "Invalid user data. Skipping user:");
        return;
    }

    const userWeekdays = getUserWeekdays(userInstance);

    const { formattedUserWeek, latestPostpartumWeek, previousPostpartumWeek } =
        await updateFlowInstance(userInstance, userWeekdays.weeks, userWeekdays.days);

    const { previousDays, upcomingDays } = calculateUpcomingAndPreviousDueDays({
        formattedUserWeek,
        previousPostpartumWeek,
        latestPostpartumWeek,
    });

    console.log(formattedUserWeek, previousDays, upcomingDays);

    const updateUserInstance = await updateUserDueDays({
        userInstance,
        previousCheckinDueDays: previousDays,
        upcomingCheckinDueDays: upcomingDays,
        weeks: userWeekdays.weeks,
        days: userWeekdays.days,
    });

    await fireWeeklyCheckinPushNotification(updateUserInstance);
};

export const currentWeekAndPreviousUpcomingDueDaysCalculator = async () => {
    const userInstances = await UserModel.find({
        FCM_token: { $exists: true, $ne: null },
    });

    for (const userInstance of userInstances) {
        try {
            await processUser(userInstance);
        } catch (error: any) {
            logger.error(`Failed to process user ${userInstance._id}:`, error.message);
        }
    }
    console.log("Completed processing all users for current week and due days calculation.");
};
