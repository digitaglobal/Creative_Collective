import { PlatformTour } from "@/components/admin-walkthrough";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/supabase";
import { useCatalog } from "@/hooks/use-catalog";
import { Link } from "@tanstack/react-router";
import { LogOut, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DemoBanner } from "@/components/demo-banner";
import { VENUE_TIMEZONE_LABEL, brands } from "@/data/catalog";

function HomeBrand({ light = false }: { light?: boolean }) {
  return (
    <span className={light ? "psd-brand-mark psd-brand-mark-light" : "psd-brand-mark"}>
      <img src="/images/home/brand-symbol.png" alt="" aria-hidden="true" />
      <span>The Creative Collective</span>
    </span>
  );
}

export function SiteHeader({ home = false }: { home?: boolean }) {
  const auth = useAuth();
  const catalog = useCatalog();
  const availableBrands = catalog.data?.brands.length ? catalog.data.brands : brands;
  const liveBrands = home
    ? [...availableBrands].sort(
        (a, b) => Number(b.slug === "studio-d") - Number(a.slug === "studio-d"),
      )
    : availableBrands;
  return (
    <header
      className={
        home
          ? "psd-header border-b border-border"
          : "sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur"
      }
    >
      <DemoBanner />
      {catalog.error && (
        <p role="alert" className="bg-muted px-4 py-2 text-sm">
          Venue data is temporarily unavailable. Please try again.
        </p>
      )}
      {catalog.data && !catalog.data.ready && (
        <p className="bg-muted px-4 py-2 text-sm">
          Reservations await venue setup and business approval.
        </p>
      )}
      <div className="site-header-inner mx-auto flex items-center gap-4 py-4">
        <Link to="/" className="flex flex-col leading-tight tracking-tight">
          {home ? (
            <HomeBrand />
          ) : (
            <>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                The home of Enigma + Studio D
              </span>
              <span className="site-wordmark font-serif font-bold tracking-tight">
                Creative Collective
              </span>
            </>
          )}
        </Link>
        <nav aria-label="Brands" className="ml-4 hidden gap-1 md:flex">
          <Link to="/spaces" className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted">
            Find a space
          </Link>
          {liveBrands.map((b) => (
            <Link
              key={b.slug}
              to="/$brand"
              params={{ brand: b.slug }}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: "bg-muted text-foreground" }}
            >
              {b.name}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/account/bookings">My bookings</Link>
          </Button>
          {auth.user ? (
            <Button
              size="sm"
              className={home ? "psd-header-signout" : undefined}
              onClick={async () => {
                await db().auth.signOut();
                window.location.assign("/login");
              }}
            >
              Sign out {home && <LogOut aria-hidden="true" />}
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
          )}
          {auth.staff && (
            <Button asChild size="sm" variant="outline">
              <Link to="/admin" className={home ? "psd-header-staff" : undefined}>
                Staff {home && <UserRound aria-hidden="true" />}
              </Link>
            </Button>
          )}
        </div>
      </div>
      <nav aria-label="Mobile brands" className="flex gap-4 px-4 pb-3 md:hidden">
        <Link to="/spaces" className="text-sm underline">
          Find a space
        </Link>
        {liveBrands.map((b) => (
          <Link key={b.slug} to="/$brand" params={{ brand: b.slug }} className="text-sm underline">
            {b.name}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter({ home = false }: { home?: boolean }) {
  const auth = useAuth();
  if (home)
    return (
      <footer className="psd-footer">
        <div className="psd-wrap">
          <div className="psd-footer-top">
            <div>
              <Link to="/" aria-label="Creative Collective home">
                <HomeBrand light />
              </Link>
              <p>
                Workspace and production, together. Booking times are shown in Jamaica time
                (America/Jamaica).
              </p>
            </div>
            <nav aria-label="Explore">
              <strong>Explore</strong>
              <Link to="/spaces">Find a space</Link>
              <Link to="/$brand" params={{ brand: "enigma" }}>
                Enigma
              </Link>
              <Link to="/$brand" params={{ brand: "studio-d" }}>
                Studio D
              </Link>
            </nav>
            <nav aria-label="Bookings">
              <strong>Bookings</strong>
              <Link to="/account/bookings">My bookings</Link>
              <Link to="/policies">Booking policies</Link>
            </nav>
            <nav aria-label="Support">
              <strong>Support</strong>
              <Link to="/help">Help &amp; enquiries</Link>
            </nav>
          </div>
          <p className="psd-footer-note">
            Reservations require staff approval. Pay in person after approval. Prices are in JMD;
            applicable tax appears in your booking summary. Longer rentals are arranged by quote.
          </p>
          <p className="psd-copyright">
            ©Creative Collective {new Date().getFullYear()}. All rights reserved
          </p>
        </div>
      </footer>
    );
  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <div className="site-footer-brand">
          <Link to="/" className="site-footer-wordmark">
            Creative
            <br />
            Collective<span aria-hidden="true">.</span>
          </Link>
          <p>
            Space to focus. Room to create.
            <br />
            Discover Enigma and Studio D.
          </p>
          <Link to="/spaces" className="site-footer-explore">
            Find your next space <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <nav aria-label="Spaces">
          <h2>Our spaces</h2>
          <ul>
            <li>
              <Link to="/spaces">Explore all spaces</Link>
            </li>
            {brands.map((b) => (
              <li key={b.slug}>
                <Link to="/$brand" params={{ brand: b.slug }}>
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Account">
          <h2>Your visit</h2>
          <ul>
            <li>
              <Link to="/account/bookings">My bookings</Link>
            </li>
            <li>
              <Link to="/login">Sign in</Link>
            </li>
            <li>
              <Link to="/help">Booking help</Link>
            </li>
            {auth.staff && (
              <li>
                <Link to="/admin">Staff operations</Link>
              </li>
            )}
          </ul>
        </nav>
        <nav aria-label="Support">
          <h2>Need a hand?</h2>
          <ul>
            <li>
              <Link to="/help">Help & enquiries</Link>
            </li>
            <li>
              <Link to="/policies">Policies</Link>
            </li>
          </ul>
          <p className="site-footer-time">
            All booking times in
            <br />
            {VENUE_TIMEZONE_LABEL}
          </p>
        </nav>
      </div>
      <div className="site-footer-bottom">
        <p>
          Reservations require staff approval. Pay in person after approval. Prices are in JMD;
          applicable tax appears in your booking summary. Longer rentals are arranged by quote.
        </p>
        <span>© {new Date().getFullYear()} Creative Collective</span>
      </div>
    </footer>
  );
}

export function SiteLayout({ children, home = false }: { children: ReactNode; home?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader home={home} />
      <main className="flex-1">{children}</main>
      <SiteFooter home={home} />
      <PlatformTour />
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p> : null}
      <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{title}</h1>
      {description ? <p className="mt-3 text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-panel flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
