import { Schema, model, type Types } from 'mongoose';

export interface TranslationFields {
  _id: Types.ObjectId;
  parentRecordId: Types.ObjectId;
  heritageRecordId?: Types.ObjectId; // link to the translation HeritageRecord
  languageCode: string;
  languageDisplay: string;
  title: string;
  summary?: string;
  content: string;
  translatorId?: Types.ObjectId;
  translatorAttribution?: string;
  translationSource?: string;
  rightsStatus?: string;
  consentStatus?: string;
  provenance?: string;
  status: 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived';
  review?: {
    decision: 'approved' | 'rejected' | 'changes_requested';
    reason?: string;
    reviewedAt: Date;
    reviewerId?: Types.ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TranslationSchema = new Schema(
  {
    parentRecordId: {
      type: Schema.Types.ObjectId,
      ref: 'HeritageRecord',
      required: true,
      index: true,
    },
    heritageRecordId: { type: Schema.Types.ObjectId, ref: 'HeritageRecord' },
    languageCode: { type: String, required: true, trim: true, maxlength: 10 },
    languageDisplay: { type: String, required: true, trim: true, maxlength: 100 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    summary: { type: String, trim: true, maxlength: 500 },
    content: { type: String, required: true, trim: true, maxlength: 50000 },
    translatorId: { type: Schema.Types.ObjectId, ref: 'User' },
    translatorAttribution: { type: String, trim: true, maxlength: 200 },
    translationSource: { type: String, trim: true, maxlength: 500 },
    rightsStatus: { type: String, trim: true, maxlength: 50 },
    consentStatus: { type: String, trim: true, maxlength: 50 },
    provenance: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'published', 'rejected', 'archived'],
      default: 'draft',
      index: true,
    },
    review: {
      decision: { type: String, enum: ['approved', 'rejected', 'changes_requested'] },
      reason: { type: String, trim: true, maxlength: 2000 },
      reviewedAt: { type: Date },
      reviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
    },
  },
  { timestamps: true, versionKey: false },
);

TranslationSchema.index({ parentRecordId: 1, languageCode: 1 }, { unique: true });
// Translation matches are joined into public search; keep the published-status
// prefix so the text index can serve that equality filter directly.
TranslationSchema.index({ status: 1, title: 'text', summary: 'text', content: 'text' });
// Supports the public parent lookup and the reverse list endpoint.
TranslationSchema.index({ parentRecordId: 1, status: 1, updatedAt: -1 });

export const TranslationModel = model<TranslationFields>('Translation', TranslationSchema);
