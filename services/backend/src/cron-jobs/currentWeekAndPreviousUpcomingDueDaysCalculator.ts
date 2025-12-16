import flowInstanceModel from "../models/flowInstance.model";
import UserModel from "../models/user.model";
import { IUser } from "../types";
import { IFlowInstance } from "../types/chat.types";
import { calculateUserCurrentWeek } from "../utils/functions/calculateUserCurrentWeek";

const getRecentFlowInstances = async ({ user }: { user: IUser }) => {
    const latestFlowInstance = await flowInstanceModel
        .findOne({
            userId: user._id,
        })
        .sort({ createdAt: -1 });
    let previousFlowInstance = await flowInstanceModel
        .findOne({
            userId: user._id,
        })
        .sort({ createdAt: -1 })
        .skip(1);

    if (previousFlowInstance === null) {
        previousFlowInstance = latestFlowInstance;
    }

    return { latestFlowInstance, previousFlowInstance };
};

const processUser = async (user: IUser) => {
    console.log(`Processing user: ${user.email ? user.email : user.mobile_number}`);
    if (!user.FCM_token) {
        console.warn(
            `User ${user.email ? user.email : user.mobile_number} has no FCM token. Skipping.`,
        );
        return;
    }

    if (!user.onboarding_data.delivery_date) {
        console.warn(
            `User ${user.email ? user.email : user.mobile_number} has no delivery date. Skipping.`,
        );
        return;
    }

    const user_current_week_and_days = calculateUserCurrentWeek(
        user.onboarding_data.delivery_date as Date,
    );

    await UserModel.findOneAndUpdate(
        { _id: user._id },
        { $set: { current_weekdays: user_current_week_and_days } },
        { new: true },
    );

    const userInstance = await UserModel.findById(user._id);

    if (userInstance === null) {
        return;
    }

    let { latestFlowInstance, previousFlowInstance } = await getRecentFlowInstances({
        user,
    });

    if (latestFlowInstance === null || previousFlowInstance === null) {
        return;
    }

    const formattedUserWeek = Number(
        user.current_weekdays.weeks + "." + user.current_weekdays.days,
    );
    let previousPostpartumWeek = previousFlowInstance.postpartumWeek;
    let latestPostpartumWeek = latestFlowInstance.postpartumWeek;
    if (formattedUserWeek > latestPostpartumWeek) {
        previousPostpartumWeek = latestPostpartumWeek;
        let newFlowInstancePayload: Partial<IFlowInstance & { _id: any }> = latestFlowInstance;
        delete newFlowInstancePayload._id;
        const newFlowInstance = await new flowInstanceModel({
            ...newFlowInstancePayload,
            postpartumWeek: latestFlowInstance.postpartumWeek + 1,
        }).save();
        latestPostpartumWeek = newFlowInstance.postpartumWeek;
        previousFlowInstance = latestFlowInstance;
        latestFlowInstance = newFlowInstance;
    }

    console.log("previousPostpartumWeek", previousPostpartumWeek);
    console.log("latestPostpartumWeek", latestPostpartumWeek);

    const upcomingDays =
        formattedUserWeek - previousPostpartumWeek == 1
            ? 0
            : formattedUserWeek - previousPostpartumWeek;
    const previousDays =
        latestPostpartumWeek - formattedUserWeek - 0.3 < 0
            ? 0
            : latestPostpartumWeek - formattedUserWeek - 0.3;

    console.log("upcomingDays, previousDays", upcomingDays, previousDays);
    // user.previous_weekly_checkin_due_days = previousDays.toFixed(1);
    // user.upcoming_weekly_checkin_due_days = previousDays.toFixed(1);

    if (upcomingDays === previousDays) {
        console.log("fireeeeeeeeee!!!!!!!");
    }
};

// const processUser = async (user: any) => {
//     console.log(`Processing user: ${user.email ?? user.mobile_number}`);

//     if (!user.FCM_token) return console.warn("Skipping: No FCM token.");
//     if (!user.onboarding_data.delivery_date) return console.warn("Skipping: No delivery date.");

//     const weekDays = getPostpartumWeekAndDays(user.onboarding_data.delivery_date);

//     await UserModel.updateOne({ _id: user._id }, { $set: { current_weekdays: weekDays } });

//     const updatedUser = await UserModel.findById(user._id);
//     if (!updatedUser) return;

//     const currentWeek = weekDays.weeks;
//     const currentDay = weekDays.days;
//     const currentTotalDays = currentWeek * 7 + currentDay;

//     let { latestFlowInstance, previousFlowInstance } = await getRecentFlowInstances(updatedUser);

//     // If NO flow instances exist yet → CREATE FIRST FLOW FOR CURRENT WEEK
//     if (!latestFlowInstance) {
//         console.log("Creating FIRST flowInstance for postpartum week:", currentWeek);

//         latestFlowInstance = await flowInstanceModel.create({
//             userId: updatedUser._id,
//             postpartumWeek: currentWeek,
//             postpartumDays: currentDay,
//             state: "started",
//             flowSlug: "weekly-checkin",
//             version: 1,
//         });

//         previousFlowInstance = latestFlowInstance;
//     }

//     let previousWeek = previousFlowInstance!.postpartumWeek;
//     let latestWeek = latestFlowInstance.postpartumWeek;

//     // ---------------------------------------------------------
//     // Step C: Create next flow instance ONLY IF user progressed
//     // ---------------------------------------------------------
//     if (currentWeek > latestWeek) {
//         console.log("User progressed → creating next flow:", latestWeek + 1);

//         const payload: Partial<IFlowInstance & { _id: any }> = latestFlowInstance.toObject();
//         delete payload._id;

//         const newFlow = await flowInstanceModel.create({
//             ...payload,
//             postpartumWeek: latestWeek + 1,
//             postpartumDays: 0,
//         });

//         previousFlowInstance = latestFlowInstance;
//         latestFlowInstance = newFlow;

//         previousWeek = previousFlowInstance.postpartumWeek;
//         latestWeek = latestFlowInstance.postpartumWeek;
//     }

//     // ---------------------------------------------------------
//     // Step D: Calculate due days
//     // ---------------------------------------------------------
//     const previousDueDay = previousWeek * 7;
//     const nextDueDay = (latestWeek + 1) * 7;

//     let previousDays = currentTotalDays - previousDueDay;
//     if (previousDays < 0) previousDays = 0;

//     let upcomingDays = nextDueDay - currentTotalDays;
//     if (upcomingDays < 0) upcomingDays = 0;

//     console.log({
//         user: updatedUser.email ?? updatedUser.mobile_number,
//         currentWeek,
//         currentDay,
//         previousWeek,
//         latestWeek,
//         previousDays,
//         upcomingDays,
//     });

//     // ---------------------------------------------------------
//     // Step E: Update user table
//     // ---------------------------------------------------------
//     await UserModel.updateOne(
//         { _id: user._id },
//         {
//             $set: {
//                 previous_weekly_checkin_due_days: previousDays,
//                 upcoming_weekly_checkin_due_days: upcomingDays,
//             },
//         },
//     );

//     // ---------------------------------------------------------
//     // Optional: Notify if check-in due today
//     // ---------------------------------------------------------
//     if (upcomingDays === 0) {
//         console.log("🔥 Weekly check-in is due TODAY!");
//     }
// };

export const currentWeekAndPreviousUpcomingDueDaysCalculator = async () => {
    console.log("--- Running Start/Continue Conversation Job ---");

    // Get all users who have an FCM token
    const users = await UserModel.find({
        FCM_token: { $exists: true, $ne: null },
    });

    for (const user of users) {
        try {
            await processUser(user);
        } catch (error: any) {
            console.error(`Failed to process user ${user._id}:`, error.message);
        }
    }

    console.log("--- Start/Continue Conversation Job Finished ---");
};
