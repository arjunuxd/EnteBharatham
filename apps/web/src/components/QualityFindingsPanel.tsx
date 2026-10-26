import type { QualityFinding, QualityReport } from '@entebharatham/shared';
import { ClipboardCheck } from 'lucide-react';

/**
 * Deterministic quality findings panel.
 *
 * The panel shows *what* is missing and *what to do about it*. It never
 * shows a score: a number that ranks a story's authenticity or cultural value
 * would be an editorial judgement the platform is not entitled to make.
 */

const SEVERITY_STYLES: Record<QualityFinding['severity'], string> = {
  blocker: 'border-danger/25 bg-danger-soft text-ink',
  warning: 'border-warning/25 bg-warning-soft text-ink',
  info: 'border-line-strong bg-cream text-ink',
};

const SEVERITY_LABELS: Record<QualityFinding['severity'], string> = {
  blocker: 'Must fix',
  warning: 'Recommended',
  info: 'For your information',
};

export interface QualityFindingsPanelProps {
  report: QualityReport | null;
  loading?: boolean;
  title?: string;
  emptyMessage?: string;
}

export function QualityFindingsPanel({
  report,
  loading = false,
  title = 'Quality checks',
  emptyMessage = 'No issues found by the automated checks.',
}: QualityFindingsPanelProps) {
  if (loading) {
    return (
      <section aria-labelledby="quality-heading" className="card-paper p-5">
        <h2 id="quality-heading" className="font-display text-xl text-ink">
          {title}
        </h2>
        <p role="status" className="mt-2 text-sm text-earth-ink">
          Running checks…
        </p>
      </section>
    );
  }

  if (report === null) {
    return (
      <section aria-labelledby="quality-heading" className="card-paper p-5">
        <h2 id="quality-heading" className="font-display text-xl text-ink">
          {title}
        </h2>
        <p className="mt-2 text-sm text-earth-ink">The quality report could not be loaded.</p>
      </section>
    );
  }

  const ordered: QualityFinding['severity'][] = ['blocker', 'warning', 'info'];
  const findings = ordered.flatMap((severity) =>
    (report.findings ?? []).filter((finding) => finding.severity === severity),
  );

  return (
    <section aria-labelledby="quality-heading" className="card-paper p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cream text-forest">
          <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="quality-heading" className="font-display text-xl text-ink">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-earth-ink">
            These checks look at whether the record is complete and understandable. They say nothing
            about how important or authentic the material is.
          </p>
        </div>
      </div>

      <p className="mt-4 border-y border-line py-3 text-sm">
        <span className="font-medium text-danger">{report.blockerCount ?? 0} to fix</span>
        {' · '}
        <span className="font-medium text-warning">{report.warningCount ?? 0} recommended</span>
        {' · '}
        <span className="font-medium text-earth-ink">{report.infoCount ?? 0} notes</span>
      </p>

      {findings.length === 0 ? (
        <p className="mt-4 rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-sm text-success">
          {emptyMessage}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {findings.map((finding, index) => (
            <li
              key={`${finding.code}-${finding.field ?? 'record'}-${index}`}
              className={`rounded-lg border px-4 py-3 text-sm ${SEVERITY_STYLES[finding.severity]}`}
            >
              <p className="font-medium text-ink">
                <span className="sr-only">{SEVERITY_LABELS[finding.severity]}: </span>
                {finding.message}
              </p>
              <p className="mt-1 text-earth-ink">{finding.guidance}</p>
              {finding.field !== undefined && (
                <p className="mt-1.5 text-[0.6875rem] uppercase tracking-[0.1em] text-earth-ink">
                  Field: {finding.field}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
