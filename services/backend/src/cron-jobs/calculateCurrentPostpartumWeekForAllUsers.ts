import UserModel from "../models/user.model";

export const calculateCurrentPostpartumWeek = async () => {
    const millisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;

    await UserModel.updateMany({ date_of_delivery: { $exists: true, $ne: null } }, [
        {
            $set: {
                current_postpartum_week: {
                    $max: [
                        0,
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
            },
        },
    ]);
};
