import admin, { ServiceAccount } from "firebase-admin";
import serviceAccount from "../../VivaMamaServiceAccountKey.json"; // Adjust path as needed

const firebaseAdmin = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as ServiceAccount),
});

console.log("Firebase Admin Initialized");

export default firebaseAdmin;
