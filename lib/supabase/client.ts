import { createBrowserClient } from "@supabase/ssr";
import type { SetAllCookies } from "@supabase/ssr";

const MAX_AGE = 400 * 24 * 60 * 60; // 400 giorni in secondi

function isAuthCookie(name: string) {
  return name.startsWith("sb-") && name.includes("-auth-token");
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Path=/; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0`;
}

/**
 * Client Supabase per il BROWSER (Client Components).
 *
 * Cookie handler custom: forza Max-Age=400gg su tutti i cookie di sessione
 * Supabase (sb-*-auth-token) così la sessione sopravvive alla chiusura
 * dell'app su mobile e al riavvio del browser su desktop.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof document === "undefined") return [];
          return document.cookie
            .split(";")
            .map((c) => c.trim())
            .filter(Boolean)
            .map((c) => {
              const idx = c.indexOf("=");
              return { name: c.slice(0, idx), value: c.slice(idx + 1) };
            });
        },
        setAll(cookies: Parameters<SetAllCookies>[0]) {
          cookies.forEach(({ name, value }) => {
            if (isAuthCookie(name)) {
              writeCookie(name, value);
            } else {
              // Cookie non-auth: scrivi normalmente senza Max-Age fisso
              if (typeof document !== "undefined") {
                document.cookie = `${name}=${value}; Path=/; SameSite=Lax`;
              }
            }
          });
        },
      },
    }
  );
}
