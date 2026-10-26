import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CorrectionProposalPublic,
  DuplicateSuggestionResponse,
  FeedbackThreadPublic,
  QualityReport,
  ReportDetail,
  WithdrawalRequestPublic,
} from '@entebharatham/shared';
import { DuplicateCandidatesPanel } from '../components/DuplicateCandidatesPanel';
import { FeedbackThread } from '../components/FeedbackThread';
import { ProvenanceEditor } from '../components/ProvenanceEditor';
import { QualityFindingsPanel } from '../components/QualityFindingsPanel';
import { contributorDetail, errorResponse, jsonResponse } from '../test/apiMocks';
import { ModerationGovernancePage } from './ModerationGovernancePage';

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<unknown>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => impl(url, init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Returns the first element of a list, failing loudly when the list is empty. */
function firstOf<T>(items: T[]): T {
  const [first] = items;
  if (first === undefined) throw new Error('expected at least one element');
  return first;
}

const qualityReport: QualityReport = {
  findings: [
    {
      code: 'content.too_short',
      severity: 'blocker',
      message: 'The record body is shorter than the minimum for a folk story.',
      guidance: 'Add the full telling as it was given to you.',
      field: 'content',
    },
    {
      code: 'provenance.community_context_missing',
      severity: 'warning',
      message: 'No community context is recorded.',
      guidance: 'Say which village or community this comes from.',
      field: 'provenance.communityContext',
    },
    {
      code: 'attribution.anonymity_declared',
      severity: 'info',
      message: 'You asked not to be named publicly.',
      guidance: 'No action needed.',
    },
  ],
  blockerCount: 1,
  warningCount: 1,
  infoCount: 1,
  blocking: true,
  checkedAt: '2026-04-01T10:00:00.000Z',
};

const duplicateResult: DuplicateSuggestionResponse = {
  recordId: 'record-1',
  candidates: [
    {
      id: 'record-9',
      slug: 'the-lamp-keeper',
      title: 'The lamp keeper of the coastal village',
      heritageType: 'folk_story',
      languages: ['Malayalam'],
      region: { country: 'India', state: 'Kerala' },
      similarity: 0.92,
      reasons: ['identical_title', 'same_type_and_region'],
      explanation: 'The title is identical to a published record.',
    },
  ],
  notes: [
    'Matching is limited to publicly published records.',
    'Similar records are often legitimate regional variants.',
  ],
};

const feedbackThread: FeedbackThreadPublic = {
  recordId: 'record-1',
  status: 'changes_requested',
  messages: [
    {
      id: 'msg-1',
      recordId: 'record-1',
      kind: 'clarification',
      message: 'Should the second verse be included as well?',
      visibility: 'contributor',
      authorRole: 'moderator',
      createdAt: '2026-04-01T10:00:00.000Z',
    },
    {
      id: 'msg-2',
      recordId: 'record-1',
      kind: 'provenance',
      message: 'Internal reasoning that must stay internal.',
      visibility: 'internal',
      authorRole: 'moderator',
      createdAt: '2026-04-01T11:00:00.000Z',
    },
  ],
  openContributorMessages: 1,
  openInternalMessages: 1,
};

describe('QualityFindingsPanel', () => {
  it('lists findings with guidance and never presents a score', () => {
    render(<QualityFindingsPanel report={qualityReport} />);

    expect(screen.getByText(/shorter than the minimum/i)).toBeInTheDocument();
    expect(screen.getByText(/add the full telling/i)).toBeInTheDocument();
    expect(screen.getByText(/1 to fix/i)).toBeInTheDocument();
    expect(screen.getByText(/1 recommended/i)).toBeInTheDocument();
    // A score would rank the material; the panel must not imply one.
    expect(screen.queryByText(/\bscore\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\brating\b/i)).not.toBeInTheDocument();
  });

  it('shows an empty state when no findings were reported', () => {
    render(
      <QualityFindingsPanel
        report={{
          findings: [],
          blockerCount: 0,
          warningCount: 0,
          infoCount: 0,
          blocking: false,
          checkedAt: '2026-04-01T10:00:00.000Z',
        }}
      />,
    );

    expect(screen.getByText(/no issues found by the automated checks/i)).toBeInTheDocument();
  });

  it('shows a loading and a failure state', () => {
    const { rerender } = render(<QualityFindingsPanel report={null} loading />);
    expect(screen.getByRole('status')).toHaveTextContent(/running checks/i);

    rerender(<QualityFindingsPanel report={null} />);
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
  });
});

describe('DuplicateCandidatesPanel', () => {
  function renderPanel(props: React.ComponentProps<typeof DuplicateCandidatesPanel>) {
    return render(
      <MemoryRouter>
        <DuplicateCandidatesPanel {...props} />
      </MemoryRouter>,
    );
  }

  it('explains why a candidate was surfaced', () => {
    renderPanel({ result: duplicateResult });

    expect(screen.getByRole('link', { name: /lamp keeper/i })).toHaveAttribute(
      'href',
      '/heritage/the-lamp-keeper',
    );
    expect(screen.getByText(/title is identical/i)).toBeInTheDocument();
    expect(screen.getByText(/identical title/i)).toBeInTheDocument();
    expect(
      screen.getByText(/similar records are often legitimate regional variants/i),
    ).toBeInTheDocument();
  });

  it('records a variant declaration instead of merging anything', () => {
    const onDeclareVariant = vi.fn();
    renderPanel({ result: duplicateResult, onDeclareVariant });

    fireEvent.click(
      screen.getByRole('button', { name: /distinct variant or independent account/i }),
    );
    const note = screen.getByLabelText(/how is it different/i);
    fireEvent.change(note, { target: { value: 'Told differently in the northern villages.' } });
    fireEvent.click(screen.getByRole('button', { name: /record as a distinct variant/i }));

    expect(onDeclareVariant).toHaveBeenCalledWith(
      'record-9',
      'Told differently in the northern villages.',
    );
  });

  it('requires a note of at least 10 characters', () => {
    renderPanel({ result: duplicateResult, onDeclareVariant: vi.fn() });

    fireEvent.click(
      screen.getByRole('button', { name: /distinct variant or independent account/i }),
    );
    fireEvent.change(screen.getByLabelText(/how is it different/i), { target: { value: 'short' } });

    expect(screen.getByRole('button', { name: /record as a distinct variant/i })).toBeDisabled();
  });
});

describe('FeedbackThread', () => {
  it('hides the internal-note control from contributors', () => {
    render(<FeedbackThread thread={feedbackThread} canReply onSubmit={vi.fn()} />);

    expect(screen.getByText(/should the second verse/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/internal reasoning that must stay internal/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/who can see this/i)).not.toBeInTheDocument();
  });

  it('lets a moderator write an internal note and resolve a message', () => {
    const onSubmit = vi.fn();
    const onResolve = vi.fn();
    render(
      <FeedbackThread
        thread={feedbackThread}
        canModerate
        onSubmit={onSubmit}
        onResolve={onResolve}
      />,
    );

    expect(screen.getByText(/internal reasoning that must stay internal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/who can see this/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/who can see this/i), { target: { value: 'internal' } });
    fireEvent.change(screen.getByLabelText(/^message/i), {
      target: { value: 'Please confirm the collector details.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /post feedback/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'clarification',
      message: 'Please confirm the collector details.',
      visibility: 'internal',
    });

    fireEvent.click(firstOf(screen.getAllByRole('button', { name: /mark resolved/i })));
    expect(onResolve).toHaveBeenCalledWith('msg-1');
  });

  it('attaches a reply to the message it answers', () => {
    const onSubmit = vi.fn();
    render(<FeedbackThread thread={feedbackThread} canReply onSubmit={onSubmit} />);

    fireEvent.click(firstOf(screen.getAllByRole('button', { name: /^reply$/i })));
    fireEvent.change(screen.getByLabelText(/^message \(reply\)/i), {
      target: { value: 'Yes, the second verse belongs to the telling.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /post feedback/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'clarification',
      message: 'Yes, the second verse belongs to the telling.',
      parentId: 'msg-1',
    });
  });

  it('keeps the submit button disabled for a too-short message', () => {
    render(<FeedbackThread thread={feedbackThread} canReply onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/^message/i), { target: { value: 'short' } });
    expect(screen.getByRole('button', { name: /post feedback/i })).toBeDisabled();
  });
});

describe('ProvenanceEditor', () => {
  it('shows the provenance block and the contributor edit form', () => {
    const detail = contributorDetail({
      provenance: {
        attributionPreference: 'pseudonymous',
        permitAnonymity: true,
        reviewStatus: 'unreviewed',
        originalLanguage: 'Malayalam',
        communityContext: 'Northern coastal villages',
      },
    });

    render(<ProvenanceEditor detail={detail} canEdit onSave={vi.fn()} />);

    expect(screen.getByText(/northern coastal villages/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/original language of the material/i)).toHaveValue('Malayalam');
    expect(screen.getByLabelText(/how should you be credited/i)).toHaveValue('pseudonymous');
    // Reviewer-only controls must not appear for a contributor.
    expect(screen.queryByLabelText(/internal notes/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^review status$/i)).not.toBeInTheDocument();
  });

  it('sends the edited provenance without reviewer fields', () => {
    const onSave = vi.fn();
    const detail = contributorDetail();

    render(<ProvenanceEditor detail={detail} canEdit onSave={onSave} />);

    fireEvent.change(screen.getByLabelText(/original language of the material/i), {
      target: { value: 'Tamil' },
    });
    fireEvent.change(screen.getByLabelText(/community or regional context/i), {
      target: { value: 'Southern coastal villages' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save provenance/i }));

    expect(onSave).toHaveBeenCalledWith({
      originalLanguage: 'Tamil',
      communityContext: 'Southern coastal villages',
      attributionPreference: 'named',
      permitAnonymity: false,
    });
  });

  it('offers moderators the reviewer assessment and explains what it means', () => {
    const onReview = vi.fn();
    render(<ProvenanceEditor detail={contributorDetail()} canReview onReview={onReview} />);

    expect(
      screen.getByText(/not a claim that the story is historically true/i),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^review status$/i), {
      target: { value: 'verified' },
    });
    fireEvent.change(screen.getByLabelText(/internal notes/i), {
      target: { value: 'Collector confirmed the attribution.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save reviewer assessment/i }));

    expect(onReview).toHaveBeenCalledWith({
      reviewStatus: 'verified',
      reviewerNotes: 'Collector confirmed the attribution.',
    });
  });

  it('renders the provenance history when the record has one', () => {
    const detail = contributorDetail({
      provenanceHistory: [
        {
          id: 'entry-1',
          changedAt: '2026-04-01T10:00:00.000Z',
          reason: 'Adding the origin of the telling',
          changes: [{ field: 'originalLanguage', previous: undefined, next: 'Malayalam' }],
        },
      ],
    });

    render(<ProvenanceEditor detail={detail} />);

    expect(screen.getByText(/provenance history/i)).toBeInTheDocument();
    expect(screen.getByText(/adding the origin of the telling/i)).toBeInTheDocument();
  });
});

describe('ModerationGovernancePage', () => {
  const report: ReportDetail = {
    id: 'report-1',
    heritageRecordId: 'record-1',
    recordTitle: 'The lamp keeper',
    category: 'incorrect_misleading',
    status: 'under_review',
    explanation: 'The village name in the story looks wrong.',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
  };

  const correction: CorrectionProposalPublic = {
    id: 'correction-1',
    heritageRecordId: 'record-1',
    recordTitle: 'The lamp keeper',
    status: 'under_review',
    rationale: 'The summary named the wrong village.',
    proposedChanges: { summary: 'A corrected summary.' },
    createdAt: '2026-04-01T10:00:00.000Z',
  };

  const withdrawal: WithdrawalRequestPublic = {
    id: 'withdrawal-1',
    heritageRecordId: 'record-1',
    recordTitle: 'The lamp keeper',
    type: 'contributor_withdrawal',
    status: 'under_review',
    reason: 'The family asked us to take this story down.',
    createdAt: '2026-04-01T10:00:00.000Z',
  };

  function renderGovernance() {
    return render(
      <MemoryRouter initialEntries={['/moderation/governance']}>
        <ModerationGovernancePage />
      </MemoryRouter>,
    );
  }

  it('lists community reports and resolves one', async () => {
    const fetchMock = stubFetch((url, init) => {
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.includes('/reports/') && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ report: { ...report, status: 'resolved' } }));
      }
      if (url.includes('/reports')) {
        return Promise.resolve(jsonResponse({ reports: [report] }));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderGovernance();

    expect(await screen.findByText('The lamp keeper')).toBeInTheDocument();
    expect(screen.getByText(/village name in the story looks wrong/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'resolved' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/reports/report-1/resolution'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ status: 'resolved' }),
        }),
      ),
    );
  });

  it('switches to the corrections queue', async () => {
    stubFetch((url) => {
      if (url.includes('/corrections')) {
        return Promise.resolve(jsonResponse({ corrections: [correction] }));
      }
      return Promise.resolve(jsonResponse({ reports: [] }));
    });

    renderGovernance();

    fireEvent.click(await screen.findByRole('tab', { name: /corrections/i }));

    expect(await screen.findByText(/summary named the wrong village/i)).toBeInTheDocument();
    expect(screen.getByText(/a corrected summary/i)).toBeInTheDocument();
  });

  it('switches to the withdrawals queue', async () => {
    stubFetch((url) => {
      if (url.includes('/withdrawals')) {
        return Promise.resolve(jsonResponse({ withdrawals: [withdrawal] }));
      }
      return Promise.resolve(jsonResponse({ reports: [] }));
    });

    renderGovernance();

    fireEvent.click(await screen.findByRole('tab', { name: /withdrawals/i }));

    expect(await screen.findByText(/family asked us to take this story down/i)).toBeInTheDocument();
  });

  it('explains a 403 without offering a retry', async () => {
    stubFetch(() => Promise.resolve(errorResponse(403, 'Forbidden', 'FORBIDDEN')));

    renderGovernance();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /do not have permission to view this queue/i,
    );
  });
});
