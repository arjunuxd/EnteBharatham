/**
 * Review-feedback contracts (Phase 6).
 *
 * Review feedback replaces the single free-text "reason" with a structured,
 * actionable exchange:
 *
 * - A **moderator** raises feedback (clarification, correction, provenance,
 *   rights, sensitive content) either as contributor-visible guidance or as an
 *   internal note. Internal notes are never returned to contributors.
 * - A **contributor** responds to feedback on their own record.
 * - Feedback items can be **resolved**, which records who resolved them.
 *
 * The existing record lifecycle (`draft`, `pending_review`,
 * `changes_requested`, `published`, …) is unchanged — feedback augments it and
 * never replaces it.
 */

import type { RecordStatus } from './heritage.js';
import type { UserRole } from './auth.js';

export const FEEDBACK_KINDS = [
  'clarification',
  'correction',
  'provenance',
  'rights',
  'sensitive_content',
  'general',
] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_VISIBILITIES = ['contributor', 'internal'] as const;
export type FeedbackVisibility = (typeof FEEDBACK_VISIBILITIES)[number];

export interface FeedbackMessagePublic {
  id: string;
  recordId: string;
  /** Set when the message replies to an earlier message. */
  parentId?: string;
  kind: FeedbackKind;
  message: string;
  /** Record path the feedback refers to, when field-specific. */
  field?: string;
  visibility: FeedbackVisibility;
  authorId?: string;
  authorRole: UserRole;
  resolvedAt?: string;
  resolvedById?: string;
  createdAt: string;
}

export interface FeedbackThreadPublic {
  recordId: string;
  status: RecordStatus;
  /** Messages the caller is allowed to see, oldest first. */
  messages: FeedbackMessagePublic[];
  /** Number of unresolved contributor-visible messages. */
  openContributorMessages: number;
  /** Number of unresolved internal notes (moderators only). */
  openInternalMessages: number;
}

/** Minimum length of a feedback message (moderator or contributor). */
export const FEEDBACK_MIN_LENGTH = 10;

/** Maximum length of a feedback message. */
export const FEEDBACK_MAX_LENGTH = 2000;
