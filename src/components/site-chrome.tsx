import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/supabase";
import { useCatalog } from "@/hooks/use-catalog";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DemoBanner } from "@/components/demo-banner";
import { VENUE_TIMEZONE_LABEL, brands } from "@/data/catalog";

export function SiteHeader() {
  const auth = useAuth();
  const catalog = useCatalog();
  const liveBrands = catalog.data?.brands.length ? catalog.data.brands : brands;
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
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
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex flex-col leading-tight tracking-tight">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            The home of Enigma + Studio D
          </span>
          <span className="text-base font-extrabold">Creative Collective</span>
        </Link>
        <nav aria-label="Brands" className="ml-4 hidden gap-1 md:flex">
          <Link to="/spaces" className="rounded-md px-3 py-2 text-sm hover:bg-muted">
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
              onClick={async () => {
                await db().auth.signOut();
                window.location.assign("/login");
              }}
            >
              Sign out
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
          )}
          {auth.staff && (
            <Button asChild size="sm" variant="outline">
              <Link to="/admin">Staff</Link>
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

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-extrabold">Creative Collective</p>
          <p className="mt-1 text-sm text-muted-foreground">Workspace and production, together.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Booking times are shown in {VENUE_TIMEZONE_LABEL}.
          </p>
        </div>
        <nav aria-label="Spaces" className="text-sm">
          <p className="font-medium">Spaces</p>
          <ul className="mt-2 space-y-1.5 text-muted-foreground">
            {brands.map((b) => (
              <li key={b.slug}>
                <Link to="/$brand" params={{ brand: b.slug }} className="hover:text-foreground">
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Support" className="text-sm">
          <p className="font-medium">Support</p>
          <ul className="mt-2 space-y-1.5 text-muted-foreground">
            <li>
              <Link to="/help" className="hover:text-foreground">
                Help
              </Link>
            </li>
            <li>
              <Link to="/policies" className="hover:text-foreground">
                Policies
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Staff" className="text-sm">
          <p className="font-medium">Staff</p>
          <ul className="mt-2 space-y-1.5 text-muted-foreground">
            <li>
              <Link to="/admin" className="hover:text-foreground">
                Operations dashboard
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted-foreground">
          Reservations require staff approval. Pay in person after approval. Prices are in JMD;
          applicable tax appears in your booking summary. Longer rentals are arranged by quote.
        </p>
      </div>
    </footer>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
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
