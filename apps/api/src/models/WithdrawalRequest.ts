import { Schema, model, type Types } from 'mongoose';

export interface WithdrawalRequestFields {
  _id: Types.ObjectId;
  heritageRecordId?: Types.ObjectId;
  mediaId?: Types.ObjectId;
  type: 'contributor_withdrawal' | 'community_report' | 'moderator_initiated';
  status: 'requested' | 'under_review' | 'restricted' | 'unpublished' | 'removed' | 'dismissed';
  reason: string;
  details?: string;
  requestedById?: Types.ObjectId;
  reviewedById?: Types.ObjectId;
  actionTaken?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalRequestSchema = new Schema(
  {
    heritageRecordId: { type: Schema.Types.ObjectId, ref: 'HeritageRecord' },
    mediaId: { type: Schema.Types.ObjectId, ref: 'HeritageMedia' },
    type: {
      type: String,
      enum: ['contributor_withdrawal', 'community_report', 'moderator_initiated'],
      required: true,
    },
    status: {
      type: String,
      enum: ['requested', 'under_review', 'restricted', 'unpublished', 'removed', 'dismissed'],
      default: 'requested',
      index: true,
    },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    details: { type: String, trim: true, maxlength: 2000 },
    requestedById: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedById: { type: Schema.Types.ObjectId, ref: 'User' },
    actionTaken: { type: String, trim: true, maxlength: 1000 },
    reviewedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

export const WithdrawalRequestModel = model<WithdrawalRequestFields>(
  'WithdrawalRequest',
  WithdrawalRequestSchema,
);
