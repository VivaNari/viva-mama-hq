import mongoose from "mongoose";

const connectDb = async () => {
    try {
        const mongoUri = buildMongoUri();
        const connection = await mongoose.connect(mongoUri);

        console.log(
            `\x1b[34m \x1b[1m \x1b[4mMongoDB Connected: ${connection.connection.port}\x1b[0m`,
        );
    } catch (err) {
        throw err;
    }
};

const buildMongoUri = () => {
    const {
        MONGO_URI,
        MONGODB_HOST,
        MONGODB_PORT,
        MONGODB_USERNAME,
        MONGODB_PASSWORD,
        MONGODB_DATABASE,
    } = process.env;

    // If MONGO_URI is already set, use it
    if (MONGO_URI) {
        return MONGO_URI;
    }

    // Build URI from separate variables
    const username = encodeURIComponent(MONGODB_USERNAME || "");
    const password = encodeURIComponent(MONGODB_PASSWORD || "");
    const host = MONGODB_HOST || "localhost";
    const port = MONGODB_PORT || "27017";
    const database = MONGODB_DATABASE || "viva_mama";

    // With authentication
    if (username && password) {
        return `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=admin`;
    }

    // Without authentication (fallback)
    return `mongodb://${host}:${port}/${database}`;
};

export default connectDb;
