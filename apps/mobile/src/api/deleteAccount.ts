import { API_DELETE_ACCOUNT } from "../constants/endpoints";
import apiClientInterceptor from "./apiClientInterceptor";

/** Per-collection row counts, plus the collections retained for legal reasons. */
export interface IDeleteAccountResponse {
  data: {
    deleted: Record<string, number>;
    retained: string[];
  };
  message: string;
  success: boolean;
}

/**
 * Permanently deletes the signed-in account and its data.
 *
 * There is no request body and no id: the server acts on the bearer token, so this
 * cannot be aimed at another account. Callers must confirm with the user first — it
 * is not reversible and there is no undo endpoint.
 */
export const deleteAccount = async (): Promise<IDeleteAccountResponse> => {
  return (await apiClientInterceptor().delete(API_DELETE_ACCOUNT)).data;
};
