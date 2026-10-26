import { useEffect, useRef, useState } from 'react';
import { apiGet } from '../../lib/api';

export interface SuggestionResult {
  titles: string[];
  tags: string[];
  regions: string[];
  languages: string[];
}

const EMPTY_SUGGESTIONS: SuggestionResult = {
  titles: [],
  tags: [],
  regions: [],
  languages: [],
};

/**
 * Debounced search suggestions fetched through the shared API helper, so
 * requests get the same timeout, friendly-failure, and short public cache
 * behaviour as every other read.
 */
export function useSearchSuggestions(query: string, delay = 300) {
  const [suggestions, setSuggestions] = useState<SuggestionResult>(EMPTY_SUGGESTIONS);
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions(EMPTY_SUGGESTIONS);
      setLoading(false);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: trimmed });
        const data = await apiGet<SuggestionResult>(
          `/search/suggestions?${params.toString()}`,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setSuggestions({
          titles: Array.isArray(data.titles) ? data.titles : [],
          tags: Array.isArray(data.tags) ? data.tags : [],
          regions: Array.isArray(data.regions) ? data.regions : [],
          languages: Array.isArray(data.languages) ? data.languages : [],
        });
      } catch {
        // An aborted lookup is expected while typing. A real failure simply
        // leaves suggestions empty; the search itself still works.
        if (!controller.signal.aborted) setSuggestions(EMPTY_SUGGESTIONS);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, [query, delay]);

  return { suggestions, loading };
}
