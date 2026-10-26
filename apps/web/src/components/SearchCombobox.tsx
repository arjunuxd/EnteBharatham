import { useEffect, useId, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { SuggestionResult } from './search/useSearchSuggestions';

export interface SearchSuggestion {
  type: 'title' | 'tag' | 'language' | 'region';
  value: string;
}

const TYPE_LABELS: Record<SearchSuggestion['type'], string> = {
  title: 'Title',
  tag: 'Tag',
  language: 'Language',
  region: 'Region',
};

function flatten(suggestions: SuggestionResult): SearchSuggestion[] {
  return [
    ...suggestions.titles.slice(0, 3).map((value) => ({ type: 'title' as const, value })),
    ...suggestions.tags.slice(0, 3).map((value) => ({ type: 'tag' as const, value })),
    ...suggestions.languages.slice(0, 2).map((value) => ({ type: 'language' as const, value })),
    ...suggestions.regions.slice(0, 2).map((value) => ({ type: 'region' as const, value })),
  ];
}

/**
 * Accessible search combobox for the archive.
 *
 * Implements the ARIA combobox pattern: arrow keys move the active option,
 * Enter selects it, Escape closes the list, and the input stays the single
 * source of truth for the typed query.
 */
export function SearchCombobox({
  value,
  onChange,
  onSubmit,
  onSelect,
  suggestions,
  loading = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSelect: (suggestion: SearchSuggestion) => void;
  suggestions: SuggestionResult;
  loading?: boolean;
}) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (blurTimer.current !== null) clearTimeout(blurTimer.current);
    },
    [],
  );

  const items = flatten(suggestions);
  const showList = open && value.trim().length >= 2;
  const activeId =
    activeIndex >= 0 && items[activeIndex] !== undefined
      ? `${listboxId}-option-${activeIndex}`
      : undefined;

  const closeSoon = () => {
    if (blurTimer.current !== null) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => {
      setOpen(false);
      setActiveIndex(-1);
    }, 120);
  };

  const pick = (item: SearchSuggestion) => {
    setOpen(false);
    setActiveIndex(-1);
    onSelect(item);
  };

  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor={id} className="field-label">
        Search
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-earth-ink"
          aria-hidden="true"
        />
        <input
          id={id}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? activeId : undefined}
          autoComplete="off"
          value={value}
          placeholder="Search titles, summaries, places, languages…"
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={closeSoon}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) => (items.length === 0 ? -1 : (current + 1) % items.length));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) =>
                items.length === 0 ? -1 : (current - 1 + items.length) % items.length,
              );
            } else if (event.key === 'Escape') {
              setOpen(false);
              setActiveIndex(-1);
            } else if (event.key === 'Enter') {
              const active = items[activeIndex];
              if (showList && active !== undefined) {
                event.preventDefault();
                pick(active);
              } else {
                event.preventDefault();
                setOpen(false);
                onSubmit();
              }
            }
          }}
          className="input py-3.5 pl-10 pr-12 text-base"
        />
        {value !== '' && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-earth-ink transition-colors hover:bg-black/[0.045] hover:text-ink"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {showList && (loading || items.length > 0) && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 flex max-h-[min(20rem,58dvh)] flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-panel">
          {loading && items.length === 0 && (
            <p className="px-4 py-3 text-xs text-earth-ink" aria-live="polite">
              Looking for suggestions…
            </p>
          )}
          {items.length > 0 && (
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Search suggestions"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
            >
              {items.map((item, index) => (
                <li
                  key={`${item.type}-${item.value}`}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex cursor-pointer items-baseline justify-between gap-4 px-4 py-2.5 text-sm ${
                    index === activeIndex
                      ? 'bg-forest-soft text-forest-deep'
                      : 'text-ink hover:bg-cream'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{item.value}</span>
                  <span className="shrink-0 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-earth-ink">
                    {TYPE_LABELS[item.type]}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="shrink-0 border-t border-line bg-cream/70 px-4 py-2 text-[0.6875rem] text-earth-ink">
            Use ↑ ↓ to move through suggestions, Enter to choose.
          </p>
        </div>
      )}
    </div>
  );
}
