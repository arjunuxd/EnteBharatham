import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  correctionProposalSchema,
  correctionReviewSchema,
  profileUpdateSchema,
  reportResolutionSchema,
  reportSubmissionSchema,
  translationCreateSchema,
  withdrawalActionSchema,
  withdrawalRequestSchema,
} from '../validation/phase4.schema.js';
import { TranslationModel } from '../models/Translation.js';
import { HeritageRecordModel } from '../models/HeritageRecord.js';
import { UserModel } from '../models/User.js';
import {
  actionWithdrawal,
  listCorrections,
  listReports,
  listWithdrawals,
  proposeCorrection,
  requestWithdrawal,
  resolveReport,
  reviewCorrection,
  submitReport,
} from '../services/governance.service.js';
import { AppError } from '../utils/AppError.js';
import type { RateLimiters } from '../middleware/rateLimit.js';
import { objectIdParamSchema } from '../validation/heritageWrite.schema.js';
import { PUBLIC_ELIGIBILITY_FILTER } from '../services/heritage.service.js';
import type { StorageAdapter } from '../services/storage/index.js';

/** Validated id path parameter — a malformed id is a 400, not a silent miss. */
function pathId(raw: string | string[] | undefined): string {
  const value = typeof raw === 'string' ? raw : '';
  const parsed = objectIdParamSchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid id', 'VALIDATION_ERROR');
  }
  return parsed.data;
}

/**
 * Phase 4 surface, hardened in Phase 6: community reports, corrections,
 * withdrawals, translations, public profiles, and account actions.
 *
 * The governance endpoints delegate to `governance.service.ts`, which owns
 * the rules (record existence, ownership, whitelists, audit events). The
 * handlers here only translate between HTTP and the service.
 */
export function createPhase4Routes(
  limiters: Pick<RateLimiters, 'publicRead' | 'publicReports' | 'moderationActions'>,
  storage?: StorageAdapter,
): Router {
  const router = Router();

  // Reports
  router.post(
    '/reports',
    requireAuth,
    limiters.publicReports,
    validateBody(reportSubmissionSchema),
    async (req, res, next) => {
      try {
        const report = await submitReport(req.currentUser!, {
          heritageRecordId: req.body.heritageRecordId,
          category: req.body.category,
          explanation: req.body.explanation,
        });
        res.status(201).json({ report });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/reports', requireRole('moderator', 'admin'), async (_req, res, next) => {
    try {
      res.json({ reports: await listReports() });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/reports/:id/resolution',
    requireRole('moderator', 'admin'),
    limiters.moderationActions,
    validateBody(reportResolutionSchema),
    async (req, res, next) => {
      try {
        const report = await resolveReport(req.currentUser!, pathId(req.params.id), {
          status: req.body.status,
          resolutionCategory: req.body.resolutionCategory,
          decisionNote: req.body.decisionNote,
        });
        res.json({ report });
      } catch (err) {
        next(err);
      }
    },
  );

  // Corrections
  router.post(
    '/corrections',
    requireAuth,
    limiters.publicReports,
    validateBody(correctionProposalSchema),
    async (req, res, next) => {
      try {
        const correction = await proposeCorrection(req.currentUser!, {
          heritageRecordId: req.body.heritageRecordId,
          proposedChanges: req.body.proposedChanges,
          rationale: req.body.rationale,
        });
        res.status(201).json({ correction });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/corrections', requireRole('moderator', 'admin'), async (_req, res, next) => {
    try {
      res.json({ corrections: await listCorrections() });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/corrections/:id/review',
    requireRole('moderator', 'admin'),
    limiters.moderationActions,
    validateBody(correctionReviewSchema),
    async (req, res, next) => {
      try {
        const correction = await reviewCorrection(req.currentUser!, pathId(req.params.id), {
          status: req.body.status,
          decisionNote: req.body.decisionNote,
        });
        res.json({ correction });
      } catch (err) {
        next(err);
      }
    },
  );

  // Withdrawals
  router.post(
    '/withdrawals',
    requireAuth,
    limiters.publicReports,
    validateBody(withdrawalRequestSchema),
    async (req, res, next) => {
      try {
        const withdrawal = await requestWithdrawal(req.currentUser!, {
          heritageRecordId: req.body.heritageRecordId,
          mediaId: req.body.mediaId,
          type: req.body.type,
          reason: req.body.reason,
          details: req.body.details,
        });
        res.status(201).json({ withdrawal });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/withdrawals', requireRole('moderator', 'admin'), async (_req, res, next) => {
    try {
      res.json({ withdrawals: await listWithdrawals() });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/withdrawals/:id/action',
    requireRole('moderator', 'admin'),
    limiters.moderationActions,
    validateBody(withdrawalActionSchema),
    async (req, res, next) => {
      try {
        const withdrawal = await actionWithdrawal(
          req.currentUser!,
          pathId(req.params.id),
          {
            status: req.body.status,
            actionTaken: req.body.actionTaken,
          },
          storage,
        );
        res.json({ withdrawal });
      } catch (err) {
        next(err);
      }
    },
  );

  // Translations
  router.post(
    '/translations',
    requireAuth,
    limiters.publicReports,
    validateBody(translationCreateSchema),
    async (req, res, next) => {
      try {
        const parent = await HeritageRecordModel.findOne({
          _id: req.body.parentRecordId,
          ...PUBLIC_ELIGIBILITY_FILTER,
        }).exec();
        if (!parent) throw new AppError(404, 'Parent record not found', 'NOT_FOUND');
        const isOwner = parent.createdBy?.toString() === req.currentUser?.id;
        const isMod = req.currentUser?.role === 'moderator' || req.currentUser?.role === 'admin';
        if (!isOwner && !isMod) {
          throw new AppError(
            403,
            'Only the record owner or a moderator can add a translation',
            'FORBIDDEN',
          );
        }
        const exists = await TranslationModel.findOne({
          parentRecordId: req.body.parentRecordId,
          languageCode: req.body.languageCode,
        });
        if (exists)
          throw new AppError(
            400,
            'Translation already exists for this language',
            'DUPLICATE_TRANSLATION',
          );
        const t = await TranslationModel.create({
          parentRecordId: req.body.parentRecordId,
          languageCode: req.body.languageCode,
          languageDisplay: req.body.languageDisplay,
          title: req.body.title,
          summary: req.body.summary,
          content: req.body.content,
          translatorId: req.currentUser?.id as unknown as import('mongoose').Types.ObjectId,
          translatorAttribution: req.body.translatorAttribution,
          translationSource: req.body.translationSource,
          rightsStatus: req.body.rightsStatus,
          consentStatus: req.body.consentStatus,
          status: 'draft',
        });
        res.status(201).json({ translation: { id: t._id.toString() } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/translations/:parentId', limiters.publicRead, async (req, res, next) => {
    try {
      const parent = await HeritageRecordModel.findOne({
        _id: req.params.parentId,
        ...PUBLIC_ELIGIBILITY_FILTER,
      })
        .select({ _id: 1 })
        .lean()
        .exec();
      if (!parent) {
        res.json({ translations: [] });
        return;
      }
      const list = await TranslationModel.find({
        parentRecordId: req.params.parentId,
        status: 'published',
      })
        .limit(50)
        .maxTimeMS(3_000)
        .exec();
      res.set('Cache-Control', 'public, no-cache');
      res.json({
        translations: list.map((t) => ({
          id: t._id.toString(),
          parentRecordId: t.parentRecordId.toString(),
          languageCode: t.languageCode,
          languageDisplay: t.languageDisplay,
          title: t.title,
          status: t.status,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/translations/by-id/:id', limiters.publicRead, async (req, res, next) => {
    try {
      const t = await TranslationModel.findById(req.params.id).exec();
      if (!t || t.status !== 'published')
        throw new AppError(404, 'Translation not found', 'TRANSLATION_NOT_FOUND');
      const parent = await HeritageRecordModel.findOne({
        _id: t.parentRecordId,
        ...PUBLIC_ELIGIBILITY_FILTER,
      })
        .select({ _id: 1 })
        .lean()
        .exec();
      if (!parent) throw new AppError(404, 'Translation not found', 'TRANSLATION_NOT_FOUND');
      res.set('Cache-Control', 'public, no-cache');
      res.json({
        translation: {
          id: t._id.toString(),
          parentRecordId: t.parentRecordId.toString(),
          languageCode: t.languageCode,
          languageDisplay: t.languageDisplay,
          title: t.title,
          summary: t.summary,
          content: t.content,
          translatorAttribution: t.translatorAttribution,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // Profiles
  router.get('/profiles/:userId', limiters.publicRead, async (req, res, next) => {
    try {
      // A suspended, deleted, or private account has no public profile, even
      // if a stale publicProfileEnabled flag was left enabled.
      const user = await UserModel.findOne({
        _id: req.params.userId,
        publicProfileEnabled: true,
        accountStatus: 'active',
      }).exec();
      if (!user) throw new AppError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
      const contributions = await HeritageRecordModel.find({
        createdBy: user._id,
        status: 'published',
        visibility: 'public',
        'consent.permissionToPublish': true,
      })
        .select({ _id: 1, slug: 1, title: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .limit(50)
        .maxTimeMS(5_000)
        .exec();
      res.set('Cache-Control', 'public, no-cache');
      res.json({
        profile: {
          id: user._id.toString(),
          displayName: user.displayName,
          attributionName: user.attributionName,
          bio: user.bio,
          memberSince: user.createdAt.toISOString(),
          publicProfileEnabled: user.publicProfileEnabled,
          contributions: contributions.map((c) => ({
            id: c._id.toString(),
            slug: c.slug,
            title: c.title,
            createdAt: c.createdAt.toISOString(),
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch(
    '/profiles/me',
    requireAuth,
    validateBody(profileUpdateSchema),
    async (req, res, next) => {
      try {
        const user = await UserModel.findById(req.currentUser?.id).exec();
        if (!user) throw new AppError(401, 'Not authenticated', 'NOT_AUTHENTICATED');
        if (req.body.displayName !== undefined) user.displayName = req.body.displayName;
        if (req.body.attributionName !== undefined) user.attributionName = req.body.attributionName;
        if (req.body.bio !== undefined) user.bio = req.body.bio;
        if (req.body.publicProfileEnabled !== undefined)
          user.publicProfileEnabled = req.body.publicProfileEnabled;
        await user.save();
        res.json({ profile: { id: user._id.toString(), displayName: user.displayName } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
