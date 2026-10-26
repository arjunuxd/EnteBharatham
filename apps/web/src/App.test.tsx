import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';
import { AppRoutes } from './routes';

// App wraps routes in BrowserRouter, which needs a DOM history environment.
// For route rendering tests we use MemoryRouter via AppRoutes directly.

describe('App', () => {
  it('renders the home page with the project tagline', () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(
      screen.getByRole('heading', { name: /India's Living Heritage Archive/i }),
    ).toBeInTheDocument();
  });

  it('renders the about page', () => {
    window.history.pushState({}, '', '/about');
    render(<App />);
    expect(screen.getByRole('heading', { name: /About EnteBharatham/i })).toBeInTheDocument();
  });

  it('renders the 404 page for unknown routes', () => {
    window.history.pushState({}, '', '/nope');
    render(<App />);
    expect(screen.getByRole('heading', { name: /Page not found/i })).toBeInTheDocument();
  });

  it('includes a skip-to-content link for keyboard users', () => {
    window.history.pushState({}, '', '/');
    render(
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument();
  });
});
