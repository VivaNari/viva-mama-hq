export interface IExpert {
  _id: string;
  name: string;
  speciality: string;
  qualification: string;
  yearsOfExperience: number;
  bio: string;
  photograph: string;
  remuneration: number;
  /**
   * Whether a subscription consultation credit may be spent on this expert. Off-panel
   * experts set their own fee and are pay-per-session only, however many credits the
   * user holds.
   *
   * Optional, and absent must be read as false — an app build that outruns the server
   * deploy has to fail closed rather than offer a credit the server will refuse.
   */
  is_empanelled_expert?: boolean;
  category?: IExpertCategory;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

export interface IExpertResponse {
  statusCode: number;
  success: boolean;
  data: IExpert[];
  message: string;
}
export interface IExpertByIdResponse {
  statusCode: number;
  success: boolean;
  data: IExpert;
  message: string;
}

/**
 * Matches the `expert_categories` collection shape returned by the backend
 * after populate. The `translations` blob is stripped server-side before
 * serving, so it never appears on the client.
 */
export interface IExpertCategory {
  _id: string;
  key: string;
  name: string;
  description: string;
  coveredAreas: string[];
  isActive: boolean;
}

export interface IExpertLoadingState {
  uiLoading: boolean;
  paymentLoading: boolean;
}
