import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  auditEvent,
  errorResponse,
  jsonResponse,
  moderationDetail,
  moderationSummary,
  paginatedItems,
} from '../test/apiMocks';
import { AuditLogPage } from './AuditLogPage';
import { ModerationQueuePage } from './ModerationQueuePage';
import { ModerationSubmissionPage } from './ModerationSubmissionPage';

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<unknown>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => impl(url, init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderQueue() {
  return render(
    <MemoryRouter initialEntries={['/moderation']}>
      <ModerationQueuePage />
    </MemoryRouter>,
  );
}

function renderSubmission(id = 'record-1') {
  return render(
    <MemoryRouter initialEntries={[`/moderation/submissions/${id}`]}>
      <Routes>
        <Route path="/moderation/submissions/:id" element={<ModerationSubmissionPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderAudit() {
  return render(
    <MemoryRouter initialEntries={['/moderation/audit']}>
      <AuditLogPage />
    </MemoryRouter>,
  );
}

describe('ModerationQueuePage', () => {
  it('lists queued submissions with consent indicators', async () => {
    stubFetch((url) =>
      url.includes('/moderation/submissions')
        ? Promise.resolve(
            jsonResponse(
              paginatedItems([
                moderationSummary({ title: 'Coastal Legend' }),
                moderationSummary({
                  id: 'record-2',
                  title: 'Blocked Sample',
                  permissionToPublish: false,
                  rightsStatus: 'unknown',
                  visibility: 'private',
                }),
              ]),
            ),
          )
        : Promise.resolve(jsonResponse({})),
    );

    renderQueue();

    expect(await screen.findByRole('link', { name: 'Coastal Legend' })).toBeInTheDocument();
    expect(screen.getByText('Publish permission: yes')).toBeInTheDocument();
    expect(screen.getByText('Publish permission: MISSING')).toBeInTheDocument();
    expect(screen.getByText('Rights: unknown')).toBeInTheDocument();
  });

  it('shows an empty-queue state', async () => {
    stubFetch((url) =>
      url.includes('/moderation/submissions')
        ? Promise.resolve(jsonResponse(paginatedItems([], { totalPages: 0 })))
        : Promise.resolve(jsonResponse({})),
    );

    renderQueue();

    expect(await screen.findByText(/queue is empty/i)).toBeInTheDocument();
  });

  it('shows a moderator-access message on 403', async () => {
    stubFetch(() => Promise.resolve(errorResponse(403, 'Forbidden', 'FORBIDDEN')));

    renderQueue();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/does not have moderator access/i);
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });
});

describe('ModerationSubmissionPage', () => {
  it('approves and publishes a submission', async () => {
    stubFetch((url) => {
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.includes('/approve')) {
        return Promise.resolve(
          jsonResponse(moderationDetail({ status: 'published', visibility: 'public' })),
        );
      }
      return Promise.resolve(jsonResponse(moderationDetail()));
    });

    renderSubmission();

    await screen.findByRole('button', { name: /approve & publish/i });
    fireEvent.click(screen.getByRole('button', { name: /approve & publish/i }));

    // The success notice persists even as approval flips the record to published.
    expect(await screen.findByText(/submission approved and published/i)).toBeInTheDocument();
    expect(screen.getByText(/no longer awaiting review/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve & publish/i })).not.toBeInTheDocument();
  });

  it('surfaces publish blockers from a NOT_PUBLISHABLE 409', async () => {
    stubFetch((url) => {
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.includes('/approve')) {
        return Promise.resolve(
          errorResponse(409, 'Not publishable', 'NOT_PUBLISHABLE', {
            missing: ['visibility', 'rightsStatus'],
          }),
        );
      }
      return Promise.resolve(jsonResponse(moderationDetail()));
    });

    renderSubmission();

    await screen.findByRole('button', { name: /approve & publish/i });
    fireEvent.click(screen.getByRole('button', { name: /approve & publish/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/visibility/);
    expect(alert).toHaveTextContent(/rightsStatus/);
  });

  it('requires a reason of at least 10 characters to request changes', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(moderationDetail())));

    renderSubmission();

    await screen.findByRole('button', { name: /request changes/i });
    fireEvent.change(screen.getByLabelText(/request changes \(reason/i), {
      target: { value: 'too short' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^request changes$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 10 characters/i);
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/request-changes'),
      expect.anything(),
    );
  });

  it('keeps reject and request-changes reasons independent', async () => {
    const fetchMock = stubFetch((url) => {
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.includes('/reject')) {
        // The reject body must carry the reject reason, not the changes reason.
        return Promise.resolve(jsonResponse(moderationDetail({ status: 'rejected' })));
      }
      return Promise.resolve(jsonResponse(moderationDetail()));
    });

    renderSubmission();

    await screen.findByLabelText(/request changes \(reason/i);
    fireEvent.change(screen.getByLabelText(/request changes \(reason/i), {
      target: { value: 'improve the opening paragraph' },
    });
    fireEvent.change(screen.getByLabelText(/reject with reason/i), {
      target: { value: 'rights are not cleared' },
    });
    fireEvent.click(screen.getByRole('button', { name: /reject submission/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/reject'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reason: 'rights are not cleared' }),
        }),
      ),
    );
  });

  it('shows a read-only notice when the submission is no longer pending', async () => {
    stubFetch(() => Promise.resolve(jsonResponse(moderationDetail({ status: 'published' }))));

    renderSubmission();

    expect(await screen.findByText(/no longer awaiting review/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve & publish/i })).not.toBeInTheDocument();
  });

  it('shows a not-found state on 404', async () => {
    stubFetch(() => Promise.resolve(errorResponse(404, 'Submission not found', 'NOT_FOUND')));

    renderSubmission();

    expect(await screen.findByText(/submission not found/i)).toBeInTheDocument();
  });

  it('shows the publication-phase quality findings', async () => {
    stubFetch((url) => {
      if (url.includes('/moderation/submissions/record-1/quality')) {
        return Promise.resolve(
          jsonResponse({
            quality: {
              findings: [
                {
                  code: 'visibility.not_public',
                  severity: 'blocker',
                  message: 'The record is not publicly visible.',
                  guidance: 'Ask the contributor to publish it.',
                },
              ],
              blockerCount: 1,
              warningCount: 0,
              infoCount: 0,
              blocking: true,
              checkedAt: '2026-04-01T10:00:00.000Z',
            },
          }),
        );
      }
      if (url.includes('/moderation/submissions/record-1/feedback')) {
        return Promise.resolve(
          jsonResponse({
            recordId: 'record-1',
            status: 'pending_review',
            messages: [],
            openContributorMessages: 0,
            openInternalMessages: 0,
          }),
        );
      }
      return Promise.resolve(jsonResponse(moderationDetail()));
    });

    renderSubmission();

    expect(await screen.findByText(/not publicly visible/i)).toBeInTheDocument();
  });

  it('posts a moderator feedback note and can mark it internal', async () => {
    const fetchMock = stubFetch((url, init) => {
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.includes('/feedback') && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(payload.visibility).toBe('internal');
        return Promise.resolve(
          jsonResponse({
            recordId: 'record-1',
            status: 'pending_review',
            messages: [],
            openContributorMessages: 0,
            openInternalMessages: 1,
          }),
        );
      }
      if (url.includes('/feedback')) {
        return Promise.resolve(
          jsonResponse({
            recordId: 'record-1',
            status: 'pending_review',
            messages: [],
            openContributorMessages: 0,
            openInternalMessages: 0,
          }),
        );
      }
      return Promise.resolve(jsonResponse(moderationDetail()));
    });

    renderSubmission();

    await screen.findByLabelText(/who can see this/i);
    fireEvent.change(screen.getByLabelText(/who can see this/i), { target: { value: 'internal' } });
    fireEvent.change(screen.getByLabelText(/^message/i), {
      target: { value: 'Please confirm the collector details.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /post feedback/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/moderation/submissions/record-1/feedback'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('saves a reviewer provenance assessment', async () => {
    const fetchMock = stubFetch((url, init) => {
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.includes('/provenance') && init?.method === 'PATCH') {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(payload.reviewStatus).toBe('verified');
        return Promise.resolve(jsonResponse(moderationDetail()));
      }
      if (url.includes('/feedback')) {
        return Promise.resolve(
          jsonResponse({
            recordId: 'record-1',
            status: 'pending_review',
            messages: [],
            openContributorMessages: 0,
            openInternalMessages: 0,
          }),
        );
      }
      return Promise.resolve(jsonResponse(moderationDetail()));
    });

    renderSubmission();

    await screen.findByLabelText(/^review status$/i);
    fireEvent.change(screen.getByLabelText(/^review status$/i), { target: { value: 'verified' } });
    fireEvent.click(screen.getByRole('button', { name: /save reviewer assessment/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/moderation/submissions/record-1/provenance'),
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
  });
});

describe('AuditLogPage', () => {
  it('renders audit events with friendly action labels', async () => {
    stubFetch((url) =>
      url.includes('/moderation/audit')
        ? Promise.resolve(
            jsonResponse(
              paginatedItems([
                auditEvent({ action: 'record.approved', actorRole: 'moderator' }),
                auditEvent({ id: 'audit-2', action: 'user.role_changed', actorRole: 'admin' }),
              ]),
            ),
          )
        : Promise.resolve(jsonResponse({})),
    );

    renderAudit();

    expect(await screen.findByText('Record approved')).toBeInTheDocument();
    expect(screen.getByText('Role changed')).toBeInTheDocument();
  });

  it('shows a moderator-access message on 403', async () => {
    stubFetch(() => Promise.resolve(errorResponse(403, 'Forbidden', 'FORBIDDEN')));

    renderAudit();

    expect(await screen.findByRole('alert')).toHaveTextContent(/does not have moderator access/i);
  });

  it('shows an empty state when there are no events', async () => {
    stubFetch((url) =>
      url.includes('/moderation/audit')
        ? Promise.resolve(jsonResponse(paginatedItems([], { totalPages: 0 })))
        : Promise.resolve(jsonResponse({})),
    );

    renderAudit();

    expect(await screen.findByText(/no audit events recorded yet/i)).toBeInTheDocument();
  });
});
