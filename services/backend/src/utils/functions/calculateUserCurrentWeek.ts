export const calculateUserCurrentWeek = (deliveryDate: Date) => {
    const msPerDay = 1000 * 60 * 60 * 24;
    const msPerWeek = msPerDay * 7;

    const now = Date.now();
    const delivery = new Date(deliveryDate).getTime();

    if (delivery > now) {
        const remainingMs = delivery - now;
        const remainingDays = Math.floor(remainingMs / msPerDay);

        const totalPregnancyDays = 40 * 7;
        const pregnancyDaysPassed = totalPregnancyDays - remainingDays;

        const weeks = Math.floor(pregnancyDaysPassed / 7);
        const days = pregnancyDaysPassed % 7;

        console.log("Pregnancy:", weeks, "weeks", days, "days");

        return {
            mode: "pregnancy",
            weeks,
            days,
        };
    }

    const diff = now - delivery;

    // Weeks (floor)
    const week = Math.floor(diff / msPerWeek);

    // Remaining days
    const remainingMs = diff % msPerWeek;
    const days = Math.floor(remainingMs / msPerDay);

    console.log("Week:", Math.max(1, week));
    console.log("Days after last full week:", days);

    return {
        mode: "postpartum",
        weeks: week + 1, // Start from week 1
        days,
    };
};
