import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, publicRecord } from '../test/apiMocks';
import { HeritageRecordPage } from './HeritageRecordPage';

function renderDetail(slug = 'demo-record') {
  return render(
    <MemoryRouter initialEntries={[`/heritage/${slug}`]}>
      <Routes>
        <Route path="heritage/:slug" element={<HeritageRecordPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function stubFetch(impl: () => Promise<unknown>) {
  const fetchMock = vi.fn(() => impl());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('HeritageRecordPage', () => {
  it('shows a loading state while the request is pending', () => {
    stubFetch(() => new Promise(() => {}));
    renderDetail();
    expect(screen.getByRole('status')).toHaveTextContent(/loading heritage record/i);
  });

  it('renders a public record with attribution and rights sections', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(publicRecord())));
    renderDetail('demo-record');

    expect(await screen.findByRole('heading', { name: 'Demo Record' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/heritage/demo-record'),
      expect.anything(),
    );
    expect(screen.getByText('Demo content')).toBeInTheDocument();
    expect(screen.getByText(/Demo Author \(fictional\) — contributor/)).toBeInTheDocument();
    expect(screen.getByText('Fictional source description')).toBeInTheDocument();
    expect(screen.getByText('Consent and rights')).toBeInTheDocument();
    expect(screen.getByText('documented')).toBeInTheDocument();
    expect(screen.queryByText(/restrictions/i)).not.toBeInTheDocument();
  });

  it('renders Malayalam content and never injects untrusted HTML', async () => {
    const malayalam = 'വിളക്കൂരിലെ പാട്ട്';
    const dangerous = '<script>alert("xss")</script>';
    stubFetch(() =>
      Promise.resolve(jsonResponse(publicRecord({ title: malayalam, content: dangerous }))),
    );
    renderDetail();

    expect(await screen.findByRole('heading', { name: malayalam })).toBeInTheDocument();
    expect(screen.getByText(dangerous)).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });

  it('shows a non-disclosing not-found state for missing or restricted records', async () => {
    stubFetch(() =>
      Promise.resolve(
        jsonResponse({ error: { message: 'Heritage record not found', code: 'NOT_FOUND' } }, 404),
      ),
    );
    renderDetail('restricted-or-missing');

    expect(await screen.findByRole('heading', { name: /record not found/i })).toBeInTheDocument();
    expect(screen.getByText(/may not be publicly available/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to explore/i })).toBeInTheDocument();
  });

  it('shows an error state and recovers after retry', async () => {
    let attempt = 0;
    stubFetch(() => {
      attempt += 1;
      return attempt === 1
        ? Promise.reject(new Error('network down'))
        : Promise.resolve(jsonResponse(publicRecord()));
    });

    renderDetail();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not load this heritage record/i);

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByRole('heading', { name: 'Demo Record' })).toBeInTheDocument();
  });
});
