import UserModel from "../models/user.model";

export const calculateCurrentPostpartumWeek = async () => {
    const millisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;

    await UserModel.updateMany({ date_of_delivery: { $exists: true, $ne: null } }, [
        {
            $set: {
                current_postpartum_week: {
                    $cond: [
                        { $lt: [{ $subtract: ["$$NOW", "$date_of_delivery"] }, 0] },
                        -1, // If delivery is in future, return -1
                        {
                            $max: [
                                1,
                                {
                                    $add: [
                                        1,
                                        {
                                            $floor: {
                                                $divide: [
                                                    { $subtract: ["$$NOW", "$date_of_delivery"] },
                                                    millisecondsPerWeek,
                                                ],
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            },
        },
    ]);
};
