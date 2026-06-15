import admin from "firebase-admin";

/**
 * Firebase Admin initialization.
 *
 * Credentials are resolved via Application Default Credentials (ADC) — we never
 * commit a service-account key to the repo:
 *   - Local / Docker: set `GOOGLE_APPLICATION_CREDENTIALS` to the absolute path
 *     of a service-account JSON key that you mount at runtime (see
 *     `services/backend/.env.example` and the root `docker-compose.yml`).
 *   - Cloud Run / GCP: the attached runtime service account is used automatically;
 *     no env var or key file is required.
 */
const firebaseAdmin = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
});

console.log("Firebase Admin Initialized");

export default firebaseAdmin;
