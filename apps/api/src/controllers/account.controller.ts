import type { RequestHandler } from 'express';
import { getValidatedBody } from '../middleware/validate.js';
import type { EmailService } from '../services/email/emailService.js';
import {
  confirmEmailVerification,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
} from '../services/account/account.service.js';
import type {
  EmailVerificationConfirmInput,
  EmailVerificationRequestInput,
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
} from '../validation/phase4.schema.js';
import { AppError } from '../utils/AppError.js';

/**
 * Account recovery HTTP handlers. The service layer owns token semantics;
 * these handlers only translate between HTTP and the service, and convert an
 * invalid/expired confirmation into a safe 400.
 */
export function createAccountHandlers(emailService: EmailService): {
  requestVerification: RequestHandler;
  confirmVerification: RequestHandler;
  requestReset: RequestHandler;
  confirmReset: RequestHandler;
} {
  return {
    requestVerification: async (_req, res, next) => {
      try {
        const input = getValidatedBody<EmailVerificationRequestInput>(res);
        res.json(await requestEmailVerification(input.email, emailService));
      } catch (error) {
        next(error);
      }
    },

    confirmVerification: async (_req, res, next) => {
      try {
        const input = getValidatedBody<EmailVerificationConfirmInput>(res);
        const result = await confirmEmailVerification(input.token);
        if (!result.ok) {
          throw new AppError(400, result.message, 'TOKEN_INVALID');
        }
        res.json({ message: result.message });
      } catch (error) {
        next(error);
      }
    },

    requestReset: async (_req, res, next) => {
      try {
        const input = getValidatedBody<PasswordResetRequestInput>(res);
        res.json(await requestPasswordReset(input.email, emailService));
      } catch (error) {
        next(error);
      }
    },

    confirmReset: async (_req, res, next) => {
      try {
        const input = getValidatedBody<PasswordResetConfirmInput>(res);
        const result = await resetPassword(input.token, input.newPassword);
        if (!result.ok) {
          throw new AppError(400, result.message, 'TOKEN_INVALID');
        }
        res.json({ message: result.message });
      } catch (error) {
        next(error);
      }
    },
  };
}
