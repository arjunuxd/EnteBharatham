import { apiSend } from './api';

/**
 * Account-recovery calls.
 *
 * The request endpoints deliberately return the same message whether or not an
 * account exists. The UI must not add anything that defeats that property — for
 * example, by checking the response message for a specific account.
 */

export interface AccountMessageResponse {
  message: string;
}

export function requestEmailVerification(email: string): Promise<AccountMessageResponse> {
  return apiSend<AccountMessageResponse>('POST', '/account/verify-email/request', {
    email: email.trim(),
  });
}

export function confirmEmailVerification(token: string): Promise<AccountMessageResponse> {
  return apiSend<AccountMessageResponse>('POST', '/account/verify-email/confirm', {
    token: token.trim(),
  });
}

export function requestPasswordReset(email: string): Promise<AccountMessageResponse> {
  return apiSend<AccountMessageResponse>('POST', '/account/password-reset/request', {
    email: email.trim(),
  });
}

export function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<AccountMessageResponse> {
  return apiSend<AccountMessageResponse>('POST', '/account/password-reset/confirm', {
    token: token.trim(),
    newPassword,
  });
}
