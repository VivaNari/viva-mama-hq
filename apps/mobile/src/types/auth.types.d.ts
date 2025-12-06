export interface IRequestOtpResponse {
  message: string;
  success: boolean;
  verification_key?: string;
}
