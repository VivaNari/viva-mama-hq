import { JWT } from "google-auth-library";
import env from "../../config/env";

const MEET_SPACES_ENDPOINT = "https://meet.googleapis.com/v2/spaces";
const MEET_SCOPE = "https://www.googleapis.com/auth/meetings.space.created";

export interface IMeetSpace {
    /** The join URL handed to the patient, e.g. https://meet.google.com/abc-defg-hij */
    meetingUri: string;
    /** The Meet API's own handle, e.g. "spaces/LLBNczMx8-8B" */
    spaceName: string;
}

/**
 * Creates Google Meet rooms for consultations.
 *
 * Why the Meet API rather than a Calendar event with conferenceData: a Calendar event
 * requires a start time at creation, and at booking time nobody knows it yet — the
 * patient picks a 3-hour window and the coordinator pins down the exact half hour later.
 * A Meet space has no time attached, so the link can be generated immediately and the
 * confirmed time lives entirely in our own collection. Calendar also gives no way to set
 * accessType, which is the setting that keeps patients out of a knock-to-enter lobby.
 *
 * Auth is a service account impersonating a real Workspace user via domain-wide
 * delegation — the scope is principal-scoped, so a service account acting as itself
 * cannot create spaces at all.
 */
class MeetSpaceService {
    private client: JWT | null = null;

    /**
     * Built once and reused: the JWT client caches its access token and refreshes it on
     * expiry, so re-creating it per booking would mean a fresh token round-trip each time.
     * Returns null when Meet is switched off or misconfigured, which every caller treats
     * as "no link yet" rather than an error.
     */
    private getClient(): JWT | null {
        if (this.client) return this.client;

        if (!env.GOOGLE_MEET_ENABLED) return null;

        if (!env.GOOGLE_MEET_SA_KEY_JSON || !env.GOOGLE_MEET_IMPERSONATED_USER) {
            console.error(
                "[MeetSpaceService] GOOGLE_MEET_ENABLED is true but the key JSON or impersonated user is missing — links will not be generated.",
            );
            return null;
        }

        try {
            const key = JSON.parse(env.GOOGLE_MEET_SA_KEY_JSON);
            this.client = new JWT({
                email: key.client_email,
                key: key.private_key,
                scopes: [MEET_SCOPE],
                subject: env.GOOGLE_MEET_IMPERSONATED_USER,
            });
            return this.client;
        } catch (error) {
            console.error("[MeetSpaceService] Failed to parse the service account key", error);
            return null;
        }
    }

    /**
     * Create a room for one consultation.
     *
     * Never throws. A booking has already taken the patient's money or a credit by the
     * time this runs, so a Meet outage must degrade to "link to follow" rather than
     * failing the booking.
     */
    public async createMeetSpace(): Promise<IMeetSpace | null> {
        const client = this.getClient();
        if (!client) return null;

        try {
            const response = await client.request<{ name: string; meetingUri: string }>({
                url: MEET_SPACES_ENDPOINT,
                method: "POST",
                data: {
                    config: {
                        // OPEN is the point of using this API: anyone holding the link joins
                        // straight in. The default (TRUSTED) would drop every patient, who is
                        // external to the workspace, into a lobby waiting to be admitted.
                        accessType: "OPEN",
                        entryPointAccess: "ALL",
                    },
                },
            });

            const { name, meetingUri } = response.data;
            if (!meetingUri) {
                console.error("[MeetSpaceService] Meet API returned no meetingUri", response.data);
                return null;
            }

            return { meetingUri, spaceName: name };
        } catch (error: any) {
            console.error(
                "[MeetSpaceService] Failed to create a meeting space",
                error?.response?.data || error?.message || error,
            );
            return null;
        }
    }
}

export const meetSpaceService = new MeetSpaceService();
