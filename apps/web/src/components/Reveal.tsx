import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Reveals content as it enters the viewport. The archive should feel alive,
 * but never at the expense of legibility: content is only hidden while it is
 * outside the viewport, and reduced-motion users see everything immediately.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(delay = 0) {
  const ref = useRef<T>(null);
  const canAnimate =
    typeof window !== 'undefined' &&
    typeof IntersectionObserver !== 'undefined' &&
    !prefersReducedMotion();
  const [armed] = useState(canAnimate);
  const [visible, setVisible] = useState(!canAnimate);

  useEffect(() => {
    if (!armed) return;
    const node = ref.current;
    if (node === null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [armed]);

  const className = ['reveal', armed ? 'reveal-armed' : '', visible ? 'reveal-visible' : '']
    .filter(Boolean)
    .join(' ');

  return {
    ref,
    className,
    style: delay > 0 ? ({ transitionDelay: `${delay}ms` } as CSSProperties) : undefined,
  };
}

/** Convenience wrapper for blocks that do not already expose a ref. */
export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reveal = useReveal<HTMLDivElement>(delay);
  return (
    <div
      ref={reveal.ref}
      className={`${reveal.className} ${className}`.trim()}
      style={reveal.style}
    >
      {children}
    </div>
  );
}
