import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Enigma + Studio D" },
      { name: "description", content: "Sign in or create an account to book." },
      { property: "og:title", content: "Sign in — Enigma + Studio D" },
      { property: "og:description", content: "Sign in or create an account to book." },
    ],
  }),
  component: Login,
});

function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const field = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  return (
    <SiteLayout>
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-3xl font-semibold">{mode === "in" ? "Sign in" : "Create an account"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Accounts are not live yet in this demo.</p>
        <form className="surface-panel mt-6 space-y-4 p-6" onSubmit={(e) => e.preventDefault()}>
          {mode === "up" ? (
            <label className="block text-sm font-medium">Full name<input className={field} autoComplete="name" /></label>
          ) : null}
          <label className="block text-sm font-medium">Email<input type="email" className={field} autoComplete="email" /></label>
          <label className="block text-sm font-medium">Password<input type="password" className={field} /></label>
          <Button asChild className="w-full"><Link to="/account/bookings">Continue (demo)</Link></Button>
        </form>
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 text-sm underline">
          {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </SiteLayout>
  );
}
