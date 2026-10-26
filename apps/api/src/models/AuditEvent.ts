import type { AuditAction, UserRole } from '@entebharatham/shared';
import { AUDIT_ACTIONS, USER_ROLES } from '@entebharatham/shared';
import { Schema, model, type Types } from 'mongoose';

/**
 * Lightweight, append-only audit trail for consequential workflow actions
 * (submission, review decisions, role changes).
 *
 * - Only fields needed for accountability are stored: actor, action, record,
 *   timestamp, and short safe metadata.
 * - Never stores passwords, session identifiers, secrets, review reasons, or
 *   copies of cultural content.
 * - There is no update or delete endpoint; ordinary contributors have no
 *   access path to these records (see docs/SECURITY.md for retention notes).
 */
export interface AuditEventFields {
  _id: Types.ObjectId;
  action: AuditAction;
  actorId?: Types.ObjectId;
  actorRole?: UserRole;
  recordId?: Types.ObjectId;
  metadata?: Record<string, string>;
  createdAt: Date;
}

const AuditEventSchema = new Schema(
  {
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String, enum: USER_ROLES },
    recordId: { type: Schema.Types.ObjectId, ref: 'HeritageRecord' },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

// Chronological listing with a stable tie-breaker, newest first.
AuditEventSchema.index({ createdAt: -1, _id: -1 });

export const AuditEventModel = model<AuditEventFields>('AuditEvent', AuditEventSchema);
