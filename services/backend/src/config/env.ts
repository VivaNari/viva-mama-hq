const env = {
    MONGO_URI: process.env.MONGO_URI as string,
    PORT: process.env.PORT,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    JWT_SECRET: process.env.JWT_SECRET,
    CRYPTO_PASSWORD: process.env.CRYPTO_PASSWORD,
};

export default env;
