import admin from "firebase-admin";

import env from "./env";

/**
 * Firebase Admin initialization (push notifications).
 *
 * Two credential sources, tried in order. The service-account key is never
 * committed and never baked into the image either way.
 *
 * 1. `FIREBASE_SA_KEY_JSON` — the full key JSON, injected from Secret Manager as
 *    an env var, exactly like `GOOGLE_MEET_SA_KEY_JSON` and
 *    `PLAY_DEVELOPER_SA_KEY_JSON`. Authenticates as the Firebase Admin SDK
 *    account regardless of what the process is running as.
 *
 * 2. Application Default Credentials — the attached runtime service account on
 *    Cloud Run, or `GOOGLE_APPLICATION_CREDENTIALS` locally.
 *
 * **Why option 1 exists.** ADC authenticates as whatever identity the runtime
 * carries, and that identity needs an FCM-sending role
 * (`roles/firebasemessaging.admin`). Today's Cloud Run account,
 * `cloud-run-app-sa`, holds only `secretmanager.secretAccessor`, `run.*`,
 * `aiplatform.user` and `iam.serviceAccountUser` — so on ADC alone every
 * `messaging().send()` would fail with a permission error at call time, long
 * after boot looked healthy. Granting that role to the runtime account is the
 * cleaner end state; until then, set `FIREBASE_SA_KEY_JSON`.
 *
 * Which path was taken is logged at startup, because the failure mode is
 * otherwise invisible until the first notification silently fails to send.
 */
function resolveCredential(): admin.credential.Credential {
    const raw = env.FIREBASE_SA_KEY_JSON?.trim();

    if (!raw) {
        console.log("[firebase] Using Application Default Credentials");
        return admin.credential.applicationDefault();
    }

    try {
        // A key downloaded from GCP is snake_case (`client_email`); the typed
        // ServiceAccount shape is camelCase. cert() accepts either, so read both
        // for the log line rather than silently printing "unknown".
        const key = JSON.parse(raw) as admin.ServiceAccount & { client_email?: string };
        const account = key.clientEmail ?? key.client_email ?? "unknown account";
        console.log(`[firebase] Using FIREBASE_SA_KEY_JSON (${account})`);
        return admin.credential.cert(key);
    } catch (error) {
        // Deliberately not fatal: a malformed secret should not stop the API from
        // serving. It IS loud, because the alternative is push notifications
        // quietly never arriving.
        console.error(
            "[firebase] FIREBASE_SA_KEY_JSON is set but is not valid JSON — falling back to " +
                "Application Default Credentials. Push notifications will fail unless the " +
                "runtime service account has an FCM role.",
            error,
        );
        return admin.credential.applicationDefault();
    }
}

const firebaseAdmin = admin.initializeApp({
    credential: resolveCredential(),
});

console.log("Firebase Admin Initialized");

export default firebaseAdmin;
