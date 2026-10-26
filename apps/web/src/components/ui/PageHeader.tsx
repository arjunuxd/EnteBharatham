import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Array<{ label: string; to?: string }>;
  children?: ReactNode;
  className?: string;
  /** `dark` is used on forest or terracotta bands. */
  tone?: 'light' | 'dark';
  /** Set false when the surrounding band already draws the closing rule. */
  border?: boolean;
}

/** The standard editorial page opening used across the archive. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  breadcrumbs,
  children,
  className = '',
  tone = 'light',
  border = true,
}: PageHeaderProps) {
  const dark = tone === 'dark';

  return (
    <header
      className={`pb-10 ${border ? 'border-b' : ''} ${dark ? 'border-ivory/15' : 'border-line'} ${className}`}
    >
      {breadcrumbs !== undefined && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-7">
          <ol
            className={`flex flex-wrap items-center gap-1.5 text-xs ${
              dark ? 'text-ivory/55' : 'text-earth-ink'
            }`}
          >
            {breadcrumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                {index > 0 && (
                  <ChevronRight
                    className={`h-3 w-3 ${dark ? 'text-ivory/25' : 'text-earth-ink'}`}
                    aria-hidden="true"
                  />
                )}
                {crumb.to !== undefined ? (
                  <Link
                    to={crumb.to}
                    className={
                      dark
                        ? 'font-medium text-ivory/70 transition-colors hover:text-ivory'
                        : 'link-quiet'
                    }
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className={dark ? 'text-ivory/60' : undefined}>
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-col gap-7 md:flex-row md:items-end md:justify-between md:gap-12">
        <div className="min-w-0 max-w-3xl">
          {eyebrow !== undefined && (
            <p className={`eyebrow mb-5 flex items-center gap-3 ${dark ? 'text-gold' : ''}`}>
              <span
                className={`h-px w-7 ${dark ? 'bg-gold' : 'bg-terracotta'}`}
                aria-hidden="true"
              />
              {eyebrow}
            </p>
          )}
          <h1 className={`display-title ${dark ? 'text-ivory' : 'text-ink'}`}>{title}</h1>
          {description !== undefined && (
            <div
              className={`body-lede mt-5 max-w-2xl ${dark ? 'text-ivory/70' : 'text-earth-ink'}`}
            >
              {description}
            </div>
          )}
        </div>
        {actions !== undefined && (
          <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
        )}
      </div>

      {children !== undefined && <div className="mt-7">{children}</div>}
    </header>
  );
}
