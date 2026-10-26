import type {
  AuditAction,
  AuditEventPublic,
  PaginatedResponse,
  UserRole,
} from '@entebharatham/shared';
import { AuditEventModel, type AuditEventFields } from '../models/AuditEvent.js';
import { invalidatePublicSitemapCache } from '../sitemap/generator.js';
import { invalidatePublicHeritageCache } from './heritage.service.js';

/**
 * Append-only audit trail service.
 *
 * - Records actor, action, record id, timestamp, and short safe metadata.
 * - Audit failures are logged with a fixed string and never leak metadata,
 *   and they never fail the triggering action (the action itself already
 *   succeeded transactionally).
 * - There is no update or delete path; listing is restricted to moderator
 *   and admin routes.
 */

export interface AuditEntry {
  action: AuditAction;
  actorId?: string;
  actorRole?: UserRole;
  recordId?: string;
  metadata?: Record<string, string>;
}

export async function recordAuditEvent(entry: AuditEntry): Promise<void> {
  // Publication, review, governance, and withdrawal actions all write an
  // audit event. Clearing the public read cache here makes visibility changes
  // effective immediately rather than at the next TTL expiry.
  invalidatePublicHeritageCache();
  invalidatePublicSitemapCache();
  try {
    await AuditEventModel.create({
      action: entry.action,
      ...(entry.actorId !== undefined ? { actorId: entry.actorId } : {}),
      ...(entry.actorRole !== undefined ? { actorRole: entry.actorRole } : {}),
      ...(entry.recordId !== undefined ? { recordId: entry.recordId } : {}),
      ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
    });
  } catch (error) {
    // Fixed string only — audit metadata must never reach logs.
    void error;
    console.error('[audit] failed to record audit event');
  }
}

function toAuditDto(doc: AuditEventFields): AuditEventPublic {
  const dto: AuditEventPublic = {
    id: String(doc._id),
    action: doc.action,
    createdAt: doc.createdAt.toISOString(),
  };
  if (doc.actorId !== undefined) dto.actorId = String(doc.actorId);
  if (doc.actorRole !== undefined) dto.actorRole = doc.actorRole;
  if (doc.recordId !== undefined) dto.recordId = String(doc.recordId);
  if (doc.metadata !== undefined) dto.metadata = { ...doc.metadata };
  return dto;
}

export async function listAuditEvents(query: {
  page: number;
  limit: number;
}): Promise<PaginatedResponse<AuditEventPublic>> {
  const skip = (query.page - 1) * query.limit;

  const [docs, total] = await Promise.all([
    AuditEventModel.find()
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean()
      .exec(),
    AuditEventModel.countDocuments().exec(),
  ]);

  return {
    items: docs.map((doc) => toAuditDto(doc as AuditEventFields)),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  };
}
