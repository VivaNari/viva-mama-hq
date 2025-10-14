export const addMinutesToDate = (date: number, minutes: number) => new Date(date + minutes * 60000);

export const compareDate = (expiration: Date, current: Date) =>
    expiration.getTime() > current.getTime();
