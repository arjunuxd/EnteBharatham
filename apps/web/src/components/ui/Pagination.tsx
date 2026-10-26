import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Shared pagination. Both the visible page summary and the button names stay
 * stable because other surfaces and tests rely on them.
 */
export function Pagination({
  page,
  totalPages,
  total,
  onChange,
  label = 'Pagination',
}: {
  page: number;
  totalPages: number;
  total?: number;
  onChange: (page: number) => void;
  label?: string;
}) {
  const lastPage = Math.max(1, totalPages);

  return (
    <nav
      aria-label={label}
      className="flex flex-col items-stretch justify-between gap-3 border-t border-line pt-6 sm:flex-row sm:items-center"
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="btn-secondary btn-sm justify-center sm:justify-start"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Previous
      </button>

      <p className="order-first text-center text-sm text-earth-ink sm:order-none">
        Page {page} of {lastPage}
        {typeof total === 'number' && (
          <span className="text-earth-ink">
            {' '}
            · {total} {total === 1 ? 'record' : 'records'}
          </span>
        )}
      </p>

      <button
        type="button"
        onClick={() => onChange(Math.min(lastPage, page + 1))}
        disabled={page >= lastPage}
        className="btn-secondary btn-sm justify-center sm:justify-end"
      >
        Next
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
