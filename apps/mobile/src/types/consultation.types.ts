import { PreferredSlot } from "../constants/consultationSlots";
import { ICareManager, RequestCallbackStatusEnum } from "./careManager.types";
import { IExpert } from "./expert.types";

export interface IUserActiveConsultations {
  _id: string;
  userId: string;
  consultatorId: IExpert | ICareManager;
  consultationType: ConsultationTypeEnum;
  requestStatus: RequestCallbackStatusEnum;
  createdAt: string;
  preferred_consultation_date: string;
  /** The window the patient asked for. Null on bookings made before slots existed. */
  preferred_slot: PreferredSlot | null;
  /** The Google Meet URL. Null until it is generated — or pasted in by hand. */
  meeting_link: string | null;
  /** The exact start the team agreed with the consultant. Null until confirmed. */
  meeting_confirmed_at: string | null;
  /**
   * Five minutes before meeting_confirmed_at, computed server-side so the app never
   * has to reason about timezones — it only ever compares instants.
   */
  joinUnlocksAt: string | null;
  /**
   * Whether the Join button should be live as of the moment this response was built.
   * The banner re-derives it on a timer too, so a screen left open still unlocks.
   */
  canJoinNow: boolean;
}

export enum ConsultationTypeEnum {
  CARE_MANAGER = "CARE_MANAGER",
  EXPERT = "EXPERT",
}

/**
 * Which tab a booking belongs under on the consultation history screen. Decided
 * server-side so the app never compares an IST booking against a device clock that
 * may be set to another timezone.
 */
export enum EConsultationStage {
  /** Not settled and its start is still ahead. */
  UPCOMING = "UPCOMING",
  /** Started but not yet closed off by the team. */
  ONGOING = "ONGOING",
  /** COMPLETED, or UNHANDLED and refunded. */
  PAST = "PAST",
}

/** The display-only consultant slice the history endpoint returns. */
export interface IConsultationHistoryConsultator {
  _id: string;
  name: string;
  /** Experts only — care managers have no speciality. */
  speciality: string | null;
  photograph: string | null;
}

export interface IUserConsultationHistory {
  _id: string;
  consultationType: ConsultationTypeEnum;
  requestStatus: RequestCallbackStatusEnum;
  stage: EConsultationStage;
  /** The confirmed start, falling back to the day the patient booked for. */
  startsAt: string;
  preferred_consultation_date: string;
  preferred_slot: PreferredSlot | null;
  meeting_confirmed_at: string | null;
  meeting_link: string | null;
  paymentMode: string | null;
  createdAt: string;
  joinUnlocksAt: string | null;
  canJoinNow: boolean;
  consultator: IConsultationHistoryConsultator | null;
  /** The score already left for this consultation, null while unrated. */
  rating: number | null;
}

export interface IUserConsultationHistoryResponse {
  data: IUserConsultationHistory[];
  message: string;
  statusCode: number;
  success: boolean;
}

export interface IUserActiveConsultationsResponse {
  data: IUserActiveConsultations[];
  message: string;
  statusCode: number;
  success: boolean;
}
