import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  errorResponse,
  contributorDetail,
  contributorSummary,
  jsonResponse,
  paginatedItems,
} from '../test/apiMocks';
import { DashboardPage } from './DashboardPage';

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<unknown>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => impl(url, init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/drafts/:id" element={<p data-testid="editor-page">Editor</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  it('lists the contributor records returned by /heritage/mine', async () => {
    stubFetch((url) => {
      if (url.includes('/heritage/mine')) {
        return Promise.resolve(
          jsonResponse(
            paginatedItems([
              contributorSummary(),
              contributorSummary({
                id: 'record-2',
                title: 'Second Draft',
                status: 'pending_review',
                visibility: 'public',
              }),
            ]),
          ),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderDashboard();

    expect(await screen.findByRole('link', { name: 'Demo Draft' })).toBeInTheDocument();
    expect(screen.getAllByText('In review').length).toBeGreaterThan(0);
    // Drafts are editable; pending submissions are not.
    expect(screen.getAllByRole('link', { name: /edit/i }).length).toBe(1);
    expect(screen.getAllByRole('link', { name: /view/i }).length).toBe(1);
  });

  it('shows an empty state when the contributor has no records', async () => {
    stubFetch((url) =>
      url.includes('/heritage/mine')
        ? Promise.resolve(jsonResponse(paginatedItems([], { totalPages: 0 })))
        : Promise.resolve(jsonResponse({})),
    );

    renderDashboard();

    expect(await screen.findByText(/you have not created any records yet/i)).toBeInTheDocument();
  });

  it('requests a status filter when the select changes', async () => {
    const fetchMock = stubFetch((url) =>
      url.includes('/heritage/mine')
        ? Promise.resolve(jsonResponse(paginatedItems([contributorSummary()])))
        : Promise.resolve(jsonResponse({})),
    );

    renderDashboard();

    await screen.findByRole('link', { name: 'Demo Draft' });
    fireEvent.change(screen.getByLabelText(/filter by status/i), {
      target: { value: 'changes_requested' },
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('status=changes_requested'),
        expect.anything(),
      ),
    );
  });

  it('creates a draft and navigates to the editor', async () => {
    stubFetch((url, init) => {
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.endsWith('/heritage') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toMatchObject({ title: 'New Story' });
        return Promise.resolve(
          jsonResponse(contributorDetail({ id: 'record-9', title: 'New Story' }), 201),
        );
      }
      if (url.includes('/heritage/mine')) {
        return Promise.resolve(jsonResponse(paginatedItems([contributorSummary()])));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderDashboard();

    await screen.findByRole('link', { name: 'Demo Draft' });
    fireEvent.change(screen.getByLabelText(/start a new draft/i), {
      target: { value: 'New Story' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create draft/i }));

    expect(await screen.findByTestId('editor-page')).toBeInTheDocument();
  });

  it('validates the title length before creating', async () => {
    const fetchMock = stubFetch((url) =>
      url.includes('/heritage/mine')
        ? Promise.resolve(jsonResponse(paginatedItems([contributorSummary()])))
        : Promise.resolve(jsonResponse({})),
    );

    renderDashboard();

    await screen.findByRole('link', { name: 'Demo Draft' });
    // Bypass the native `required`/`minLength` so the handler-level check runs.
    const form = screen.getByRole('form', { name: /create a new draft/i });
    fireEvent.submit(form);

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 3 characters/i);
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/heritage'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('submits a draft for review', async () => {
    stubFetch((url, init) => {
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.includes('/submit')) {
        expect(init?.method).toBe('POST');
        return Promise.resolve(jsonResponse(contributorDetail({ status: 'pending_review' })));
      }
      if (url.includes('/heritage/mine')) {
        return Promise.resolve(jsonResponse(paginatedItems([contributorSummary()])));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderDashboard();

    await screen.findByRole('link', { name: 'Demo Draft' });
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('surfaces missing submission requirements from a 422', async () => {
    stubFetch((url) => {
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.includes('/submit')) {
        return Promise.resolve(
          errorResponse(422, 'Submission incomplete', 'SUBMISSION_INCOMPLETE', {
            missing: ['permissionToPublish', 'sources'],
          }),
        );
      }
      if (url.includes('/heritage/mine')) {
        return Promise.resolve(jsonResponse(paginatedItems([contributorSummary()])));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderDashboard();

    await screen.findByRole('link', { name: 'Demo Draft' });
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/permissionToPublish/);
    expect(alert).toHaveTextContent(/sources/);
  });

  it('deletes a draft only after confirmation', async () => {
    let deleted = false;
    const fetchMock = stubFetch((url, init) => {
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.includes('/heritage/record-1') && init?.method === 'DELETE') {
        deleted = true;
        return Promise.resolve(jsonResponse(null, 204));
      }
      if (url.includes('/heritage/mine')) {
        return Promise.resolve(
          jsonResponse(
            paginatedItems(deleted ? [] : [contributorSummary()], {
              totalPages: deleted ? 0 : 1,
            }),
          ),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderDashboard();

    await screen.findByRole('link', { name: 'Demo Draft' });
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    const dialog = await screen.findByRole('dialog');
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/heritage/record-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );

    fireEvent.click(within(dialog).getByRole('button', { name: /delete record/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/heritage/record-1'),
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
    expect(await screen.findByText(/you have not created any records yet/i)).toBeInTheDocument();
  });

  it('requests a withdrawal instead of deleting a published record', async () => {
    let posted: Record<string, unknown> | null = null;
    stubFetch((url, init) => {
      if (url.includes('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'tok' }));
      if (url.endsWith('/withdrawals') && init?.method === 'POST') {
        posted = JSON.parse(String(init.body)) as Record<string, unknown>;
        return Promise.resolve(jsonResponse({ withdrawal: { id: 'withdrawal-1' } }, 201));
      }
      if (url.includes('/heritage/mine')) {
        return Promise.resolve(
          jsonResponse(
            paginatedItems([contributorSummary({ status: 'published', visibility: 'public' })]),
          ),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderDashboard();

    await screen.findByRole('link', { name: 'Demo Draft' });
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /request withdrawal/i }));
    fireEvent.change(screen.getByLabelText(/reason for withdrawal/i), {
      target: { value: 'The family asked us to remove this record from the archive.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({
      heritageRecordId: 'record-1',
      type: 'contributor_withdrawal',
      reason: 'The family asked us to remove this record from the archive.',
    });
    expect(await screen.findByText(/withdrawal request sent/i)).toBeInTheDocument();
  });

  it('shows an error state with a working retry', async () => {
    let attempt = 0;
    stubFetch((url) => {
      if (url.includes('/heritage/mine')) {
        attempt += 1;
        return attempt === 1
          ? Promise.reject(new Error('network down'))
          : Promise.resolve(jsonResponse(paginatedItems([contributorSummary()])));
      }
      return Promise.resolve(jsonResponse({}));
    });

    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your records/i);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByRole('link', { name: 'Demo Draft' })).toBeInTheDocument();
  });
});
