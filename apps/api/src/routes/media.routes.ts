import { Router } from 'express';
import multer from 'multer';
import type { Env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import type { RateLimiters } from '../middleware/rateLimit.js';
import { HeritageMediaModel } from '../models/HeritageMedia.js';
import { HeritageRecordModel } from '../models/HeritageRecord.js';
import {
  deleteStoredMediaIfUnreferenced,
  loadMediaForDelivery,
} from '../services/media/media.service.js';
import {
  generateStorageKey,
  sanitizeDisplayName,
  storageKeyWithExtension,
  validateUploadedContent,
} from '../services/media/validation.js';
import { createStorageAdapter, type StorageAdapter } from '../services/storage/index.js';
import { AppError } from '../utils/AppError.js';

/**
 * Media routes.
 *
 * Uploads are authenticated, rate-limited, size-limited, MIME/signature
 * checked, and written under a server-generated opaque key. Delivery is
 * authorization-aware: a public record's media is served only while the
 * record is publicly eligible AND the media item itself is not
 * restricted/removed. Withdrawn or restricted records therefore cannot be
 * reached through a direct media URL, a stale browser cache, or an object
 * store path (the bucket is private; S3 delivery uses a short-lived signed
 * URL minted only after the API check).
 */
export function createMediaRoutes(
  env: Env,
  limiters?: RateLimiters,
  injectedStorage?: StorageAdapter,
): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.MEDIA_MAX_SIZE_BYTES, files: 1 },
  });
  const storage = injectedStorage ?? createStorageAdapter(env);

  router.post(
    '/:recordId/upload',
    requireAuth,
    ...(limiters !== undefined ? [limiters.mediaUploads] : []),
    upload.single('file'),
    async (req, res, next) => {
      try {
        if (!req.file) throw new AppError(400, 'No file uploaded', 'NO_FILE');

        const record = await HeritageRecordModel.findById(req.params.recordId).exec();
        if (!record) throw new AppError(404, 'Heritage record not found', 'RECORD_NOT_FOUND');
        const user = req.currentUser!;
        const isOwner = record.createdBy?.toString() === user.id;
        const isModerator = user.role === 'moderator' || user.role === 'admin';
        if (!isOwner && !isModerator) {
          throw new AppError(404, 'Heritage record not found', 'RECORD_NOT_FOUND');
        }
        if (!['draft', 'changes_requested'].includes(record.status)) {
          throw new AppError(
            403,
            'Cannot upload media for this record state',
            'UPLOAD_NOT_ALLOWED',
          );
        }

        let inspected: { mediaType: 'image' | 'audio' | 'document'; mime: string };
        try {
          inspected = validateUploadedContent(req.file.mimetype, req.file.buffer);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid file';
          throw new AppError(400, message, 'INVALID_FILE');
        }

        const count = await HeritageMediaModel.countDocuments({
          heritageRecordId: record._id,
          lifecycleState: { $ne: 'removed' },
        }).exec();
        if (count >= env.MEDIA_MAX_COUNT_PER_RECORD) {
          throw new AppError(400, 'Too many media files for this record', 'MEDIA_LIMIT_REACHED');
        }

        const baseKey = generateStorageKey('media');
        const storageKey = storageKeyWithExtension(baseKey, inspected.mime);
        const uploadResult = await storage.upload(storageKey, req.file.buffer, inspected.mime);
        let media;
        try {
          media = await HeritageMediaModel.create({
            heritageRecordId: record._id,
            storageKey: uploadResult.storageKey,
            verifiedMediaType: inspected.mediaType,
            mediaType: inspected.mime,
            detectedMime: inspected.mime,
            size: uploadResult.size,
            displayName: sanitizeDisplayName(req.file.originalname || 'file'),
            safeDisplayName: sanitizeDisplayName(req.file.originalname || 'file'),
            category:
              inspected.mediaType === 'audio'
                ? 'audio_recording'
                : inspected.mediaType === 'document'
                  ? 'document'
                  : 'photograph',
            uploaderId: user.id,
            lifecycleState: 'uploaded',
          });
        } catch (error) {
          // The object exists but the record did not: remove the orphan.
          try {
            await storage.delete(uploadResult.storageKey);
          } catch {
            console.error('[media] failed to clean up orphaned upload');
          }
          throw error;
        }

        res.status(201).json({
          media: {
            id: media._id.toString(),
            heritageRecordId: media.heritageRecordId.toString(),
            mediaType: media.verifiedMediaType,
            category: media.category,
            displayName: media.safeDisplayName,
            size: media.size,
            contentPath: `/api/v1/media/${media.heritageRecordId.toString()}/${media._id.toString()}/content`,
            createdAt: media.createdAt.toISOString(),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get('/:recordId', requireAuth, async (req, res, next) => {
    try {
      const record = await HeritageRecordModel.findById(req.params.recordId).exec();
      if (!record) throw new AppError(404, 'Heritage record not found', 'RECORD_NOT_FOUND');
      const user = req.currentUser!;
      const isOwner = record.createdBy?.toString() === user.id;
      const isModerator = user.role === 'moderator' || user.role === 'admin';
      if (!isOwner && !isModerator) {
        throw new AppError(404, 'Heritage record not found', 'RECORD_NOT_FOUND');
      }

      const media = await HeritageMediaModel.find({
        heritageRecordId: record._id,
        lifecycleState: { $ne: 'removed' },
      })
        .sort({ createdAt: 1 })
        .exec();

      res.json({
        media: media.map((item) => ({
          id: item._id.toString(),
          heritageRecordId: item.heritageRecordId.toString(),
          mediaType: item.verifiedMediaType,
          category: item.category,
          displayName: item.safeDisplayName,
          caption: item.caption,
          size: item.size,
          lifecycleState: item.lifecycleState,
          contentPath: `/api/v1/media/${item.heritageRecordId.toString()}/${item._id.toString()}/content`,
          createdAt: item.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Authorized media delivery. Public access requires a publicly eligible
   * record and a non-restricted, non-removed media item. Owners and
   * moderators may read draft media but never restricted/removed items.
   */
  router.get('/:recordId/:mediaId/content', async (req, res, next) => {
    try {
      const loaded = await loadMediaForDelivery(req.params.recordId, req.params.mediaId);
      if (loaded === null) {
        throw new AppError(404, 'Media not found', 'MEDIA_NOT_FOUND');
      }
      const { media } = loaded;
      const user = req.currentUser;
      const record = await HeritageRecordModel.findById(req.params.recordId)
        .select({ createdBy: 1 })
        .lean()
        .exec();
      const isOwner = record?.createdBy?.toString() === user?.id;
      const isModerator = user?.role === 'moderator' || user?.role === 'admin';

      if (!loaded.publiclyEligible && !isOwner && !isModerator) {
        throw new AppError(404, 'Media not found', 'MEDIA_NOT_FOUND');
      }
      if (media.lifecycleState === 'restricted' || media.lifecycleState === 'removed') {
        throw new AppError(404, 'Media not found', 'MEDIA_NOT_FOUND');
      }
      if (
        loaded.publiclyEligible &&
        !isOwner &&
        !isModerator &&
        media.lifecycleState !== 'uploaded' &&
        media.lifecycleState !== 'published'
      ) {
        throw new AppError(404, 'Media not found', 'MEDIA_NOT_FOUND');
      }

      // Revocation must be immediate, so media is never stored by a browser or
      // intermediary, even when the record is public today.
      res.set('Cache-Control', 'private, no-store');
      res.set('X-Content-Type-Options', 'nosniff');
      // The web app is served from a different origin in production. The
      // endpoint is authorization-aware and safe to embed as an image/audio
      // resource; Helmet's default same-origin CORP would block that.
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      // Sandbox PDFs/images so a same-origin embed cannot run active content.
      res.set('Content-Security-Policy', "default-src 'none'; sandbox");

      if (storage.getSignedUrl !== undefined && env.STORAGE_PROVIDER === 's3') {
        const url = await storage.getSignedUrl(media.storageKey, env.MEDIA_SIGNED_URL_TTL_SECONDS);
        if (url !== null) {
          res.redirect(302, url);
          return;
        }
      }

      const object = await storage.getObject(media.storageKey);
      if (object === null) {
        throw new AppError(404, 'Media not found', 'MEDIA_NOT_FOUND');
      }
      res.set('Content-Type', media.detectedMime);
      res.set(
        'Content-Disposition',
        `inline; filename="${sanitizeDisplayName(media.safeDisplayName || 'media')}"`,
      );
      res.send(object.content);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:recordId/:mediaId', requireAuth, async (req, res, next) => {
    try {
      const record = await HeritageRecordModel.findById(req.params.recordId).exec();
      if (!record) throw new AppError(404, 'Heritage record not found', 'RECORD_NOT_FOUND');
      const user = req.currentUser!;
      const isOwner = record.createdBy?.toString() === user.id;
      const isModerator = user.role === 'moderator' || user.role === 'admin';
      if (!isOwner && !isModerator) {
        throw new AppError(404, 'Heritage record not found', 'RECORD_NOT_FOUND');
      }
      if (record.status === 'published' && !isModerator) {
        throw new AppError(
          409,
          'Published media must be withdrawn through governance',
          'WITHDRAWAL_REQUIRED',
        );
      }

      const media = await HeritageMediaModel.findOne({
        _id: req.params.mediaId,
        heritageRecordId: record._id,
      }).exec();
      if (!media) throw new AppError(404, 'Media not found', 'MEDIA_NOT_FOUND');

      media.lifecycleState = 'removed';
      await media.save();
      try {
        await deleteStoredMediaIfUnreferenced(storage, media);
      } catch {
        // Idempotent/logged only: the DB state already denies delivery.
        console.error('[media] failed to delete object during removal');
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
