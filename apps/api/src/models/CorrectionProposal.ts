import { Schema, model, type Types } from 'mongoose';

export interface CorrectionProposalFields {
  _id: Types.ObjectId;
  heritageRecordId: Types.ObjectId;
  proposedChanges: Record<string, unknown>;
  rationale?: string;
  proposedById?: Types.ObjectId;
  status: 'proposed' | 'under_review' | 'approved' | 'rejected';
  reviewerId?: Types.ObjectId;
  decisionNote?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CorrectionProposalSchema = new Schema(
  {
    heritageRecordId: {
      type: Schema.Types.ObjectId,
      ref: 'HeritageRecord',
      required: true,
      index: true,
    },
    proposedChanges: { type: Schema.Types.Mixed, required: true },
    rationale: { type: String, trim: true, maxlength: 1000 },
    proposedById: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['proposed', 'under_review', 'approved', 'rejected'],
      default: 'proposed',
      index: true,
    },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
    decisionNote: { type: String, trim: true, maxlength: 1000 },
    reviewedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

export const CorrectionProposalModel = model<CorrectionProposalFields>(
  'CorrectionProposal',
  CorrectionProposalSchema,
);
