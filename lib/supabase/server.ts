import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase per Server Components, Route Handlers e Server Actions.
 *
 * I cookie della richiesta trasportano la sessione utente. Nei Server
 * Component puri lo store è read-only; il rinnovo dei cookie viene
 * propagato dal middleware.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set({ name, value, ...options });
            });
          } catch {
            // Atteso nei Server Component con cookie read-only.
          }
        },
      },
    }
  );
}
