import axios from 'axios';
import { apiRoutes } from '@vivamama/contracts';

import axiosInstance from 'src/utils/axios';

// ----------------------------------------------------------------------

export type ConsultationStatus = 'PENDING' | 'COMPLETED' | 'UNHANDLED';

export type ConsultationType = 'EXPERT' | 'CARE_MANAGER';

export type PreferredSlot = 'MORNING' | 'AFTERNOON' | 'EVENING';

export type AdminProfile = {
  _id: string;
  email: string | null;
  role: string;
};

/** The patient, as populated by the listing endpoint. */
export type ConsultationUser = {
  _id: string;
  user_id?: number;
  email?: string | null;
  mobile_number?: string | null;
  country_code?: string | null;
  profile_picture?: string | null;
  onboarding_data?: { preferred_name?: string | null };
};

/** Either an expert or a care manager — the ref is resolved by consultationType. */
export type Consultant = {
  _id: string;
  name?: string;
  speciality?: string;
  phoneNumber?: string | null;
  contactWhatsappNumber?: string | null;
  email?: string | null;
};

export type Consultation = {
  _id: string;
  userId: ConsultationUser | null;
  consultatorId: Consultant | null;
  consultationType: ConsultationType;
  requestStatus: ConsultationStatus | null;
  preferred_consultation_date: string;
  preferred_slot: PreferredSlot | null;
  /** Resolved server-side so the panel never re-implements slot text. */
  preferred_slot_label: string | null;
  meeting_confirmed_at: string | null;
  meeting_link: string | null;
  createdAt: string;
};

export type ConsultationListParams = {
  page: number;
  limit: number;
  status?: ConsultationStatus | '';
  consultationType?: ConsultationType | '';
  search?: string;
};

export type ConsultationListResult = {
  items: Consultation[];
  total: number;
  page: number;
  limit: number;
};

// ----------------------------------------------------------------------

/**
 * Paths come from @vivamama/contracts, the canonical registry the backend routes
 * are defined against — so a path can't drift out of sync here without the
 * shared package changing too.
 */
export const endpoints = {
  login: apiRoutes.admin.auth.login,
  me: apiRoutes.admin.auth.me,
  consultations: apiRoutes.admin.consultations,
  reports: apiRoutes.admin.reports,
};

// ----------------------------------------------------------------------
// Moderation queue
//
// Play's UGC policy asks for moderation that is "robust, effective, and ongoing". The
// report button in the app is only half of that; this is the half where somebody
// actually looks. Types mirror the server's enums in types/moderation.types.ts.

export type ReportStatus = 'PENDING' | 'ACTIONED' | 'DISMISSED';

export type ReportTargetType = 'VIVA_CLUB_POST' | 'VIVA_CLUB_COMMENT' | 'AI_MESSAGE';

export type ReportReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'HATE'
  | 'SELF_HARM'
  | 'MISINFORMATION'
  | 'SEXUAL'
  | 'HARMFUL_ADVICE'
  | 'OTHER';

export type ReportAction = 'REMOVE' | 'DISMISS' | 'BAN_AUTHOR' | 'ACKNOWLEDGE';

/** A user as populated onto a report — reporter or the reported author. */
export type ReportUser = {
  _id: string;
  email?: string | null;
  mobile_number?: string | null;
  communityBanned?: boolean;
  onboarding_data?: { preferred_name?: string | null };
};

export type Report = {
  _id: string;
  targetType: ReportTargetType;
  targetId: string;
  targetAuthor: ReportUser | null;
  reporter: ReportUser | null;
  reason: ReportReason;
  details: string | null;
  /**
   * The reported text as it read when reported. The author can delete their post before
   * anyone reviews it, so this is often the only copy the reviewer will ever see.
   */
  snapshot: string;
  /**
   * The turn that produced the reported content — for an AI report, the question the
   * user asked. An answer cannot be judged without it, which is why it is captured; it
   * is her own health disclosure, which is why the app tells her before sending it.
   */
  contextSnapshot: string | null;
  status: ReportStatus;
  reviewedAt: string | null;
  reviewerNote: string | null;
  createdAt: string;
};

export type ReportListParams = {
  page: number;
  limit: number;
  status?: ReportStatus | '';
  targetType?: ReportTargetType | '';
};

export type ReportListResult = {
  reports: Report[];
  pagination: { currentPage: number; totalPages: number; total: number };
};

export async function getReports(
  params: ReportListParams,
  signal?: AbortSignal
): Promise<ReportListResult> {
  const res = await axiosInstance.get(endpoints.reports, {
    // Blank filters are dropped rather than sent as empty strings, matching
    // getConsultations — the server treats an absent param as "unfiltered".
    params: {
      page: params.page,
      limit: params.limit,
      ...(params.status ? { status: params.status } : {}),
      ...(params.targetType ? { targetType: params.targetType } : {}),
    },
    ...(signal ? { signal } : {}),
  });

  return res.data.data as ReportListResult;
}

export async function actionReport(id: string, action: ReportAction, note?: string) {
  const res = await axiosInstance.patch(`${endpoints.reports}/${id}`, {
    action,
    ...(note?.trim() ? { note: note.trim() } : {}),
  });
  return res.data.data as Report;
}

export async function login(email: string, password: string) {
  const res = await axiosInstance.post(endpoints.login, { email, password });
  return res.data.data as { token: string; admin: AdminProfile };
}

export async function getMe() {
  const res = await axiosInstance.get(endpoints.me);
  return res.data.data as AdminProfile;
}

export async function getConsultations(
  params: ConsultationListParams,
  signal?: AbortSignal
): Promise<ConsultationListResult> {
  const res = await axiosInstance.get(endpoints.consultations, {
    // Blank filters are dropped rather than sent as empty strings, so the server
    // sees an absent param and returns the unfiltered list.
    params: {
      page: params.page,
      limit: params.limit,
      ...(params.status ? { status: params.status } : {}),
      ...(params.consultationType ? { consultationType: params.consultationType } : {}),
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
    },
    ...(signal ? { signal } : {}),
  });

  return res.data.data as ConsultationListResult;
}

/**
 * `confirmedAt` must be a full ISO string with an offset — the server reasons in IST.
 *
 * Any time is accepted. One outside the window the patient requested comes back as a 409
 * rather than a write; re-send with `acknowledgeOutsideSlot` to let it through. See
 * {@link outsideSlotConflict}.
 */
export async function confirmTime(id: string, confirmedAt: string, acknowledgeOutsideSlot = false) {
  const res = await axiosInstance.patch(`${endpoints.consultations}/${id}/confirm-time`, {
    confirmedAt,
    acknowledgeOutsideSlot,
  });
  return res.data.data as Consultation;
}

/**
 * The 409 the server answers with when the confirmed time sits outside the requested
 * slot and the caller has not yet acknowledged it.
 *
 * Returns null for every other failure, so a caller can tell "needs a second look" apart
 * from a real error — the first is answered by asking again, not by showing a rejection.
 */
export function outsideSlotConflict(error: unknown): { message: string } | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) {
    return null;
  }

  const body = error.response?.data as
    | { message?: string; data?: { requires_confirmation?: boolean } }
    | undefined;

  if (!body?.data?.requires_confirmation) {
    return null;
  }

  return { message: body.message || 'This time is outside the slot the patient requested.' };
}

export async function markCompleted(id: string) {
  const res = await axiosInstance.put(`${endpoints.consultations}/${id}/completed`);
  return res.data.data as Consultation;
}

export async function markUnhandled(id: string) {
  const res = await axiosInstance.put(`${endpoints.consultations}/${id}/unhandled`);
  return res.data.data as Consultation;
}
