import { Schema, model, type Types } from 'mongoose';

export interface CommunityReportFields {
  _id: Types.ObjectId;
  heritageRecordId: Types.ObjectId;
  category: string;
  explanation?: string;
  reporterId?: Types.ObjectId;
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  assignedModeratorId?: Types.ObjectId;
  resolutionCategory?: string;
  decisionNote?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CommunityReportSchema = new Schema(
  {
    heritageRecordId: {
      type: Schema.Types.ObjectId,
      ref: 'HeritageRecord',
      required: true,
      index: true,
    },
    category: { type: String, required: true },
    explanation: { type: String, trim: true, maxlength: 1000 },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'dismissed'],
      default: 'open',
      index: true,
    },
    assignedModeratorId: { type: Schema.Types.ObjectId, ref: 'User' },
    resolutionCategory: { type: String },
    decisionNote: { type: String, trim: true, maxlength: 1000 },
    reviewedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

export const CommunityReportModel = model<CommunityReportFields>(
  'CommunityReport',
  CommunityReportSchema,
);
