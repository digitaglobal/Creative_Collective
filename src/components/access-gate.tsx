import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { backendConfigured } from "@/lib/supabase";

export function AccessGate({ children, staff = false }: { children: ReactNode; staff?: boolean }) {
  const auth = useAuth();
  if (!backendConfigured)
    return <p className="surface-panel p-6">Accounts and booking are awaiting backend setup.</p>;
  if (auth.loading) return <p role="status">Loading your account…</p>;
  if (auth.error) return <p role="alert">{auth.error}</p>;
  if (!auth.user)
    return (
      <p className="surface-panel p-6">
        <Link to="/login" className="underline">
          Sign in
        </Link>{" "}
        to continue.
      </p>
    );
  if (staff && !auth.staff) return <p role="alert">Staff access is required.</p>;
  return children;
}
