import { useEffect, useState } from 'react';

/**
 * A quiet reading-progress hairline. It gives long-form records a sense of
 * place without adding another floating interface element.
 */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const root = document.documentElement;
      const scrollable = root.scrollHeight - window.innerHeight;
      const next = scrollable <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / scrollable));
      setProgress(next);
    };

    const onScroll = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[65] h-[3px] bg-forest-deep/10"
      aria-hidden="true"
    >
      <div
        className="reading-progress h-full bg-gradient-to-r from-terracotta via-gold to-gold-light"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
