export const flattenObject = (obj: Record<string, any>, prefix = ""): Record<string, any> => {
    return Object.keys(obj).reduce(
        (acc, key) => {
            const fullKey = prefix ? `${prefix}.${key}` : key;

            if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
                Object.assign(acc, flattenObject(obj[key], fullKey));
            } else {
                acc[fullKey] = obj[key];
            }

            return acc;
        },
        {} as Record<string, any>,
    );
};
