import { Storage } from "@google-cloud/storage";

/**
 * Cloud Storage client for chat attachments, created on first use so processes that
 * never touch attachments (cron scripts, most tests) never load credentials.
 *
 * Application Default Credentials: on Cloud Run that is the runtime service account,
 * which holds objectUser on the attachments bucket only, plus TokenCreator on itself
 * so it can sign V4 read URLs without a key file. Locally, `gcloud auth
 * application-default login` (or GOOGLE_APPLICATION_CREDENTIALS) is enough.
 */
let storage: Storage | null = null;

export function getStorage(): Storage {
    if (!storage) storage = new Storage();
    return storage;
}

/** Test-only: inject a fake. */
export function setStorageForTests(fake: Storage | null): void {
    storage = fake;
}
