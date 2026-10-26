import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpRight,
  Compass,
  CornerDownLeft,
  Info,
  Languages,
  MapPin,
  PenLine,
  Search,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HERITAGE_TYPE_OPTIONS } from '@entebharatham/shared';
import { useSearchSuggestions } from './search/useSearchSuggestions';

type SuggestionType = 'title' | 'tag' | 'language' | 'region';

interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  icon: typeof Search;
  to: string;
  query?: string;
}

const QUICK_LINKS: PaletteItem[] = [
  {
    id: 'explore',
    label: 'Explore the archive',
    hint: 'All published records',
    icon: Compass,
    to: '/explore',
  },
  {
    id: 'regions',
    label: 'Browse by region',
    hint: 'Places represented',
    icon: MapPin,
    to: '/explore/regions',
  },
  {
    id: 'languages',
    label: 'Browse by language',
    hint: 'Languages represented',
    icon: Languages,
    to: '/explore/languages',
  },
  {
    id: 'contribute',
    label: 'Contribute a story',
    hint: 'Prepare and share a record',
    icon: PenLine,
    to: '/contribute',
  },
  {
    id: 'about',
    label: 'About the project',
    hint: 'Principles and status',
    icon: Info,
    to: '/about',
  },
];

const MAX_ITEMS = 9;

function suggestionItems(
  query: string,
  suggestions: ReturnType<typeof useSearchSuggestions>['suggestions'],
) {
  const items: PaletteItem[] = [];
  const push = (type: SuggestionType, value: string) => {
    const paths: Record<SuggestionType, string> = {
      title: `/explore?q=${encodeURIComponent(value)}`,
      tag: `/explore?tags=${encodeURIComponent(value)}`,
      language: `/explore?language=${encodeURIComponent(value)}`,
      region: `/explore?region=${encodeURIComponent(value)}`,
    };
    items.push({
      id: `${type}-${value}`,
      label: value,
      hint:
        type === 'title'
          ? 'Record title'
          : type === 'tag'
            ? 'Tag'
            : type === 'language'
              ? 'Language'
              : 'Region',
      icon:
        type === 'title'
          ? Search
          : type === 'tag'
            ? Compass
            : type === 'language'
              ? Languages
              : MapPin,
      to: paths[type],
      query,
    });
  };

  for (const value of suggestions.titles.slice(0, 3)) push('title', value);
  for (const value of suggestions.tags.slice(0, 3)) push('tag', value);
  for (const value of suggestions.languages.slice(0, 2)) push('language', value);
  for (const value of suggestions.regions.slice(0, 2)) push('region', value);
  return items.slice(0, MAX_ITEMS);
}

/**
 * Keyboard-first discovery for the archive. The palette is a single place to
 * search records or jump to a way of browsing, without interrupting reading.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const { suggestions, loading } = useSearchSuggestions(query, 180);

  const trimmed = query.trim();
  const items = useMemo(
    () => (trimmed.length >= 2 ? suggestionItems(trimmed, suggestions) : QUICK_LINKS),
    [trimmed, suggestions],
  );
  const activeItem = items[activeIndex];
  const activeId = activeItem !== undefined ? `${listId}-option-${activeIndex}` : undefined;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const root = document.getElementById('root');
    const previousAriaHidden = root?.getAttribute('aria-hidden') ?? null;
    const previousOverflow = document.body.style.overflow;
    root?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      if (root !== null) {
        if (previousAriaHidden === null) root.removeAttribute('aria-hidden');
        else root.setAttribute('aria-hidden', previousAriaHidden);
      }
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, items.length - 1)));
  }, [items.length]);

  const close = () => onClose();

  const choose = (item: PaletteItem) => {
    close();
    navigate(item.to);
  };

  const submit = () => {
    const target = trimmed.length >= 2 ? `/explore?q=${encodeURIComponent(trimmed)}` : '/explore';
    close();
    navigate(target);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (items.length > 0) setActiveIndex((current) => (current + 1) % items.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (items.length > 0) {
        setActiveIndex((current) => (current - 1 + items.length) % items.length);
      }
      return;
    }

    if (event.key === 'Tab') {
      const panel = panelRef.current;
      if (panel === null) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-3 pt-[8vh] sm:p-6 sm:pt-[10vh]">
      <button
        type="button"
        className="fixed inset-0 cursor-default bg-ink/45 backdrop-blur-sm motion-safe:animate-fade"
        onClick={close}
        aria-label="Close search"
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search the EnteBharatham archive"
        onKeyDown={onKeyDown}
        className="relative flex max-h-[min(86dvh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line/80 bg-paper shadow-panel motion-safe:animate-rise"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line/80 px-4 py-3 sm:px-5">
          <Search className="h-4 w-4 shrink-0 text-forest" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (activeItem !== undefined && trimmed.length >= 2) choose(activeItem);
                else submit();
              }
            }}
            placeholder="Search stories, songs, places, languages…"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-earth-ink/80 focus:outline-none"
            aria-label="Search the archive"
          />
          <kbd className="kbd hidden sm:inline-flex">Esc</kbd>
          <button
            type="button"
            onClick={close}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-earth-ink transition-colors hover:bg-forest-soft hover:text-forest"
            aria-label="Close search"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          <p className="px-3 py-2 text-[0.625rem] font-bold uppercase tracking-[0.18em] text-earth-ink">
            {trimmed.length >= 2 ? 'Matching the archive' : 'Go anywhere'}
          </p>

          {trimmed.length >= 2 && loading && items.length === 0 ? (
            <p className="px-3 py-6 text-sm text-earth-ink" aria-live="polite">
              Listening for matches…
            </p>
          ) : null}

          {trimmed.length >= 2 && !loading && items.length === 0 ? (
            <p className="px-3 py-6 text-sm leading-6 text-earth-ink">
              No suggestions yet. Press Enter to search the full archive for “{trimmed}”.
            </p>
          ) : null}

          {items.length > 0 && (
            <ul id={listId} role="listbox" aria-label="Search results">
              {items.map((item, index) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.id}
                    id={`${listId}-option-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    onClick={() => choose(item)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      index === activeIndex
                        ? 'bg-forest-soft/80 text-forest-deep'
                        : 'text-ink hover:bg-cream'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                        index === activeIndex
                          ? 'border-forest/20 bg-paper text-forest'
                          : 'border-line bg-cream/60 text-earth-ink'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{item.label}</span>
                      <span className="mt-0.5 block text-[0.6875rem] uppercase tracking-[0.12em] text-earth-ink">
                        {item.hint}
                      </span>
                    </span>
                    <ArrowUpRight
                      className={`h-4 w-4 shrink-0 transition-opacity ${
                        index === activeIndex ? 'opacity-70' : 'opacity-0'
                      }`}
                      aria-hidden="true"
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {trimmed.length < 2 && (
            <div className="mx-2 mt-1 border-t border-line/70 px-1 pb-1 pt-3">
              <p className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-earth-ink">
                Or begin with a form
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {HERITAGE_TYPE_OPTIONS.slice(0, 5).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      close();
                      navigate(`/explore?heritageType=${option.value}`);
                    }}
                    className="chip"
                  >
                    {option.labelMalayalam}
                    <span className="font-sans text-[0.625rem] font-medium text-earth-ink">
                      {option.label.split(' & ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line/80 bg-cream/60 px-4 py-2.5 text-[0.6875rem] text-earth-ink sm:px-5">
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="kbd">↑</kbd>
              <kbd className="kbd">↓</kbd>
              to move
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="kbd">↵</kbd>
              to open
            </span>
          </span>
          <button
            type="button"
            onClick={() => submit()}
            className="inline-flex items-center gap-1.5 font-semibold text-forest transition-colors hover:text-terracotta-deep"
          >
            Search everything
            <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
