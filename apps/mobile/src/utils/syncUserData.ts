import { getUserData } from "../api/userData.api";
import { chatDB } from "../db/sqlite";
import { decodeToken } from "./decodeJWTToken";

/**
 * Synchronizes user data from the API to the local SQLite database.
 */
export const syncUserData = async (token: string): Promise<string | null> => {
  try {
    const decodedUserId = decodeToken(token);
    if (!decodedUserId) {
      console.warn("[SYNC] Failed to decode token");
      return null;
    }

    // Initialize database if not already done
    await chatDB.init();

    // Fetch user data from API
    const userData = await getUserData();
    console.log("[SYNC] Fetched user data from API:", userData);

    // Save or update in SQLite
    const userExists = await chatDB.CheckUserExists(decodedUserId);
    if (userExists) {
      await chatDB.updateUserData(decodedUserId, userData);
      console.log("[SYNC] Updated user data in SQLite");
    } else {
      await chatDB.saveUserData(decodedUserId, userData);
      console.log("[SYNC] Saved new user data to SQLite");
    }

    return decodedUserId;
  } catch (error) {
    console.error("[SYNC] Error during user data synchronization:", error);
    return null;
  }
};
