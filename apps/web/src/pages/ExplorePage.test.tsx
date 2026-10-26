import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, paginatedRecords, recordSummary } from '../test/apiMocks';
import { ExplorePage } from './ExplorePage';

function renderExplore(initialEntries: string[] = ['/explore']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ExplorePage />
    </MemoryRouter>,
  );
}

function stubFetch(impl: (url: string) => Promise<unknown>) {
  const fetchMock = vi.fn((url: string) => impl(url));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ExplorePage', () => {
  it('shows a loading state while the request is pending', () => {
    stubFetch(() => new Promise(() => {}));
    renderExplore();
    expect(screen.getByRole('status')).toHaveTextContent(/loading heritage records/i);
  });

  it('renders records returned by the API', async () => {
    stubFetch(() =>
      Promise.resolve(
        jsonResponse(
          paginatedRecords([
            recordSummary(),
            recordSummary({
              id: 'record-2',
              slug: 'demo-song',
              title: 'വിളക്കൂരിലെ പാട്ട്',
              heritageType: 'song',
              languages: ['Malayalam', 'English'],
              region: { country: 'India', state: 'Tamil Nadu' },
            }),
          ]),
        ),
      ),
    );

    renderExplore();

    expect(await screen.findByRole('heading', { name: 'Demo Record' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'വിളക്കൂരിലെ പാട്ട്' })).toBeInTheDocument();
    // The label also appears as a filter <option>, hence getAllByText.
    expect(screen.getAllByText('Folk stories & oral narratives').length).toBeGreaterThan(0);
    expect(screen.getByText('Kerala, India')).toBeInTheDocument();
    expect(screen.getByText('Tamil Nadu, India')).toBeInTheDocument();
    expect(screen.getByText('Malayalam, English')).toBeInTheDocument();
    expect(screen.getAllByText('Fictional demo record').length).toBeGreaterThan(0);
  });

  it('requests the first page with the configured page size', async () => {
    const fetchMock = stubFetch((url: string) => {
      if (url.includes('/discovery/facets')) {
        return Promise.resolve(
          jsonResponse({
            heritageTypes: [],
            languages: [],
            regions: [],
            tags: [],
          }),
        );
      }
      return Promise.resolve(jsonResponse(paginatedRecords([])));
    });
    renderExplore();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).includes('/heritage?page=1&limit=12')),
    ).toBe(true);
  });

  it('shows an empty state when no records match', async () => {
    stubFetch((url: string) => {
      if (url.includes('/discovery/facets')) {
        return Promise.resolve(
          jsonResponse({
            heritageTypes: [],
            languages: [],
            regions: [],
            tags: [],
          }),
        );
      }
      return Promise.resolve(jsonResponse(paginatedRecords([], { totalPages: 0 })));
    });
    renderExplore();
    expect(await screen.findByText(/no heritage records match these filters/i)).toBeInTheDocument();
  });

  it('shows an error state and recovers after retry', async () => {
    let attempt = 0;
    stubFetch((url: string) => {
      if (url.includes('/discovery/facets')) {
        return Promise.resolve(
          jsonResponse({
            heritageTypes: [],
            languages: [],
            regions: [],
            tags: [],
          }),
        );
      }
      attempt += 1;
      return attempt === 1
        ? Promise.reject(new Error('network down'))
        : Promise.resolve(jsonResponse(paginatedRecords([recordSummary()])));
    });

    renderExplore();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not load heritage records/i);

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByRole('heading', { name: 'Demo Record' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sends the selected category as a filter', async () => {
    const fetchMock = stubFetch((url: string) => {
      if (url.includes('/discovery/facets')) {
        return Promise.resolve(
          jsonResponse({
            heritageTypes: [],
            languages: [],
            regions: [],
            tags: [],
          }),
        );
      }
      return Promise.resolve(jsonResponse(paginatedRecords([])));
    });
    renderExplore();

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'song' } });

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).includes('heritageType=song')),
      ).toBe(true),
    );
  });

  it('submits search text as a filter', async () => {
    const fetchMock = stubFetch((url: string) => {
      if (url.includes('/discovery/facets')) {
        return Promise.resolve(
          jsonResponse({
            heritageTypes: [],
            languages: [],
            regions: [],
            tags: [],
          }),
        );
      }
      if (url.includes('/search/suggestions')) {
        return Promise.resolve(jsonResponse({ titles: [], tags: [], regions: [], languages: [] }));
      }
      return Promise.resolve(jsonResponse(paginatedRecords([])));
    });
    renderExplore();

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText(/^search$/i), { target: { value: 'lantern' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('q=lantern'))).toBe(true),
    );
  });

  it('navigates to the next page', async () => {
    const fetchMock = stubFetch((url: string) => {
      if (url.includes('/discovery/facets')) {
        return Promise.resolve(
          jsonResponse({
            heritageTypes: [],
            languages: [],
            regions: [],
            tags: [],
          }),
        );
      }
      return Promise.resolve(
        jsonResponse(paginatedRecords([recordSummary()], { total: 20, totalPages: 2 })),
      );
    });
    renderExplore();

    await screen.findByRole('heading', { name: 'Demo Record' });
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('page=2'))).toBe(true),
    );
  });

  it('honors the page from the URL and disables next on the last page', async () => {
    const fetchMock = stubFetch((url: string) => {
      if (url.includes('/discovery/facets')) {
        return Promise.resolve(
          jsonResponse({
            heritageTypes: [],
            languages: [],
            regions: [],
            tags: [],
          }),
        );
      }
      return Promise.resolve(
        jsonResponse(paginatedRecords([recordSummary()], { page: 2, total: 20, totalPages: 2 })),
      );
    });
    renderExplore(['/explore?page=2']);

    await screen.findByRole('heading', { name: 'Demo Record' });
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('page=2'))).toBe(true);
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    expect(screen.getByText(/page 2 of 2/i)).toBeInTheDocument();
  });
});
