import admin, { ServiceAccount } from "firebase-admin";
import serviceAccount from "../../VivaMamaServiceAccountKey.json";

export const initFirebaseAdmin = () => {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as ServiceAccount),
    });
};
