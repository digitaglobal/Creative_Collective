import { createClient } from "@supabase/supabase-js";

const url = import.meta.env["VITE_SUPABASE_URL"];
const key = import.meta.env["VITE_SUPABASE_ANON_KEY"];
export const backendConfigured = Boolean(url && key);
export const supabase = backendConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: typeof window !== "undefined",
        autoRefreshToken: typeof window !== "undefined",
        detectSessionInUrl: typeof window !== "undefined",
      },
    })
  : null;

export function db() {
  if (!supabase) throw new Error("Booking is not configured yet. Please contact the venue.");
  return supabase;
}

export async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
