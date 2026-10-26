import type { FeedbackKind, FeedbackVisibility } from '@entebharatham/shared';
import { FEEDBACK_KINDS, FEEDBACK_VISIBILITIES } from '@entebharatham/shared';
import { Schema, model, type Types } from 'mongoose';

/**
 * Structured review feedback (Phase 6).
 *
 * One collection holds both sides of the exchange so the thread order is
 * preserved:
 *
 * - `visibility: 'contributor'` — guidance the contributor is meant to read
 *   and act on (including the contributor's own replies).
 * - `visibility: 'internal'` — a moderator-only note. Internal notes are
 *   never included in contributor-facing responses.
 *
 * Messages are append-only: resolving a message stamps it, it never deletes
 * it, so the resolution history stays auditable.
 */

export interface ReviewFeedbackFields {
  _id: Types.ObjectId;
  recordId: Types.ObjectId;
  /** Set when this message replies to an earlier one. */
  parentId?: Types.ObjectId;
  kind: FeedbackKind;
  message: string;
  /** Record path the feedback refers to (e.g. `sources[0].collectedOn`). */
  field?: string;
  visibility: FeedbackVisibility;
  authorId?: Types.ObjectId;
  authorRole: string;
  resolvedAt?: Date;
  resolvedById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewFeedbackSchema = new Schema(
  {
    recordId: { type: Schema.Types.ObjectId, ref: 'HeritageRecord', required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'ReviewFeedback' },
    kind: { type: String, enum: FEEDBACK_KINDS, required: true, default: 'general' },
    message: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    field: { type: String, trim: true, maxlength: 120 },
    visibility: {
      type: String,
      enum: FEEDBACK_VISIBILITIES,
      required: true,
      default: 'contributor',
    },
    authorId: { type: Schema.Types.ObjectId, ref: 'User' },
    authorRole: { type: String, maxlength: 40, default: 'contributor' },
    resolvedAt: { type: Date },
    resolvedById: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

// Thread reads are always "record + oldest first".
ReviewFeedbackSchema.index({ recordId: 1, createdAt: 1, _id: 1 });
// Unresolved contributor-visible items for a record.
ReviewFeedbackSchema.index({ recordId: 1, visibility: 1, resolvedAt: 1 });

export const ReviewFeedbackModel = model<ReviewFeedbackFields>(
  'ReviewFeedback',
  ReviewFeedbackSchema,
);
