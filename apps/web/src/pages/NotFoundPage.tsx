import { ArrowLeft, Compass, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { HeritageArtwork } from '../components/HeritageArtwork';

export function NotFoundPage() {
  return (
    <div className="container-page py-16 sm:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="max-w-xl">
          <p className="eyebrow flex items-center gap-3">
            <span className="h-px w-8 bg-terracotta" aria-hidden="true" />
            404 — Page not found
          </p>
          <h1 className="display-hero mt-5">Page not found</h1>
          <p className="body-lede mt-5">
            The page you are looking for does not exist, or it has moved. The archive itself is
            still here.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link to="/explore" className="btn-primary">
              <Search className="h-4 w-4" aria-hidden="true" />
              Explore the archive
            </Link>
            <Link to="/" className="btn-secondary">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to home
            </Link>
          </div>
          <div className="mt-10 border-t border-line pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-earth-ink">
              Looking for something specific?
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <li>
                <Link to="/explore/regions" className="link-underline">
                  Browse by region
                </Link>
              </li>
              <li>
                <Link to="/explore/languages" className="link-underline">
                  Browse by language
                </Link>
              </li>
              <li>
                <Link to="/about" className="link-underline">
                  About the project
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <div className="arch-top overflow-hidden border border-line-strong bg-paper p-2 shadow-lift">
            <HeritageArtwork
              seed="not-found-lamp"
              heritageType="folk_story"
              aspect="square"
              className="arch-top"
              label="Original archive illustration: a lamp beside an open doorway"
              decorative={false}
            />
            <div className="flex items-center justify-between px-2 pb-1 pt-3">
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-earth-ink">
                Another way in
              </p>
              <Compass className="h-4 w-4 text-forest" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
