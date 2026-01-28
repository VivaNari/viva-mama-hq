import mongoose from "mongoose";
import env from "./env";

const connectDb = async () => {
    try {
        const connection = await mongoose.connect(env.MONGO_URI);

        console.log(
            `\x1b[34m \x1b[1m \x1b[4mMongoDB Connected: ${connection.connection.port}\x1b[0m`,
        );
    } catch (err) {
        throw err;
    }
};

export default connectDb;
