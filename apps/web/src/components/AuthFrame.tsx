import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { BrandMark } from './Brand';

export interface AuthFrameProps {
  eyebrow: string;
  title: string;
  description: ReactNode;
  asideTitle: string;
  asideDescription?: ReactNode;
  asideItems: string[];
  asideFooter?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}

/**
 * Shared shell for the sign-in and registration screens.
 *
 * The form column stays focused and task-first; the midnight panel gives the
 * screen a sense of place on desktop without competing with the form.
 */
export function AuthFrame({
  eyebrow,
  title,
  description,
  asideTitle,
  asideDescription,
  asideItems,
  asideFooter,
  footer,
  children,
}: AuthFrameProps) {
  return (
    <div className="relative overflow-hidden border-b border-line bg-cream">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(46rem_36rem_at_92%_-8%,rgb(79_70_229_/_0.12),transparent_62%),radial-gradient(36rem_28rem_at_0%_104%,rgb(251_115_88_/_0.1),transparent_66%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-24 top-10 h-[24rem] w-[24rem] rounded-full border border-terracotta/10"
        aria-hidden="true"
      />

      <div className="container-page relative py-8 sm:py-12 lg:py-16">
        <div className="mx-auto w-full max-w-5xl">
          <div className="overflow-hidden rounded-2xl border border-line/80 bg-paper shadow-panel lg:grid lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] lg:rounded-[1.75rem]">
            <div className="p-6 sm:p-9 lg:p-10 xl:p-12">
              <div className="flex items-center gap-2.5">
                <BrandMark className="h-8 w-8 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-display text-[1.2rem] font-semibold leading-none tracking-[-0.03em] text-ink">
                    EnteBharatham
                  </span>
                  <span className="mt-1 block text-[0.5rem] font-semibold uppercase tracking-[0.16em] text-earth-ink">
                    India&apos;s Living Heritage Archive
                  </span>
                </span>
              </div>

              <p className="eyebrow mt-8 flex items-center gap-3">
                <span className="h-px w-7 bg-terracotta" aria-hidden="true" />
                {eyebrow}
              </p>
              <h1 className="mt-3 font-display text-[clamp(2.1rem,4vw,2.8rem)] leading-[1.02] tracking-[-0.035em] text-ink">
                {title}
              </h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-earth-ink">{description}</p>

              <div className="mt-7">{children}</div>
            </div>

            <aside
              className="relative hidden overflow-hidden bg-midnight p-10 text-ivory lg:flex lg:flex-col xl:p-12"
              aria-label="About contributing"
            >
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(34rem_28rem_at_88%_0%,rgb(79_70_229_/_0.48),transparent_62%),radial-gradient(26rem_24rem_at_0%_100%,rgb(251_115_88_/_0.2),transparent_66%)]"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-ivory/10"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full border border-ivory/[0.07]"
                aria-hidden="true"
              />

              <div className="relative flex flex-1 flex-col">
                <BrandMark tone="light" className="h-9 w-9" />

                <div className="mt-10">
                  <p className="text-[0.625rem] font-bold uppercase tracking-[0.2em] text-gold-light">
                    Why contribute
                  </p>
                  <p className="mt-3 font-display text-[1.8rem] leading-[1.2] tracking-[-0.025em]">
                    {asideTitle}
                  </p>
                  {asideDescription !== undefined && (
                    <p className="mt-4 text-sm leading-6 text-ivory/70">{asideDescription}</p>
                  )}
                </div>

                <ul className="mt-8 space-y-3">
                  {asideItems.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-sm leading-6 text-ivory/75"
                    >
                      <span
                        className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold"
                        aria-hidden="true"
                      >
                        <Check className="h-2.5 w-2.5" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>

                {asideFooter !== undefined && (
                  <div className="mt-auto border-t border-ivory/10 pt-6 text-xs leading-5 text-ivory/55">
                    {asideFooter}
                  </div>
                )}
              </div>
            </aside>
          </div>

          <p className="mt-5 text-center text-sm text-earth-ink">{footer}</p>
        </div>
      </div>
    </div>
  );
}
