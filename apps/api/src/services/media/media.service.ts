import type { Types } from 'mongoose';
import { HeritageMediaModel, type HeritageMediaFields } from '../../models/HeritageMedia.js';
import { HeritageRecordModel } from '../../models/HeritageRecord.js';
import { PUBLIC_ELIGIBILITY_FILTER } from '../heritage.service.js';
import type { StorageAdapter } from '../storage/index.js';

/**
 * Media lifecycle helpers shared by upload, deletion, and governance actions.
 *
 * Object deletion is always guarded by a reference check: a storage key that
 * is still referenced by any other media document (including one that is only
 * soft-removed) is never deleted. Combined with lifecycle checks at delivery
 * time, this makes withdrawal/removal safe and idempotent.
 */

export async function isStorageKeyReferenced(
  storageKey: string,
  excludingMediaId?: Types.ObjectId | string,
): Promise<boolean> {
  const filter: Record<string, unknown> = { storageKey };
  if (excludingMediaId !== undefined) {
    filter._id = { $ne: excludingMediaId };
  }
  const existing = await HeritageMediaModel.exists(filter);
  return existing !== null;
}

/** Deletes the object only when no other media document references the key. */
export async function deleteStoredMediaIfUnreferenced(
  storage: StorageAdapter,
  media: Pick<HeritageMediaFields, '_id' | 'storageKey'>,
): Promise<void> {
  if (await isStorageKeyReferenced(media.storageKey, media._id)) {
    return;
  }
  await storage.delete(media.storageKey);
}

/**
 * Removes every media document belonging to a deleted record and best-effort
 * deletes the stored objects. Documents are removed first so the reference
 * check no longer counts them; storage failures never fail the record
 * deletion because the database state already prevents delivery.
 */
export async function deleteRecordMedia(
  recordId: Types.ObjectId | string,
  storage?: StorageAdapter,
): Promise<void> {
  const media = await HeritageMediaModel.find({ heritageRecordId: recordId })
    .select({ _id: 1, storageKey: 1 })
    .lean()
    .exec();
  if (media.length === 0) return;

  await HeritageMediaModel.deleteMany({ heritageRecordId: recordId }).exec();
  if (storage === undefined) return;

  for (const item of media) {
    try {
      await deleteStoredMediaIfUnreferenced(
        storage,
        item as Pick<HeritageMediaFields, '_id' | 'storageKey'>,
      );
    } catch {
      // Physical cleanup is best-effort; the record and its media rows are gone.
      console.error('[media] failed to delete record media object');
    }
  }
}

/**
 * Applies a restrictive lifecycle transition to every media item of a record
 * and physically removes objects for the `removed` terminal state. Safe to
 * call repeatedly: a repeated transition is a no-op and object deletion is
 * idempotent.
 */
export async function restrictRecordMedia(
  recordId: Types.ObjectId | string,
  lifecycleState: 'restricted' | 'removed',
  storage?: StorageAdapter,
): Promise<void> {
  await HeritageMediaModel.updateMany(
    { heritageRecordId: recordId, lifecycleState: { $ne: lifecycleState } },
    { $set: { lifecycleState } },
  ).exec();

  if (lifecycleState !== 'removed' || storage === undefined) return;

  const media = await HeritageMediaModel.find({ heritageRecordId: recordId }).lean().exec();
  for (const item of media) {
    try {
      await deleteStoredMediaIfUnreferenced(storage, item as HeritageMediaFields);
    } catch {
      // Physical cleanup is best-effort; the DB state already denies access.
      console.error('[media] failed to delete withdrawn object');
    }
  }
}

export interface MediaDelivery {
  media: HeritageMediaFields;
  publiclyEligible: boolean;
}

/**
 * Resolves a media item for delivery. Returns null when the media does not
 * belong to the record. Access rules are applied by the route so that both
 * owner/moderation views and public delivery share one lookup.
 */
export async function loadMediaForDelivery(
  recordId: string,
  mediaId: string,
): Promise<MediaDelivery | null> {
  const record = await HeritageRecordModel.findOne({
    _id: recordId,
    ...PUBLIC_ELIGIBILITY_FILTER,
  })
    .select({ _id: 1 })
    .lean()
    .exec();

  const media = await HeritageMediaModel.findOne({
    _id: mediaId,
    heritageRecordId: recordId,
  })
    .lean()
    .exec();

  if (media === null) return null;
  return { media: media as HeritageMediaFields, publiclyEligible: record !== null };
}
