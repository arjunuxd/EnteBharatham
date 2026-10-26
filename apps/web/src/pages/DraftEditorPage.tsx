import type {
  ContributorRecordDetail,
  ConsentVerification,
  DuplicateSuggestionResponse,
  FeedbackKind,
  FeedbackThreadPublic,
  HeritageType,
  QualityReport,
  RecordVisibility,
  RightsStatus,
  SourceType,
} from '@entebharatham/shared';
import {
  CONSENT_VERIFICATIONS,
  HERITAGE_TYPES,
  RECORD_VISIBILITY,
  RIGHTS_STATUSES,
  SOURCE_TYPES,
} from '@entebharatham/shared';
import { ArrowLeft, CheckCircle2, FileText, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DuplicateCandidatesPanel } from '../components/DuplicateCandidatesPanel';
import { FeedbackThread } from '../components/FeedbackThread';
import { ProvenanceEditor } from '../components/ProvenanceEditor';
import { QualityFindingsPanel } from '../components/QualityFindingsPanel';
import {
  canDeleteRecord,
  canRequestWithdrawal,
  RecordRemovalActions,
} from '../components/RecordRemovalActions';
import { UploadMedia } from '../components/UploadMedia';
import { ErrorState, InlineNotice, LoadingState } from '../components/ui/States';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import { heritageTypeLabel } from '../lib/heritage';
import {
  addOwnFeedback,
  declareVariant,
  fetchOwnDuplicates,
  fetchOwnFeedback,
  fetchOwnQuality,
  updateOwnProvenance,
} from '../lib/phase6';
import { createDraft, fetchOwnRecord, submitDraft, updateDraft } from '../lib/workflow';
import { StatusBadge } from './DashboardPage';

type LoadStatus = 'loading' | 'ready' | 'new' | 'notFound' | 'error';

/**
 * Editable source entry.
 *
 * `isVerified` is deliberately absent: verification is set by a reviewer, not
 * by the contributor, and the write schema rejects it as an unknown key.
 */
interface DraftSource {
  sourceType: SourceType;
  description: string;
  reference?: string;
  collectedOn?: string;
  context?: string;
  notes?: string;
  originalLanguage?: string;
  communityContext?: string;
  collector?: string;
  recorder?: string;
  translator?: string;
  transcriber?: string;
  mediaReferences?: string[];
  isPublic?: boolean;
}

/** Editable draft form state (mirrors the API's strict write schema). */
interface DraftForm {
  title: string;
  summary: string;
  content: string;
  heritageType: HeritageType;
  languages: string;
  visibility: RecordVisibility;
  communityName: string;
  tags: string;
  regionCountry: string;
  regionState: string;
  permissionToPublish: boolean;
  allowAttribution: boolean;
  allowRedistribution: boolean;
  verification: ConsentVerification;
  rightsStatus: RightsStatus;
  sources: DraftSource[];
}

const EMPTY_FORM: DraftForm = {
  title: '',
  summary: '',
  content: '',
  heritageType: 'folk_story',
  languages: '',
  visibility: 'private',
  communityName: '',
  tags: '',
  regionCountry: 'India',
  regionState: '',
  permissionToPublish: false,
  allowAttribution: true,
  allowRedistribution: false,
  verification: 'unverified',
  rightsStatus: 'unknown',
  sources: [],
};

/** Fills the form from a loaded record detail. */
function formFromRecord(record: ContributorRecordDetail): DraftForm {
  return {
    title: record.title,
    summary: record.summary ?? '',
    content: record.content ?? '',
    heritageType: record.heritageType,
    languages: record.languages.join(', '),
    visibility: record.visibility,
    communityName: record.communityName ?? '',
    tags: record.tags.join(', '),
    regionCountry: record.region.country,
    regionState: record.region.state ?? '',
    permissionToPublish: record.consent.permissionToPublish,
    allowAttribution: record.consent.allowAttribution,
    allowRedistribution: record.consent.allowRedistribution,
    verification: record.consent.verification,
    rightsStatus: record.license.rightsStatus,
    sources: record.sources.map((source) => ({
      sourceType: source.sourceType,
      description: source.description,
      ...(source.reference !== undefined ? { reference: source.reference } : {}),
      ...(source.collectedOn !== undefined ? { collectedOn: source.collectedOn } : {}),
      ...(source.context !== undefined ? { context: source.context } : {}),
      ...(source.notes !== undefined ? { notes: source.notes } : {}),
      ...(source.originalLanguage !== undefined
        ? { originalLanguage: source.originalLanguage }
        : {}),
      ...(source.communityContext !== undefined
        ? { communityContext: source.communityContext }
        : {}),
      ...(source.collector !== undefined ? { collector: source.collector } : {}),
      ...(source.recorder !== undefined ? { recorder: source.recorder } : {}),
      ...(source.translator !== undefined ? { translator: source.translator } : {}),
      ...(source.transcriber !== undefined ? { transcriber: source.transcriber } : {}),
      ...(source.mediaReferences !== undefined ? { mediaReferences: source.mediaReferences } : {}),
      isPublic: source.isPublic,
    })),
  };
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}

/**
 * Draft create/edit page. `:id === 'new'` renders the create form; any
 * other id loads the contributor's own record. Read-only after submission
 * (pending review / published / rejected / archived), except that
 * `changes_requested` records stay editable for resubmission.
 */
export function DraftEditorPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const isNew = id === 'new';
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(isNew ? 'new' : 'loading');
  const [record, setRecord] = useState<ContributorRecordDetail | null>(null);
  const [form, setForm] = useState<DraftForm>(EMPTY_FORM);
  const [retryToken, setRetryToken] = useState(0);

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateSuggestionResponse | null>(null);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [declaringVariant, setDeclaringVariant] = useState(false);
  const [thread, setThread] = useState<FeedbackThreadPublic | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [provenanceSaving, setProvenanceSaving] = useState(false);
  const [provenanceError, setProvenanceError] = useState<string | null>(null);

  const editableStatuses = ['draft', 'changes_requested'];
  const editable = isNew || (record !== null && editableStatuses.includes(record.status));

  useEffect(() => {
    if (isNew) {
      setLoadStatus('new');
      return;
    }
    const controller = new AbortController();
    setLoadStatus('loading');

    fetchOwnRecord(id, controller.signal)
      .then((detail) => {
        setRecord(detail);
        setForm(formFromRecord(detail));
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof ApiError && error.status === 404) {
          setLoadStatus('notFound');
          return;
        }
        setLoadStatus('error');
      });

    return () => controller.abort();
  }, [id, isNew, retryToken]);

  const recordId = record?.id;

  // Phase 6 panels load independently so one failing call never hides the
  // draft itself.
  useEffect(() => {
    if (recordId === undefined) return;
    const controller = new AbortController();

    setQualityLoading(true);
    fetchOwnQuality(recordId, controller.signal)
      .then(setQuality)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setQuality(null);
      })
      .finally(() => setQualityLoading(false));

    setDuplicatesLoading(true);
    fetchOwnDuplicates(recordId, controller.signal)
      .then(setDuplicates)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setDuplicates(null);
      })
      .finally(() => setDuplicatesLoading(false));

    setThreadLoading(true);
    fetchOwnFeedback(recordId, controller.signal)
      .then(setThread)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setThread(null);
      })
      .finally(() => setThreadLoading(false));

    return () => controller.abort();
  }, [recordId, retryToken]);

  const set = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const buildPayload = (current: DraftForm): Record<string, unknown> => ({
    title: current.title.trim(),
    summary: current.summary.trim(),
    content: current.content.trim(),
    heritageType: current.heritageType,
    languages: splitList(current.languages),
    visibility: current.visibility,
    communityName: current.communityName.trim(),
    tags: splitList(current.tags),
    region: {
      country: current.regionCountry.trim(),
      ...(current.regionState.trim() !== '' ? { state: current.regionState.trim() } : {}),
    },
    consent: {
      permissionToPublish: current.permissionToPublish,
      allowAttribution: current.allowAttribution,
      allowRedistribution: current.allowRedistribution,
      verification: current.verification,
    },
    license: { rightsStatus: current.rightsStatus },
    sources: current.sources,
  });

  const fieldError = (caught: unknown, fallback: string): string => {
    if (caught instanceof ApiError && caught.status === 400 && caught.details !== undefined) {
      const details = caught.details as Array<{ path?: string; message?: string }>;
      if (Array.isArray(details) && details.length > 0) {
        return details.map((issue) => issue.message ?? issue.path ?? 'Invalid input').join(' · ');
      }
    }
    if (caught instanceof ApiError && caught.status === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    return fallback;
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaveError(null);
    setSaveNotice(null);

    if (splitList(form.languages).length === 0) {
      setSaveError('At least one language is required.');
      return;
    }
    if (form.title.trim().length < 3) {
      setSaveError('Title must be at least 3 characters.');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (isNew) {
        const created = await createDraft(payload);
        navigate(`/dashboard/drafts/${created.id}`, { replace: true });
      } else {
        const updated = await updateDraft(id, payload);
        setRecord(updated);
        setSaveNotice('Draft saved.');
      }
    } catch (caught) {
      setSaveError(fieldError(caught, 'We could not save the draft. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (submitting || record === null) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const updated = await submitDraft(record.id);
      setRecord(updated);
      setForm(formFromRecord(updated));
      setSaveNotice('Submitted for review.');
    } catch (caught) {
      let message = 'We could not submit this record. Please try again.';
      if (caught instanceof ApiError && caught.status === 422 && caught.details !== undefined) {
        const details = caught.details as { missing?: string[] };
        if (Array.isArray(details.missing) && details.missing.length > 0) {
          message = `Cannot submit yet — missing: ${details.missing.join(', ')}.`;
        }
      } else if (caught instanceof ApiError && caught.status === 409) {
        message = 'This record is no longer awaiting the state this action requires.';
      } else {
        message = fieldError(caught, message);
      }
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveProvenance = async (body: {
    originalLanguage?: string;
    communityContext?: string;
    attributionPreference: 'named' | 'pseudonymous' | 'anonymous';
    permitAnonymity: boolean;
  }) => {
    if (record === null || provenanceSaving) return;
    setProvenanceError(null);
    setProvenanceSaving(true);
    try {
      const updated = await updateOwnProvenance(record.id, body);
      setRecord(updated);
      setSaveNotice('Provenance updated.');
    } catch (caught) {
      setProvenanceError(fieldError(caught, 'We could not update provenance. Please try again.'));
    } finally {
      setProvenanceSaving(false);
    }
  };

  const handleDeclareVariant = async (relatedRecordId: string, note: string) => {
    if (record === null || declaringVariant) return;
    setDuplicateError(null);
    setDeclaringVariant(true);
    try {
      const updated = await declareVariant(record.id, { relatedRecordId, note });
      setRecord(updated);
      setSaveNotice('Variant declaration recorded.');
    } catch (caught) {
      setDuplicateError(fieldError(caught, 'We could not record the variant. Please try again.'));
    } finally {
      setDeclaringVariant(false);
    }
  };

  const handlePostFeedback = async (body: {
    kind: FeedbackKind;
    message: string;
    parentId?: string;
  }) => {
    if (record === null || feedbackSubmitting) return;
    setFeedbackError(null);
    setFeedbackSubmitting(true);
    try {
      const updated = await addOwnFeedback(record.id, body);
      setThread(updated);
    } catch (caught) {
      setFeedbackError(fieldError(caught, 'We could not post your reply. Please try again.'));
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const addSource = () => {
    setForm((current) => ({
      ...current,
      sources: [
        ...current.sources,
        { sourceType: 'oral_account', description: '', isPublic: true },
      ],
    }));
  };

  const updateSource = (index: number, patch: Partial<DraftSource>) => {
    setForm((current) => ({
      ...current,
      sources: current.sources.map((source, i) => (i === index ? { ...source, ...patch } : source)),
    }));
  };

  const removeSource = (index: number) => {
    setForm((current) => ({
      ...current,
      sources: current.sources.filter((_, i) => i !== index),
    }));
  };

  if (loadStatus === 'loading') {
    return (
      <div className="container-page py-14">
        <LoadingState>Loading draft…</LoadingState>
      </div>
    );
  }

  if (loadStatus === 'notFound') {
    return (
      <div className="container-reading py-16">
        <div className="rounded-xl border border-line/90 bg-paper px-6 py-10 shadow-card sm:px-10">
          <p className="eyebrow">Contributor workspace</p>
          <h1 className="display-title mt-4">Record not found</h1>
          <p className="body-copy mt-4">
            This record does not exist, or it is not one of your records.
          </p>
          <Link to="/dashboard" className="btn-primary mt-8">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to your contributions
          </Link>
        </div>
      </div>
    );
  }

  if (loadStatus === 'error') {
    return (
      <div className="container-reading py-16">
        <ErrorState
          title="We could not load this draft."
          description="We could not load this draft just now. Your work has not been changed."
          onRetry={() => setRetryToken((token) => token + 1)}
        />
      </div>
    );
  }

  const readOnly = !editable;
  const review = record?.review;
  const removable =
    record !== null && (canDeleteRecord(record.status) || canRequestWithdrawal(record.status));

  return (
    <div className="pb-20">
      <section className="border-b border-line bg-cream">
        <div className="container-page pb-9 pt-10 sm:pb-11 sm:pt-14">
          <Link to="/dashboard" className="link-quiet inline-flex items-center gap-2 text-sm">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Your contributions
          </Link>

          <header className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <p className="eyebrow">
                {isNew ? 'New record' : readOnly ? 'Record in review' : 'Draft workspace'}
              </p>
              <h1 className="display-title mt-4 break-words">
                {isNew ? 'New draft' : form.title || 'Edit draft'}
              </h1>
              <p className="body-copy mt-3 max-w-2xl">
                {isNew
                  ? 'Begin with the story as it was shared with you. You can save a draft at any point and return when you are ready.'
                  : readOnly
                    ? 'You can read this record and its review history, but it cannot be edited in its current state.'
                    : 'Keep the record faithful to the telling. Save as a draft whenever you need to pause.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {record !== null && <StatusBadge status={record.status} />}
              {user !== null && (
                <span className="text-xs text-earth-ink">Signed in as {user.displayName}</span>
              )}
            </div>
          </header>
        </div>
      </section>

      <div className="container-page">
        {review !== undefined && (
          <div
            className={`mt-6 rounded-xl border px-5 py-4 shadow-card ${
              review.decision === 'changes_requested'
                ? 'border-terracotta/30 bg-terracotta-soft'
                : review.decision === 'rejected'
                  ? 'border-danger/25 bg-danger-soft'
                  : 'border-success/25 bg-success-soft'
            }`}
          >
            <p className="font-display text-lg text-ink">
              Review decision:{' '}
              {review.decision === 'changes_requested'
                ? 'Changes requested'
                : humanize(review.decision)}
            </p>
            {review.reason !== undefined && (
              <p className="mt-1 text-sm leading-6 text-earth-ink">{review.reason}</p>
            )}
            <p className="mt-2 text-xs text-earth-ink">
              Reviewed {new Date(review.reviewedAt).toLocaleString()}
            </p>
          </div>
        )}

        {readOnly && (
          <p className="mt-6 flex items-start gap-2 rounded-xl border border-line-strong bg-cream/80 px-4 py-3 text-sm leading-6 text-earth-ink shadow-card">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden="true" />
            This record is not editable in its current state. Only drafts and records with requested
            changes can be edited.
          </p>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          <div className="min-w-0">
            <form className="space-y-8" onSubmit={handleSave}>
              {saveError !== null && (
                <InlineNotice tone="error" live="alert">
                  {saveError}
                </InlineNotice>
              )}
              {saveNotice !== null && (
                <InlineNotice tone="success" live="status">
                  {saveNotice}
                </InlineNotice>
              )}

              {/* ------------------------------------------------- The story */}
              <fieldset
                className="overflow-hidden rounded-xl border border-line/90 bg-paper shadow-card"
                disabled={readOnly}
              >
                <legend className="sr-only">Story details</legend>
                <div className="border-b border-line px-5 py-4 sm:px-6">
                  <p className="eyebrow-forest">Section 01</p>
                  <h2 className="mt-2 font-display text-2xl leading-snug text-ink">The story</h2>
                  <p className="mt-1 text-sm leading-6 text-earth-ink">
                    Write the record in the language it was shared. Translations belong in their own
                    record so the original is never overwritten.
                  </p>
                </div>

                <div className="space-y-5 px-5 py-5 sm:px-6">
                  <div>
                    <label htmlFor="draft-title" className="field-label">
                      Title
                      <span className="ml-1 font-normal text-terracotta-deep" aria-hidden="true">
                        *
                      </span>
                    </label>
                    <input
                      id="draft-title"
                      type="text"
                      required
                      minLength={3}
                      maxLength={200}
                      value={form.title}
                      onChange={(event) => set('title', event.target.value)}
                      className="input"
                    />
                  </div>

                  <div>
                    <label htmlFor="draft-summary" className="field-label">
                      Summary
                    </label>
                    <textarea
                      id="draft-summary"
                      rows={2}
                      maxLength={500}
                      value={form.summary}
                      onChange={(event) => set('summary', event.target.value)}
                      className="input resize-y"
                    />
                    <p className="field-hint">
                      One or two sentences a reader can use to decide whether to open the record.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="draft-content" className="field-label">
                      Content
                    </label>
                    <textarea
                      id="draft-content"
                      rows={12}
                      maxLength={50_000}
                      value={form.content}
                      onChange={(event) => set('content', event.target.value)}
                      className="input resize-y leading-7"
                    />
                    <p className="field-hint">
                      At least 10 characters are required before submitting for review.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="draft-type" className="field-label">
                        Category
                      </label>
                      <select
                        id="draft-type"
                        value={form.heritageType}
                        onChange={(event) =>
                          set('heritageType', event.target.value as HeritageType)
                        }
                        className="select"
                      >
                        {HERITAGE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {heritageTypeLabel(type)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="draft-visibility" className="field-label">
                        Visibility
                      </label>
                      <select
                        id="draft-visibility"
                        value={form.visibility}
                        onChange={(event) =>
                          set('visibility', event.target.value as RecordVisibility)
                        }
                        className="select"
                      >
                        {RECORD_VISIBILITY.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                      <p className="field-hint">
                        Records are approved only when visibility is &quot;public&quot;.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="draft-languages" className="field-label">
                      Languages
                    </label>
                    <input
                      id="draft-languages"
                      type="text"
                      required
                      placeholder="Malayalam, Tamil"
                      value={form.languages}
                      onChange={(event) => set('languages', event.target.value)}
                      className="input"
                    />
                    <p className="field-hint">Comma-separated. At least one is required.</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="draft-community" className="field-label">
                        Community name
                      </label>
                      <input
                        id="draft-community"
                        type="text"
                        maxLength={200}
                        value={form.communityName}
                        onChange={(event) => set('communityName', event.target.value)}
                        className="input"
                      />
                    </div>
                    <div>
                      <label htmlFor="draft-tags" className="field-label">
                        Tags
                      </label>
                      <input
                        id="draft-tags"
                        type="text"
                        placeholder="harvest, monsoon"
                        value={form.tags}
                        onChange={(event) => set('tags', event.target.value)}
                        className="input"
                      />
                      <p className="field-hint">Comma-separated, up to five.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="draft-country" className="field-label">
                        Country
                      </label>
                      <input
                        id="draft-country"
                        type="text"
                        required
                        maxLength={100}
                        value={form.regionCountry}
                        onChange={(event) => set('regionCountry', event.target.value)}
                        className="input"
                      />
                    </div>
                    <div>
                      <label htmlFor="draft-state" className="field-label">
                        State
                      </label>
                      <input
                        id="draft-state"
                        type="text"
                        maxLength={100}
                        value={form.regionState}
                        onChange={(event) => set('regionState', event.target.value)}
                        className="input"
                      />
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* --------------------------------------------- Consent/rights */}
              <fieldset
                className="overflow-hidden rounded-xl border border-line/90 bg-paper shadow-card"
                disabled={readOnly}
              >
                <legend className="sr-only">Consent and rights</legend>
                <div className="border-b border-line px-5 py-4 sm:px-6">
                  <p className="eyebrow-forest">Section 02</p>
                  <h2 className="mt-2 font-display text-2xl leading-snug text-ink">
                    Consent &amp; rights
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-earth-ink">
                    Publication depends on clear permission. Record what was agreed, not what you
                    assume.
                  </p>
                </div>

                <div className="space-y-5 px-5 py-5 sm:px-6">
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 rounded-lg border border-line bg-cream/60 p-3.5 text-sm leading-6 text-ink transition-colors hover:border-forest/30">
                      <input
                        type="checkbox"
                        checked={form.permissionToPublish}
                        onChange={(event) => set('permissionToPublish', event.target.checked)}
                        className="mt-1 h-4 w-4 accent-forest"
                      />
                      <span>
                        I have permission to publish this material.{' '}
                        <span className="text-earth-ink">(Required to submit.)</span>
                      </span>
                    </label>

                    <label className="flex items-start gap-3 rounded-lg border border-line p-3.5 text-sm leading-6 text-ink transition-colors hover:border-forest/30">
                      <input
                        type="checkbox"
                        checked={form.allowAttribution}
                        onChange={(event) => set('allowAttribution', event.target.checked)}
                        className="mt-1 h-4 w-4 accent-forest"
                      />
                      <span>Allow attribution to the named contributors</span>
                    </label>

                    <label className="flex items-start gap-3 rounded-lg border border-line p-3.5 text-sm leading-6 text-ink transition-colors hover:border-forest/30">
                      <input
                        type="checkbox"
                        checked={form.allowRedistribution}
                        onChange={(event) => set('allowRedistribution', event.target.checked)}
                        className="mt-1 h-4 w-4 accent-forest"
                      />
                      <span>Allow redistribution under the record&apos;s license</span>
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="draft-verification" className="field-label">
                        Consent verification
                      </label>
                      <select
                        id="draft-verification"
                        value={form.verification}
                        onChange={(event) =>
                          set('verification', event.target.value as ConsentVerification)
                        }
                        className="select"
                      >
                        {CONSENT_VERIFICATIONS.map((value) => (
                          <option key={value} value={value}>
                            {humanize(value)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="draft-rights" className="field-label">
                        Rights status
                      </label>
                      <select
                        id="draft-rights"
                        value={form.rightsStatus}
                        onChange={(event) =>
                          set('rightsStatus', event.target.value as RightsStatus)
                        }
                        className="select"
                      >
                        {RIGHTS_STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                      <p className="field-hint">
                        Approval requires &quot;confirmed&quot; rights status.
                      </p>
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* ---------------------------------------------------- Sources */}
              <fieldset
                className="overflow-hidden rounded-xl border border-line/90 bg-paper shadow-card"
                disabled={readOnly}
              >
                <legend className="sr-only">Sources</legend>
                <div className="border-b border-line px-5 py-4 sm:px-6">
                  <p className="eyebrow-forest">Section 03</p>
                  <h2 className="mt-2 font-display text-2xl leading-snug text-ink">Sources</h2>
                  <p className="mt-1 text-sm leading-6 text-earth-ink">
                    Name where the telling came from and who was present. Private sources are
                    visible to you and to moderators only.
                  </p>
                </div>

                <div className="space-y-4 px-5 py-5 sm:px-6">
                  {form.sources.length === 0 && (
                    <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-earth-ink">
                      No sources recorded yet.
                    </p>
                  )}

                  {form.sources.map((source, index) => (
                    <div key={index} className="rounded-lg border border-line bg-cream/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-display text-base text-ink">Source {index + 1}</p>
                        {editable && (
                          <button
                            type="button"
                            onClick={() => removeSource(index)}
                            className="btn-ghost btn-sm text-danger hover:bg-danger-soft"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Remove source
                          </button>
                        )}
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`source-type-${index}`} className="field-label">
                            Source type
                          </label>
                          <select
                            id={`source-type-${index}`}
                            value={source.sourceType}
                            onChange={(event) =>
                              updateSource(index, {
                                sourceType: event.target.value as SourceType,
                              })
                            }
                            className="select"
                          >
                            {SOURCE_TYPES.map((value) => (
                              <option key={value} value={value}>
                                {humanize(value)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`source-date-${index}`} className="field-label">
                            Collected on
                          </label>
                          <input
                            id={`source-date-${index}`}
                            type="date"
                            value={source.collectedOn ?? ''}
                            onChange={(event) =>
                              updateSource(index, { collectedOn: event.target.value || undefined })
                            }
                            className="input"
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <label htmlFor={`source-desc-${index}`} className="field-label">
                          Description
                        </label>
                        <textarea
                          id={`source-desc-${index}`}
                          rows={2}
                          maxLength={1000}
                          required
                          value={source.description}
                          onChange={(event) =>
                            updateSource(index, { description: event.target.value })
                          }
                          className="input resize-y"
                        />
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`source-collector-${index}`} className="field-label">
                            Collector
                          </label>
                          <input
                            id={`source-collector-${index}`}
                            type="text"
                            maxLength={120}
                            value={source.collector ?? ''}
                            onChange={(event) =>
                              updateSource(index, { collector: event.target.value || undefined })
                            }
                            className="input"
                          />
                        </div>
                        <div>
                          <label htmlFor={`source-recorder-${index}`} className="field-label">
                            Recorder
                          </label>
                          <input
                            id={`source-recorder-${index}`}
                            type="text"
                            maxLength={120}
                            value={source.recorder ?? ''}
                            onChange={(event) =>
                              updateSource(index, { recorder: event.target.value || undefined })
                            }
                            className="input"
                          />
                        </div>
                        <div>
                          <label htmlFor={`source-translator-${index}`} className="field-label">
                            Translator
                          </label>
                          <input
                            id={`source-translator-${index}`}
                            type="text"
                            maxLength={120}
                            value={source.translator ?? ''}
                            onChange={(event) =>
                              updateSource(index, { translator: event.target.value || undefined })
                            }
                            className="input"
                          />
                        </div>
                        <div>
                          <label htmlFor={`source-language-${index}`} className="field-label">
                            Original language
                          </label>
                          <input
                            id={`source-language-${index}`}
                            type="text"
                            maxLength={64}
                            value={source.originalLanguage ?? ''}
                            onChange={(event) =>
                              updateSource(index, {
                                originalLanguage: event.target.value || undefined,
                              })
                            }
                            className="input"
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <label htmlFor={`source-context-${index}`} className="field-label">
                          Community or regional context
                        </label>
                        <input
                          id={`source-context-${index}`}
                          type="text"
                          maxLength={200}
                          value={source.communityContext ?? ''}
                          onChange={(event) =>
                            updateSource(index, {
                              communityContext: event.target.value || undefined,
                            })
                          }
                          className="input"
                        />
                      </div>

                      <label className="mt-3 flex items-start gap-3 text-sm leading-6 text-ink">
                        <input
                          type="checkbox"
                          checked={source.isPublic ?? true}
                          onChange={(event) =>
                            updateSource(index, { isPublic: event.target.checked })
                          }
                          className="mt-1 h-4 w-4 accent-forest"
                        />
                        <span>
                          Show this source on the public record.
                          <span className="block text-xs text-earth-ink">
                            Private sources stay visible to you and to moderators only.
                          </span>
                        </span>
                      </label>
                    </div>
                  ))}

                  {editable && (
                    <button type="button" onClick={addSource} className="btn-secondary btn-sm">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add source
                    </button>
                  )}
                </div>
              </fieldset>

              {editable && (
                <div className="sticky bottom-0 z-10 rounded-t-xl border border-line/80 bg-ivory/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-panel backdrop-blur-xl">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <button
                      type="submit"
                      disabled={saving || submitting}
                      className="btn-primary w-full sm:w-auto"
                    >
                      {saving ? 'Saving…' : isNew ? 'Create draft' : 'Save draft'}
                    </button>
                    {!isNew && record !== null && (
                      <button
                        type="button"
                        onClick={() => void handleSubmitForReview()}
                        disabled={saving || submitting}
                        className="btn-secondary w-full sm:w-auto"
                      >
                        {submitting ? 'Submitting…' : 'Submit for review'}
                      </button>
                    )}
                    <p className="text-xs leading-5 text-earth-ink sm:ml-auto sm:max-w-xs sm:text-right">
                      Drafts stay private until a moderator approves them.
                    </p>
                  </div>
                </div>
              )}
            </form>

            {submitError !== null && (
              <div className="mt-4">
                <InlineNotice tone="error" live="alert">
                  {submitError}
                </InlineNotice>
              </div>
            )}
          </div>

          {/* -------------------------------------------------------- Aside */}
          <aside className="space-y-5">
            <section className="rounded-xl border border-line/90 bg-cream/90 p-5 shadow-card">
              <CheckCircle2 className="h-5 w-5 text-forest" aria-hidden="true" />
              <h2 className="mt-3 font-display text-lg leading-snug text-ink">Ready to submit?</h2>
              <p className="mt-2 text-sm leading-6 text-earth-ink">
                The record needs a title, at least one language, the story itself, permission to
                publish, a source, public visibility, and confirmed rights before it can be
                approved.
              </p>
              <p className="mt-3 text-xs leading-5 text-earth-ink">
                Automated checks are guidance, not a score. They never judge a tradition&apos;s
                value.
              </p>
            </section>

            <section className="rounded-xl border border-line/90 bg-paper/80 p-5 shadow-card">
              <FileText className="h-5 w-5 text-terracotta-deep" aria-hidden="true" />
              <h2 className="mt-3 font-display text-lg text-ink">Keep the original</h2>
              <p className="mt-2 text-sm leading-6 text-earth-ink">
                Preserve the words, spelling, and script you were given. Add explanations separately
                rather than quietly correcting a telling.
              </p>
              <Link to="/contribute" className="link-underline mt-4 inline-block text-sm">
                Read the contribution guide
              </Link>
            </section>

            <section className="rounded-xl border border-line/90 bg-paper/80 p-5 shadow-card">
              <MessageSquare className="h-5 w-5 text-forest" aria-hidden="true" />
              <h2 className="mt-3 font-display text-lg text-ink">Questions from review</h2>
              <p className="mt-2 text-sm leading-6 text-earth-ink">
                Moderators may ask for clarification in the feedback thread. Replying there keeps
                the record&apos;s history together.
              </p>
            </section>
          </aside>
        </div>

        {!isNew && record !== null && (
          <div className="mt-12 space-y-8 border-t border-line pt-10">
            <div>
              <p className="eyebrow">Supporting information</p>
              <h2 className="display-section mt-3">Review &amp; provenance</h2>
              <p className="body-copy mt-3 max-w-2xl">
                These panels explain what the archive still needs, how this record relates to
                others, and where the material came from.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              <div className="space-y-6">
                <QualityFindingsPanel
                  report={quality}
                  loading={qualityLoading}
                  title="Quality checks"
                  emptyMessage="The automated checks found no issues with this draft."
                />

                <DuplicateCandidatesPanel
                  result={duplicates}
                  loading={duplicatesLoading}
                  onDeclareVariant={(relatedRecordId, note) => {
                    void handleDeclareVariant(relatedRecordId, note);
                  }}
                  declaring={declaringVariant}
                  error={duplicateError}
                />
              </div>

              <div className="space-y-6">
                <ProvenanceEditor
                  detail={record}
                  canEdit={editable}
                  onSave={(body) => {
                    void handleSaveProvenance(body);
                  }}
                  saving={provenanceSaving}
                  error={provenanceError}
                />
              </div>
            </div>

            <FeedbackThread
              thread={thread}
              loading={threadLoading}
              canReply={editable}
              onSubmit={(body) => {
                void handlePostFeedback(body);
              }}
              submitting={feedbackSubmitting}
              error={feedbackError}
            />

            <UploadMedia recordId={record.id} />
          </div>
        )}

        {!isNew && record !== null && removable && (
          <section
            aria-labelledby="remove-record-heading"
            className="mt-12 rounded-xl border border-danger/20 bg-danger-soft/40 p-5 shadow-card sm:p-6"
          >
            <h2 id="remove-record-heading" className="font-display text-lg text-ink">
              {canDeleteRecord(record.status)
                ? 'Delete this record'
                : 'Remove from the public archive'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-earth-ink">
              {canDeleteRecord(record.status)
                ? 'Deleting removes this record and any uploaded media permanently. This cannot be undone.'
                : 'Published records are removed through a withdrawal request so the archive keeps an auditable record of what changed.'}
            </p>
            <div className="mt-4">
              <RecordRemovalActions
                recordId={record.id}
                title={record.title}
                status={record.status}
                onDeleted={() => navigate('/dashboard')}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
