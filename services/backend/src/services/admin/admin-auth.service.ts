import bcrypt from "bcryptjs";
import userModel from "../../models/user.model";
import { EUserRole, IUser } from "../../types";
import { messages } from "../../constants/messages";
import { generateJWT } from "../../utils/functions/generateJWT";

/**
 * A valid bcrypt hash of a value nobody will ever send. Compared against when the
 * email doesn't resolve, so a missing account costs the same ~100ms as a wrong
 * password and the response time can't be used to enumerate staff accounts.
 */
const DUMMY_HASH = "$2b$10$I7MWShvDvByWmvn6aEeDCOVBbMWYLnrJh1yYiDUFIihbfO6rKVvr.";

export const ADMIN_PASSWORD_SALT_ROUNDS = 10;

export type TAdminProfile = {
    _id: string;
    email: string | null;
    role: EUserRole;
};

const toProfile = (user: IUser): TAdminProfile => ({
    _id: user._id.toString(),
    email: user.email ?? null,
    role: user.role,
});

class AdminAuthService {
    login = async (email: string, password: string) => {
        const admin = await userModel
            .findOne({
                // The role filter is what separates a staff login from a patient who
                // happens to share the address — patients never have a password set.
                email: email.toLowerCase().trim(),
                role: EUserRole.SUPER_ADMIN,
            })
            // `password` is `select: false` on the schema, so it has to be asked for.
            .select("+password");

        // Still hash-compare when there is no account, then fail with the same message
        // as a wrong password. Neither the timing nor the text distinguishes the two.
        if (!admin?.password) {
            await bcrypt.compare(password, DUMMY_HASH);
            throw new Error(messages.INVALID_CREDENTIALS);
        }

        const matches = await bcrypt.compare(password, admin.password);
        if (!matches) {
            throw new Error(messages.INVALID_CREDENTIALS);
        }

        return {
            token: generateJWT(admin),
            admin: toProfile(admin),
        };
    };

    getProfile = async (adminId: string): Promise<TAdminProfile> => {
        const admin = await userModel.findOne({
            _id: adminId,
            role: EUserRole.SUPER_ADMIN,
        });

        if (!admin) {
            throw new Error(messages.ADMIN_NOT_FOUND);
        }

        return toProfile(admin);
    };
}

export default AdminAuthService;
