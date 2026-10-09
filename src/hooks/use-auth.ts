import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>("customer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let generation = 0;
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;
    const load = async (next: User | null) => {
      if (!active) return;
      const current = ++generation;
      setError("");
      setUser(next);
      setRole("customer");
      if (next) {
        const result = await client.from("profiles").select("role").eq("id", next.id).single();
        if (!active || current !== generation) return;
        if (result.error) setError(result.error.message);
        else if (result.data) setRole(result.data.role);
        else setError("Your account profile is unavailable. Please contact the venue.");
      }
      if (active) setLoading(false);
    };
    void client.auth.getUser().then(({ data, error: authError }) => {
      if (authError && active && authError.name !== "AuthSessionMissingError")
        setError(authError.message);
      void load(data.user);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        void load(session?.user ?? null);
      }, 0);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  return { user, role, loading, error, staff: role === "staff" || role === "administrator" };
}
