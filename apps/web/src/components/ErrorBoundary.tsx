import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Last-resort boundary for unexpected rendering failures. It never shows a
 * stack trace, component name, or provider message — only a plain-language
 * recovery screen with a retry and a safe way back to the archive.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep diagnostics in development only; they are never rendered to users.
    if (import.meta.env.DEV) {
      console.error('Unhandled interface error', error, info.componentStack);
    }
  }

  private retry = (): void => {
    this.setState({ failed: false });
  };

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="container-page py-16">
        <div
          role="alert"
          className="mx-auto max-w-xl rounded-xl border border-line/80 bg-paper/80 p-6 shadow-card"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-display text-2xl text-ink">This page ran into a problem</h1>
          <p className="mt-3 text-sm leading-6 text-earth-ink">
            Nothing you saved has been lost. Try loading the page again, or return to the archive
            home.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={this.retry} className="btn-primary btn-sm">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
            <a href="/" className="btn-secondary btn-sm">
              Back to home
            </a>
          </div>
        </div>
      </main>
    );
  }
}
