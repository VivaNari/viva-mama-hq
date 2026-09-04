export enum UserCategoryEnum {
  PP = 'PP', // Postpartum_Women
  NP = 'NP', // Non_Postpartum_Pregnant Women
  NN = 'NN', // Non-Postpartum Non-Pregnant Women
}

export type UserCategoryType =
  | UserCategoryEnum.PP
  | UserCategoryEnum.NP
  | UserCategoryEnum.NN;

export interface IUser {
  user_category: UserCategoryEnum;
  email: string;
  mobile_number: string | null;
  country_code: string | null;
  profile_picture: string | null;
  is_onboarded: {
    is_questionnaire_completed: boolean;
    is_subscription_completed: boolean;
  };
  childs: IChild[] | [];
  partner_referral_code: string | null;
  referral_code: string | null;
  referred_user_id: number | null;
  /**
   * The expert who referred this user, stored as an ObjectId string on the server.
   * Present only when the user has submitted a referral code via the ReferralCode screen.
   * Used by the Experts screen to pin that doctor as "Your own doctor" at the top.
   */
  referred_by_expert_id: string | null;
  FCM_token: string;
  current_weekdays: {
    weeks: number | null;
    days: number | null;
    /** Whole days until the NEXT check-in opens. 0 on the day one opens. */
    upcoming_checkin_due_days: number;
    /** Whole days ELAPSED since the current check-in opened. 0 on opening day. */
    previous_checkin_due_days: number;
  };
  /**
   * The check-in open for her current week, or null once it is completed.
   * The due-day counters are pure date maths and cannot express completion, so this is
   * what decides whether the dashboard offers the check-in or counts down to the next.
   */
  active_checkin: {
    week: number;
    state: 'PENDING' | 'ACTIVE';
    daysLeft: number;
  } | null;
  /**
   * True once she is past the end of the check-in programme, at which point the
   * dashboard hides the check-in entirely. The server owns the ceiling so extending
   * the programme never needs an app release. Distinct from `active_checkin === null`,
   * which merely means this week's is done.
   */
  checkin_programme_ended: boolean;
  is_breastfeeding_currently: boolean;
  onboarding_data: {
    preferred_name: string | null;
    date_of_birth: Date | null;
    location: string | null;
    is_not_pragnant_yet: boolean | null;
    delivery_date: Date | null;
    conception_method: ConceptionMethod | null;
    pregnancy_conditions: PregnancyConditionEnum[] | [];
    delivery_type: DeliveryTypeEnum | null;
    delivery_outcome: DeliveryOutcomeEnum | null;
    /**
     * How she is feeding her baby. Asked of postpartum mothers only, so null is a
     * normal value — it means the question was never put to her (NP/NN, or she
     * onboarded before it existed), not that she declined to answer.
     */
    feeding_method: FeedingMethodEnum | null;
    past_medications: PastMedicationEnum[] | [];
    current_medications: CurrentMedicationEnum[] | [];
    tobacco_use: TobaccoUseEnum | null;
    alcohol_use: AlcoholUseEnum | null;
    social_support: SocialSupportEnum | null;
    parity: ParityEnum | null;
    onboarded_at: Date | null;
  };
  subscription: {
    plan: string | null;
    status: string | null;
    billingCycle: string | null;
    expiryDate: Date | null;
  };
  np_weeks: number;
}
export interface IChild {
  name: string;
  date_of_birth: Date;
  sex: 'Male' | 'Female' | 'Other';
  child_id?: number;
}

export enum ESex {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHER = 'Other',
}

export type TUsercategory =
  | UserCategoryEnum.NN
  | UserCategoryEnum.PP
  | UserCategoryEnum.NP;

export enum ConceptionMethod {
  NATURAL = 'natural',
  IVF = 'ivf',
}

export enum PregnancyConditionEnum {
  ANEMIA = 'anemia',
  GESTATIONAL_DIABETES = 'gestational_diabetes',
  HIGH_BP = 'high_bp',
  OBESITY = 'obesity',
  THYROID = 'thyroid',
  FIBROIDS = 'fibroids',
  TWIN = 'twin',
  NONE = 'none',
}

export enum DeliveryTypeEnum {
  VAGINAL = 'vaginal',
  C_SECTION = 'c_section',
}

export enum DeliveryOutcomeEnum {
  LIVE_BIRTH = 'live_birth',
  STILL_BIRTH = 'still_birth',
}

/**
 * Mirrors the server's FeedingMethodEnum. MIXED counts as breastfeeding there:
 * `is_breastfeeding_currently` is derived as "anything but NOT_BREASTFEEDING".
 */
export enum FeedingMethodEnum {
  ONLY_BREASTMILK = 'only_breastmilk',
  MIXED = 'mixed',
  NOT_BREASTFEEDING = 'not_breastfeeding',
}

export enum PastMedicationEnum {
  PMOS = 'pmos',
  ANEMIA = 'history_anemia',
  THYROID = 'history_thyroid',
  DIABETES = 'history_diabetes',
  DEPRESSION = 'history_depression',
  ANXIETY = 'history_anxiety',
  NONE = 'history_none',
}

export enum CurrentMedicationEnum {
  THYROID = 'meds_thyroid',
  DIABETES = 'meds_diabetes',
  BP = 'meds_bp',
  DEPRESSION = 'meds_depression',
  ANXIETY = 'meds_anxiety',
  NONE = 'meds_none',
}

export enum TobaccoUseEnum {
  NEVER = 'never',
  OCCASIONALLY = 'occasionally',
  REGULARLY = 'regularly',
}

export enum AlcoholUseEnum {
  NEVER = 'never',
  OCCASIONALLY = 'occasionally',
  REGULARLY = 'regularly',
}

export enum SocialSupportEnum {
  FAMILY_HELP = 'family_help',
  PARTNER_SHARED = 'partner_shared',
  MANAGE_ALONE = 'manage_alone',
}

export enum ParityEnum {
  FIRST_TIME = 'first_time',
  MULTIPAROUS = 'multiparous',
}
