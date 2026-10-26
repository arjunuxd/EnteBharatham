import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { contributorDetail, errorResponse, jsonResponse, sessionResponse } from '../test/apiMocks';
import { DraftEditorPage } from './DraftEditorPage';

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<unknown>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => impl(url, init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderEditor(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/dashboard/drafts/${id}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/dashboard/drafts/:id" element={<DraftEditorPage />} />
          <Route path="/dashboard" element={<p data-testid="dashboard-page">Dashboard</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const me = (url: string) =>
  url.includes('/auth/me') ? Promise.resolve(jsonResponse(sessionResponse())) : null;

describe('DraftEditorPage', () => {
  it('loads an existing draft into the form', async () => {
    stubFetch((url) => {
      const session = me(url);
      if (session !== null) return session;
      if (url.includes('/heritage/mine/record-1')) {
        return Promise.resolve(
          jsonResponse(
            contributorDetail({
              title: 'Coastal Lanterns',
              content: 'A long story about lanterns.',
              consent: {
                permissionToPublish: true,
                allowAttribution: true,
                allowRedistribution: false,
                verification: 'documented',
              },
            }),
          ),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderEditor('record-1');

    expect(await screen.findByDisplayValue('Coastal Lanterns')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A long story about lanterns.')).toBeInTheDocument();
  });

  it('creates a new draft with the composed payload', async () => {
    const fetchMock = stubFetch((url, init) => {
      const session = me(url);
      if (session !== null) return session;
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.endsWith('/heritage') && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body));
        expect(payload).toMatchObject({
          title: 'New Legend',
          languages: ['Malayalam', 'Tamil'],
          visibility: 'private',
          region: { country: 'India', state: 'Kerala' },
        });
        return Promise.resolve(
          jsonResponse(contributorDetail({ id: 'record-42', title: 'New Legend' }), 201),
        );
      }
      if (url.includes('/heritage/mine/record-42')) {
        return Promise.resolve(
          jsonResponse(contributorDetail({ id: 'record-42', title: 'New Legend' })),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderEditor('new');

    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'New Legend' } });
    fireEvent.change(screen.getByLabelText(/^languages/i), {
      target: { value: 'Malayalam, Tamil' },
    });
    fireEvent.change(screen.getByLabelText(/^state/i), { target: { value: 'Kerala' } });
    fireEvent.click(screen.getByRole('button', { name: /create draft/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/heritage'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('blocks saving when no language is provided', async () => {
    const fetchMock = stubFetch((url) => {
      const session = me(url);
      if (session !== null) return session;
      return Promise.resolve(jsonResponse(contributorDetail()));
    });

    renderEditor('new');

    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Title only' } });
    // Bypass the native `required` on the languages input so the handler-level
    // check is exercised.
    const createButton = screen.getByRole('button', { name: /create draft/i });
    fireEvent.submit(createButton.closest('form') as HTMLFormElement);

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least one language/i);
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/heritage'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('renders a published record as read-only', async () => {
    stubFetch((url) => {
      const session = me(url);
      if (session !== null) return session;
      if (url.includes('/heritage/mine/record-1')) {
        return Promise.resolve(
          jsonResponse(contributorDetail({ status: 'published', visibility: 'public' })),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderEditor('record-1');

    expect(await screen.findByText(/not editable in its current state/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit for review/i })).not.toBeInTheDocument();
    // Published records go through governance rather than direct deletion.
    expect(screen.getByRole('button', { name: /request withdrawal/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
  });

  it('deletes a draft after confirmation and returns to the dashboard', async () => {
    const fetchMock = stubFetch((url, init) => {
      const session = me(url);
      if (session !== null) return session;
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.endsWith('/heritage/record-1') && init?.method === 'DELETE') {
        return Promise.resolve(jsonResponse(null, 204));
      }
      if (url.endsWith('/heritage/mine/record-1')) {
        return Promise.resolve(jsonResponse(contributorDetail()));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderEditor('record-1');

    await screen.findByDisplayValue('Demo Draft');
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /delete record/i }));

    expect(await screen.findByTestId('dashboard-page')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/heritage/record-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('shows the moderator decision banner for changes requested', async () => {
    stubFetch((url) => {
      const session = me(url);
      if (session !== null) return session;
      if (url.includes('/heritage/mine/record-1')) {
        return Promise.resolve(
          jsonResponse(
            contributorDetail({
              status: 'changes_requested',
              review: {
                decision: 'changes_requested',
                reason: 'Please add a source for the second verse.',
                reviewedAt: '2026-03-01T10:00:00.000Z',
              },
            }),
          ),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderEditor('record-1');

    expect(
      await screen.findByText(/please add a source for the second verse/i),
    ).toBeInTheDocument();
    // changes_requested records stay editable.
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
  });

  it('surfaces submission requirements from a 422 on submit', async () => {
    stubFetch((url, init) => {
      const session = me(url);
      if (session !== null) return session;
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.includes('/submit')) {
        expect(init?.method).toBe('POST');
        return Promise.resolve(
          errorResponse(422, 'Submission incomplete', 'SUBMISSION_INCOMPLETE', {
            missing: ['permissionToPublish', 'content'],
          }),
        );
      }
      if (url.includes('/heritage/mine/record-1')) {
        return Promise.resolve(jsonResponse(contributorDetail()));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderEditor('record-1');

    await screen.findByDisplayValue('Once upon a time in a coastal village…');
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/permissionToPublish/);
    expect(alert).toHaveTextContent(/content/);
  });

  it('shows a not-found state for a non-owned record', async () => {
    stubFetch((url) => {
      const session = me(url);
      if (session !== null) return session;
      return Promise.resolve(errorResponse(404, 'Record not found', 'NOT_FOUND'));
    });

    renderEditor('record-1');

    expect(await screen.findByText(/record not found/i)).toBeInTheDocument();
    expect(screen.getByText(/not one of your records/i)).toBeInTheDocument();
  });

  it('shows the quality findings, similar records, and feedback thread', async () => {
    stubFetch((url) => {
      const session = me(url);
      if (session !== null) return session;
      if (url.includes('/heritage/mine/record-1/quality')) {
        return Promise.resolve(
          jsonResponse({
            quality: {
              findings: [
                {
                  code: 'consent.publish_permission_missing',
                  severity: 'blocker',
                  message: 'Publication permission is missing.',
                  guidance: 'Confirm that the community agreed to publish.',
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
      if (url.includes('/heritage/mine/record-1/duplicates')) {
        return Promise.resolve(
          jsonResponse({
            recordId: 'record-1',
            candidates: [],
            notes: ['Nothing is merged automatically.'],
          }),
        );
      }
      if (url.includes('/heritage/mine/record-1/feedback')) {
        return Promise.resolve(
          jsonResponse({
            recordId: 'record-1',
            status: 'changes_requested',
            messages: [
              {
                id: 'msg-1',
                recordId: 'record-1',
                kind: 'clarification',
                message: 'Please add the collector details.',
                visibility: 'contributor',
                authorRole: 'moderator',
                createdAt: '2026-04-01T10:00:00.000Z',
              },
            ],
            openContributorMessages: 1,
            openInternalMessages: 0,
          }),
        );
      }
      if (url.includes('/heritage/mine/record-1')) {
        return Promise.resolve(jsonResponse(contributorDetail()));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderEditor('record-1');

    expect(await screen.findByText(/publication permission is missing/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing is merged automatically/i)).toBeInTheDocument();
    expect(screen.getByText(/please add the collector details/i)).toBeInTheDocument();
  });

  it('keeps the draft usable when the quality call fails', async () => {
    stubFetch((url) => {
      const session = me(url);
      if (session !== null) return session;
      if (url.includes('/quality')) {
        return Promise.resolve(errorResponse(500, 'Quality service failed', 'INTERNAL_ERROR'));
      }
      if (url.includes('/heritage/mine/record-1')) {
        return Promise.resolve(jsonResponse(contributorDetail({ title: 'Coastal Lanterns' })));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderEditor('record-1');

    expect(await screen.findByDisplayValue('Coastal Lanterns')).toBeInTheDocument();
    expect(await screen.findByText(/quality report could not be loaded/i)).toBeInTheDocument();
  });

  it('saves the provenance without reviewer-controlled fields', async () => {
    const fetchMock = stubFetch((url, init) => {
      const session = me(url);
      if (session !== null) return session;
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.includes('/provenance') && init?.method === 'PATCH') {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(payload).not.toHaveProperty('reviewStatus');
        expect(payload).not.toHaveProperty('reviewerNotes');
        expect(payload).toMatchObject({ originalLanguage: 'Malayalam' });
        return Promise.resolve(jsonResponse(contributorDetail()));
      }
      if (url.includes('/heritage/mine/record-1')) {
        return Promise.resolve(jsonResponse(contributorDetail()));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderEditor('record-1');

    const languageInput = await screen.findByLabelText(/original language of the material/i);
    fireEvent.change(languageInput, { target: { value: 'Malayalam' } });
    fireEvent.click(screen.getByRole('button', { name: /save provenance/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/heritage/mine/record-1/provenance'),
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
  });
});
