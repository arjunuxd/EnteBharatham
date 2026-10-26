import { Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUp,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { BrandLockup } from '../components/Brand';
import { CommandPalette } from '../components/CommandPalette';
import { PwaPrompts } from '../components/PwaPrompts';
import { LoadingState } from '../components/ui/States';
import { useAuth } from '../context/AuthContext';

const PUBLIC_NAV = [
  { to: '/explore', label: 'Explore' },
  { to: '/explore/regions', label: 'Regions' },
  { to: '/explore/languages', label: 'Languages' },
  { to: '/contribute', label: 'Contribute' },
  { to: '/about', label: 'About' },
];

function navClass({ isActive }: { isActive: boolean }): string {
  return ['nav-link', isActive ? 'nav-link-active' : ''].filter(Boolean).join(' ');
}

function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? '');
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
  return `${first}${last ?? ''}`.toUpperCase();
}

/** Desktop account menu. Keyboard users can open it, tab through it, and Esc. */
function AccountMenu() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleLogout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      setOpen(false);
      navigate('/', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  if (status === 'loading') {
    return (
      <span
        className="hidden items-center gap-2 text-xs text-earth-ink md:inline-flex"
        role="status"
      >
        <span
          className="h-2 w-2 animate-pulse rounded-full bg-earth motion-reduce:animate-none"
          aria-hidden="true"
        />
        Checking session…
      </span>
    );
  }

  if (status === 'anonymous' || user === null) {
    return (
      <div className="hidden items-center gap-2 md:flex">
        <NavLink to="/login" className="btn-ghost btn-sm">
          Sign in
        </NavLink>
        <Link to="/register" className="btn-primary btn-sm btn-arrow hidden xl:inline-flex">
          Create account
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const isModerator = user.role === 'moderator' || user.role === 'admin';

  return (
    <div ref={wrapperRef} className="relative hidden md:block">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="account-menu"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line-strong/70 bg-paper/60 py-1 pl-1 pr-2.5 text-left transition-all duration-200 hover:border-forest/30 hover:bg-paper hover:shadow-xs"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-[0.6875rem] font-semibold text-ivory ring-2 ring-gold/35 ring-offset-2 ring-offset-ivory"
          aria-hidden="true"
        >
          {initials(user.displayName)}
        </span>
        <span className="max-w-[9rem] truncate text-xs font-semibold text-ink">
          {user.displayName}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-earth-ink transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id="account-menu"
          aria-label="Account"
          className="absolute right-0 z-50 mt-2.5 w-64 overflow-hidden rounded-xl border border-line bg-paper shadow-panel motion-safe:animate-rise"
        >
          <div className="border-b border-line bg-cream/60 px-4 py-3.5">
            <p className="truncate text-sm font-semibold text-ink">{user.displayName}</p>
            <p className="mt-0.5 truncate text-xs text-earth-ink">{user.email}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-paper/80 px-2 py-0.5 text-[0.5625rem] font-bold uppercase tracking-[0.16em] text-terracotta-deep">
              <span className="status-dot" aria-hidden="true" />
              {user.role} account
            </p>
          </div>
          <div className="p-1.5">
            <MenuLink to="/dashboard" icon={LayoutDashboard} label="Your contributions" />
            <MenuLink to={`/profiles/${user.id}`} icon={UserRound} label="Public profile" />
            {isModerator && (
              <>
                <div className="mx-3 my-1.5 border-t border-line/80" role="separator" />
                <MenuLink to="/moderation" icon={ShieldCheck} label="Review queue" />
                <MenuLink to="/moderation/governance" icon={ShieldCheck} label="Governance" />
                <MenuLink to="/moderation/audit" icon={ShieldCheck} label="Audit log" />
              </>
            )}
          </div>
          <form
            onSubmit={(event) => void handleLogout(event)}
            className="border-t border-line p-1.5"
          >
            <button
              type="submit"
              disabled={loggingOut}
              className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-earth-ink transition-colors hover:bg-cream hover:text-ink disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-earth-ink transition-colors hover:bg-cream hover:text-ink"
    >
      <Icon className="h-4 w-4 text-earth-ink" aria-hidden="true" />
      {label}
    </Link>
  );
}

/** Mobile navigation panel, with focus moved to the first destination. */
function MobileMenu({ onNavigate, onSearch }: { onNavigate: () => void; onSearch: () => void }) {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const first = panelRef.current?.querySelector<HTMLElement>('a, button');
    first?.focus();
  }, []);

  const handleLogout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      onNavigate();
      navigate('/', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div
      ref={panelRef}
      id="mobile-navigation"
      className="max-h-[calc(100dvh-4.75rem)] overflow-y-auto overscroll-contain border-t border-line bg-paper/95 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl xl:hidden"
    >
      <nav aria-label="Mobile navigation" className="container-page py-4">
        <button
          type="button"
          onClick={onSearch}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-line-strong/80 bg-cream/70 px-4 text-left text-sm font-medium text-earth-ink transition-colors hover:border-forest/30 hover:text-forest-deep"
        >
          <Search className="h-4 w-4 text-forest" aria-hidden="true" />
          Search the archive
          <span className="ml-auto rounded-full bg-paper px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-earth-ink">
            Find
          </span>
        </button>

        <ul className="mt-4 grid gap-0.5">
          {PUBLIC_NAV.map((item, index) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/explore'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group flex min-h-[3.25rem] items-center gap-3 rounded-xl px-3 text-[1.0625rem] font-medium transition-colors ${
                    isActive ? 'bg-forest-soft text-forest-deep' : 'text-ink hover:bg-cream'
                  }`
                }
              >
                <span
                  className="font-display text-[0.6875rem] text-terracotta/80"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="flex-1">{item.label}</span>
                <ArrowRight
                  className="h-4 w-4 text-earth-ink transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-xl border border-forest/15 bg-forest-soft/60 p-4">
          <p className="micro-label flex items-center gap-2 text-forest">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />A living archive
          </p>
          <p className="mt-2 text-xs leading-5 text-earth-ink">
            Recorded with consent. Credited to the people who keep the tradition alive.
          </p>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          {status === 'loading' && <p className="text-sm text-earth-ink">Checking session…</p>}
          {status !== 'loading' && user === null && (
            <div className="grid gap-2">
              <Link to="/login" onClick={onNavigate} className="btn-secondary w-full">
                Sign in
              </Link>
              <Link to="/register" onClick={onNavigate} className="btn-primary w-full">
                Create account
              </Link>
            </div>
          )}
          {user !== null && (
            <div className="space-y-2">
              <p className="px-1 text-xs text-earth-ink">
                Signed in as <span className="font-semibold text-ink">{user.displayName}</span>
              </p>
              <Link
                to="/dashboard"
                onClick={onNavigate}
                className="btn-secondary w-full justify-start"
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                Your contributions
              </Link>
              {(user.role === 'moderator' || user.role === 'admin') && (
                <>
                  <Link
                    to="/moderation"
                    onClick={onNavigate}
                    className="btn-secondary w-full justify-start"
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Review queue
                  </Link>
                  <Link
                    to="/moderation/governance"
                    onClick={onNavigate}
                    className="btn-secondary w-full justify-start"
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Governance
                  </Link>
                  <Link
                    to="/moderation/audit"
                    onClick={onNavigate}
                    className="btn-secondary w-full justify-start"
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Audit log
                  </Link>
                </>
              )}
              <form onSubmit={(event) => void handleLogout(event)}>
                <button
                  type="submit"
                  disabled={loggingOut}
                  className="btn-ghost w-full justify-start"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {loggingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </form>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const isMac = isMacPlatform();

  useEffect(() => {
    setMobileOpen(false);
    setPaletteOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setMobileOpen(false);
        setPaletteOpen((current) => !current);
        return;
      }
      if (event.key === '/' && !modifier && !isTypingTarget(event.target)) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    // Route changes should start at the top of the new page. Avoids calling
    // window.scrollTo, which jsdom does not implement during tests.
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  return (
    <div id="top" className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header
        className={`sticky top-0 z-40 border-b transition-all duration-300 ${
          scrolled
            ? 'border-line/80 bg-ivory/85 shadow-[0_18px_40px_-34px_rgb(30_27_75_/_0.5)] backdrop-blur-xl backdrop-saturate-150'
            : 'border-transparent bg-ivory/75 backdrop-blur-md'
        }`}
      >
        <div
          className={`container-page flex items-center justify-between gap-3 transition-all duration-300 sm:gap-4 ${
            scrolled ? 'min-h-[4.25rem]' : 'min-h-[4.75rem] sm:min-h-[5.25rem]'
          }`}
        >
          <BrandLockup
            markClassName={scrolled ? 'h-8 w-8' : 'h-9 w-9'}
            taglineClassName="hidden lg:block"
            className="min-w-0 shrink-0 transition-opacity hover:opacity-100"
          />

          <nav aria-label="Main navigation" className="hidden self-center xl:block">
            <ul className="flex items-center gap-0.5">
              {PUBLIC_NAV.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.to === '/explore'} className={navClass}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setPaletteOpen(true);
              }}
              className="search-trigger hidden xl:inline-flex"
              aria-label="Search the archive"
              aria-haspopup="dialog"
              title={isMac ? 'Search the archive (⌘K)' : 'Search the archive (Ctrl+K)'}
            >
              <Search className="h-3.5 w-3.5 text-forest" aria-hidden="true" />
              <span className="text-earth-ink">Search the archive</span>
              <kbd className="kbd ml-1.5">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setPaletteOpen(true);
              }}
              className="search-trigger hidden md:inline-flex xl:hidden"
              aria-label="Search the archive"
              aria-haspopup="dialog"
              title={isMac ? 'Search the archive (⌘K)' : 'Search the archive (Ctrl+K)'}
            >
              <Search className="h-4 w-4 text-forest" aria-hidden="true" />
              <span className="text-earth-ink">Search</span>
              <kbd className="kbd">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setPaletteOpen(true);
              }}
              className="btn-icon md:hidden"
              aria-label="Search the archive"
              aria-haspopup="dialog"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="hidden h-5 w-px bg-line md:block" aria-hidden="true" />
            <AccountMenu />
            <button
              ref={menuButtonRef}
              type="button"
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              onClick={() => setMobileOpen((current) => !current)}
              className={`btn-icon border xl:hidden ${
                mobileOpen ? 'border-forest/30 bg-forest-soft' : 'border-line/80'
              }`}
            >
              {mobileOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <MobileMenu
            onNavigate={() => setMobileOpen(false)}
            onSearch={() => {
              setMobileOpen(false);
              setPaletteOpen(true);
            }}
          />
        )}
      </header>

      <main id="main-content" className="flex-1">
        <Suspense
          fallback={
            <div className="container-page py-16">
              <LoadingState>Loading page…</LoadingState>
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      <footer className="relative overflow-hidden bg-midnight text-ivory">
        <div
          className="h-px bg-gradient-to-r from-forest via-terracotta to-gold"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-24 top-10 h-[28rem] w-[28rem] rounded-full border border-ivory/[0.06]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 left-1/3 h-[24rem] w-[24rem] rounded-full bg-forest/25 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-24 top-1/3 h-64 w-64 rounded-full bg-terracotta/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="container-page relative py-14 sm:py-18 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[1.02fr_1.28fr] lg:gap-20">
            <div className="max-w-md">
              <BrandLockup tone="light" markClassName="h-10 w-10" />
              <p className="mt-6 text-sm leading-7 text-ivory/65">
                An independent, personal archive of India&apos;s living heritage — stories, songs,
                skills, and memories recorded with consent and credited to the people who keep them
                alive.
              </p>

              <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-ivory/15 bg-ivory/[0.06] px-3 py-1.5 text-[0.625rem] font-bold uppercase tracking-[0.16em] text-ivory/70">
                <span className="status-dot text-gold" aria-hidden="true" />
                Independent &middot; Consent-led
              </p>

              <p className="mt-7 font-display text-[1.8rem] leading-[1.12] tracking-[-0.025em] text-ivory/90">
                Every story matters.
                <br />
                <span className="italic text-ivory/60">Every tradition lives on.</span>
              </p>
              <p className="mt-4 font-display text-base text-ivory/65" lang="ml">
                ഓരോ കഥയും പ്രധാനമാണ്.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
              <FooterColumn title="The archive">
                <FooterLink to="/explore">Explore records</FooterLink>
                <FooterLink to="/explore/regions">By region</FooterLink>
                <FooterLink to="/explore/languages">By language</FooterLink>
                <FooterLink to="/contribute">Contribute a story</FooterLink>
              </FooterColumn>

              <FooterColumn title="Taking part">
                <FooterLink to="/dashboard">Your contributions</FooterLink>
                <FooterLink to="/dashboard/drafts/new">Start a draft</FooterLink>
                <FooterLink to="/login">Sign in</FooterLink>
                <FooterLink to="/register">Create an account</FooterLink>
              </FooterColumn>

              <FooterColumn title="The project" className="col-span-2 sm:col-span-1">
                <FooterLink to="/about">About the archive</FooterLink>
                <FooterLink to="/about#principles">Principles</FooterLink>
                <FooterLink to="/about#status">Project status</FooterLink>
                <FooterLink to="/contribute">Contributor guide</FooterLink>
              </FooterColumn>
            </div>
          </div>

          <div className="mt-14 flex flex-col gap-7 border-t border-ivory/10 pt-7 text-xs leading-5 text-ivory/55 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-1.5">
              <p>
                &copy; {new Date().getFullYear()} EnteBharatham. A personal, independent archive
                project, kept with care.
              </p>
              <p>
                Records marked <span className="text-ivory/75">“Fictional demo record”</span> are
                development fixtures, not real traditions.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-3">
              <p className="text-ivory/50">
                Kerala first, and India&apos;s many languages over time.
              </p>
              <a
                href="#top"
                className="group inline-flex min-h-10 items-center gap-1.5 font-semibold text-ivory/75 transition-colors hover:text-ivory"
              >
                Back to top
                <ArrowUp
                  className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </a>
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute -bottom-24 -right-8 hidden select-none lg:block"
          aria-hidden="true"
        >
          <span className="font-display text-[10rem] leading-none tracking-[-0.06em] text-ivory/[0.035]">
            EnteBharatham
          </span>
        </div>
      </footer>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <PwaPrompts />
    </div>
  );
}

function FooterColumn({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="text-[0.625rem] font-bold uppercase tracking-[0.2em] text-gold-light">
        {title}
      </h2>
      <ul className="mt-4 space-y-1.5">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        className="link-slide inline-flex min-h-9 items-center text-sm text-ivory/60 transition-colors hover:text-ivory"
      >
        {children}
      </Link>
    </li>
  );
}
