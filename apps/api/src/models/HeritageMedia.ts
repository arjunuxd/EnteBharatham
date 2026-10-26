import { Schema, model, type Types } from 'mongoose';

export interface HeritageMediaFields {
  _id: Types.ObjectId;
  heritageRecordId: Types.ObjectId;
  storageKey: string;
  verifiedMediaType: 'image' | 'audio' | 'document';
  mediaType: string; // original declared
  detectedMime: string;
  size: number;
  displayName: string;
  safeDisplayName: string;
  caption?: string;
  description?: string;
  category: 'photograph' | 'scan' | 'audio_recording' | 'document' | 'other';
  uploaderId?: Types.ObjectId;
  lifecycleState: 'pending' | 'uploaded' | 'published' | 'restricted' | 'removed';
  moderationState?: string;
  rightsNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HeritageMediaSchema = new Schema(
  {
    heritageRecordId: {
      type: Schema.Types.ObjectId,
      ref: 'HeritageRecord',
      required: true,
      index: true,
    },
    storageKey: { type: String, required: true, unique: true },
    verifiedMediaType: { type: String, enum: ['image', 'audio', 'document'], required: true },
    mediaType: { type: String, required: true },
    detectedMime: { type: String, required: true },
    size: { type: Number, required: true },
    displayName: { type: String, trim: true, maxlength: 255 },
    safeDisplayName: { type: String, trim: true, maxlength: 255 },
    caption: { type: String, trim: true, maxlength: 500 },
    description: { type: String, trim: true, maxlength: 1000 },
    category: {
      type: String,
      enum: ['photograph', 'scan', 'audio_recording', 'document', 'other'],
      default: 'other',
    },
    uploaderId: { type: Schema.Types.ObjectId, ref: 'User' },
    lifecycleState: {
      type: String,
      enum: ['pending', 'uploaded', 'published', 'restricted', 'removed'],
      default: 'pending',
      index: true,
    },
    moderationState: { type: String },
    rightsNote: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true, versionKey: false },
);

HeritageMediaSchema.index({ heritageRecordId: 1, lifecycleState: 1 });

export const HeritageMediaModel = model<HeritageMediaFields>('HeritageMedia', HeritageMediaSchema);
