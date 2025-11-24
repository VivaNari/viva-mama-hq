// src/logger/redaction.ts
// PII/PHI Redaction for GDPR, HIPAA, SOC2 compliance

export const redactPaths = [
    // Authentication & Credentials
    "password",
    "pwd",
    "passwd",
    "secret",
    "apiKey",
    "api_key",
    "accessToken",
    "access_token",
    "refreshToken",
    "refresh_token",
    "token",
    "authorization",
    "auth",

    // Personal Identifiable Information (PII)
    "ssn",
    "social_security_number",
    "socialSecurityNumber",
    "dob",
    "dateOfBirth",
    "date_of_birth",
    "birthDate",

    // Financial Information
    "creditCard",
    "credit_card",
    "cardNumber",
    "card_number",
    "cvv",
    "cvv2",
    "cardCvv",
    "accountNumber",
    "account_number",
    "routingNumber",
    "routing_number",
    "iban",
    "swift",

    // Protected Health Information (PHI)
    "medicalRecordNumber",
    "medical_record_number",
    "healthPlanBeneficiaryNumber",
    "diagnosis",
    "prescription",

    // Contact Information (can be PII depending on context)
    "*.email",
    "*.phone",
    "*.phoneNumber",
    "*.mobileNumber",
    "*.address.line1",
    "*.address.line2",
    "*.address.street",

    // Request/Response Bodies (nested)
    "req.body.password",
    "req.body.confirmPassword",
    "req.body.oldPassword",
    "req.body.newPassword",
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers.set-cookie",
    "body.password",
    "body.token",
    "headers.authorization",
    "headers.cookie",

    // Database fields
    "user.password",
    "user.passwordHash",
    "user.ssn",
    "customer.creditCard",
    "patient.medicalHistory",
];

export const redactOptions = {
    paths: redactPaths,
    censor: "[REDACTED]",
    remove: false, // Keep structure but replace values
};

// Custom redaction function for complex scenarios
export function customRedact(obj: any): any {
    if (!obj || typeof obj !== "object") {
        return obj;
    }

    const redacted = Array.isArray(obj) ? [...obj] : { ...obj };

    for (const key in redacted) {
        const lowerKey = key.toLowerCase();

        // Check if key contains sensitive patterns
        if (
            lowerKey.includes("password") ||
            lowerKey.includes("secret") ||
            lowerKey.includes("token") ||
            lowerKey.includes("apikey") ||
            lowerKey.includes("ssn") ||
            lowerKey.includes("credit") ||
            lowerKey === "authorization"
        ) {
            redacted[key] = "[REDACTED]";
        } else if (typeof redacted[key] === "object" && redacted[key] !== null) {
            // Recursively redact nested objects
            redacted[key] = customRedact(redacted[key]);
        }
    }

    return redacted;
}
