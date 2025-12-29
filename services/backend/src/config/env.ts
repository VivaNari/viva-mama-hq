const env = {
    NODE_ENV: process.env.NODE_ENV || "development",
    SERVICE_NAME: process.env.SERVICE_NAME || "my-service",
    SERVICE_VERSION: process.env.SERVICE_VERSION || "1.0.0",
    ENABLE_PII_REDACTION: process.env.ENABLE_PII_REDACTION === "true",
    MONGO_URI: process.env.MONGO_URI as string,
    PORT: process.env.PORT,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    JWT_SECRET: process.env.JWT_SECRET,
    CRYPTO_PASSWORD: process.env.CRYPTO_PASSWORD,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    LOG_PRETTY_PRINT: process.env.LOG_PRETTY_PRINT === "true",
    LOG_FILE_PATH: process.env.LOG_FILE_PATH || "./logs",
    LOG_TO_FILE: process.env.LOG_TO_FILE === "true",
    RAZORPAY_API_KEY: process.env.RAZORPAY_API_KEY,
    RAZORPAY_SECRET_KEY: process.env.RAZORPAY_SECRET_KEY,
    LLM_SERVER_URL: process.env.LLM_SERVER_URL as string,
    LLM_API_KEY: process.env.LLM_API_KEY as string,
    isDevelopment(): boolean {
        return env.NODE_ENV === "development";
    },

    isProduction(): boolean {
        return env.NODE_ENV === "production";
    },

    isTest(): boolean {
        return env.NODE_ENV === "test";
    },
};

export default env;
