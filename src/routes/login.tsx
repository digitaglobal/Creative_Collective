import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { db, supabase, backendConfigured } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: Login,
});
function Login() {
  const [mode, setMode] = useState<"in" | "up" | "reset" | "update">("in");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const auth = useAuth();
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    if (new URLSearchParams(window.location.search).get("recovery") === "1") setMode("update");
    return () => data.subscription.unsubscribe();
  }, []);
  const field = "mt-1 w-full rounded border bg-background p-2";
  return (
    <SiteLayout>
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-3xl font-semibold">
          {
            {
              in: "Sign in",
              up: "Create an account",
              reset: "Reset password",
              update: "Set a new password",
            }[mode]
          }
        </h1>
        {!backendConfigured && (
          <p className="mt-4" role="status">
            Accounts are awaiting backend setup.
          </p>
        )}
        {auth.user && mode !== "update" && (
          <p className="mt-4">
            Signed in as {auth.user.email}.{" "}
            <Link to="/account/bookings" className="underline">
              My bookings
            </Link>
          </p>
        )}
        <form
          className="surface-panel mt-6 space-y-4 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setMessage("");
            try {
              const client = db();
              const email = String(f.get("email") ?? "");
              const password = String(f.get("password") ?? "");
              if (mode === "up") {
                const { error } = await client.auth.signUp({
                  email,
                  password,
                  options: {
                    data: { full_name: f.get("name"), phone: f.get("phone") },
                    emailRedirectTo: window.location.origin + "/login",
                  },
                });
                if (error) throw error;
                setMessage("Check your email to verify your account before signing in.");
              }
              if (mode === "in") {
                const { error } = await client.auth.signInWithPassword({ email, password });
                if (error) throw error;
                window.location.assign("/account/bookings");
              }
              if (mode === "reset") {
                const { error } = await client.auth.resetPasswordForEmail(email, {
                  redirectTo: window.location.origin + "/login?recovery=1",
                });
                if (error) throw error;
                setMessage("If an account exists, a reset link has been sent.");
              }
              if (mode === "update") {
                const { error } = await client.auth.updateUser({ password });
                if (error) throw error;
                setMessage("Password updated.");
                setMode("in");
              }
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Authentication failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === "up" && (
            <>
              <label className="block text-sm">
                Full name
                <input name="name" required autoComplete="name" maxLength={200} className={field} />
              </label>
              <label className="block text-sm">
                Phone
                <input
                  name="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  maxLength={50}
                  className={field}
                />
              </label>
            </>
          )}
          {mode !== "update" && (
            <label className="block text-sm">
              Email
              <input name="email" type="email" required autoComplete="email" className={field} />
            </label>
          )}
          {mode !== "reset" && (
            <label className="block text-sm">
              Password
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                className={field}
              />
            </label>
          )}
          <Button disabled={busy || !backendConfigured || auth.loading} className="w-full">
            {busy ? "Please wait…" : "Continue"}
          </Button>
          {message && <p role="status">{message}</p>}
        </form>
        <div className="mt-4 flex gap-4 text-sm">
          {(["in", "up", "reset"] as const).map((m) => (
            <button
              key={m}
              className="underline"
              onClick={() => {
                setMode(m);
                setMessage("");
              }}
            >
              {m === "in" ? "Sign in" : m === "up" ? "Create account" : "Forgot password"}
            </button>
          ))}
        </div>
      </div>
    </SiteLayout>
  );
}
