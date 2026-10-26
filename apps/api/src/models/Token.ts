import { Schema, model, type Types } from 'mongoose';

export interface TokenFields {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  purpose: 'email_verification' | 'password_reset';
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    purpose: {
      type: String,
      enum: ['email_verification', 'password_reset'],
      required: true,
      index: true,
    },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

TokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TokenModel = model<TokenFields>('Token', TokenSchema);
