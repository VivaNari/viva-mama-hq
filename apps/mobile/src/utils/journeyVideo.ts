/** A playback position as m:ss, e.g. 35.2 seconds reads "0:35". */
export const formatVideoClock = (seconds: number): string => {
    const whole = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const minutes = Math.floor(whole / 60);
    return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
};
