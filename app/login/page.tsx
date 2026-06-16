"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Pagina /login — autenticazione Supabase (email + password).
 *
 * Solo la UI è cambiata rispetto alla versione MVP: tab Accedi/Registrati,
 * card centrata, stile Coach IA dark premium. La logica di auth resta invariata —
 * signInWithPassword / signUp, poi redirect a /dashboard dove il middleware
 * decide se mandare l'utente a /connect (Intervals non ancora collegato).
 */

type Mode = "signin" | "signup";

/**
 * Traduce in italiano i messaggi d'errore Supabase più comuni. Supabase
 * risponde in inglese: mappiamo sul testo del messaggio invece che su codici
 * (l'SDK auth non espone codici stabili per questi casi).
 */
function localizeError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Email o password non corretti";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Email già registrata";
  }
  if (m.includes("password should be at least") || m.includes("password")) {
    return "Password troppo corta (min 8 caratteri)";
  }
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(localizeError(error.message));
      return;
    }
    // Il middleware deciderà se mandare a /connect o /dashboard.
    router.push("/dashboard");
    router.refresh();
  }

  async function handleSignUp() {
    setLoading(true);
    setError(null);
    setNotice(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(localizeError(error.message));
      return;
    }
    // Se la conferma email è attiva sul progetto Supabase, signUp non crea
    // una sessione: l'utente deve prima cliccare il link ricevuto.
    if (!data.session) {
      setNotice(
        "Registrazione avviata: controlla la tua email per confermare l'account."
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setNotice(null);
  }

  const isSignin = mode === "signin";

  const tabClass = (active: boolean) =>
    `rounded-[9px] py-1.5 text-[13px] font-medium transition-colors ${
      active
        ? "bg-surface-2 text-foreground"
        : "text-muted hover:text-foreground"
    }`;

  const inputClass =
    "h-10 rounded-[9px] border-[0.5px] border-border bg-base px-3 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:ring-2 focus:ring-amber";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-base px-4 py-10">
      <div className="w-full max-w-[420px] rounded-2xl border-[0.5px] border-border bg-surface p-8">
        {/* 1. Logo / nome */}
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-[9px] bg-amber text-[18px] font-bold text-amber-on">
            C
          </span>
          <p className="text-[20px] font-medium tracking-tight text-foreground">
            Coach IA
          </p>
          <p className="mt-1 text-[13px] text-muted">
            Accedi al tuo account Coach IA
          </p>
        </div>

        {/* 2. Tab toggle Accedi / Registrati */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-[11px] bg-base p-1">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className={tabClass(isSignin)}
          >
            Accedi
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={tabClass(!isSignin)}
          >
            Registrati
          </button>
        </div>

        <p className="mb-5 text-center text-[13px] leading-5 text-muted">
          {isSignin
            ? "Usa le credenziali di Coach IA. Il collegamento a Intervals.icu resta separato."
            : "Crea prima il tuo account Coach IA. Collegherai Intervals.icu nel passaggio successivo."}
        </p>

        {/* 3. Form */}
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void (isSignin ? handleSignIn() : handleSignUp());
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[13px] text-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-[13px] text-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete={isSignin ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* 6. Box errore — stato semaforico rosso */}
          {error && (
            <div className="rounded-[9px] border-[0.5px] border-ready-skip-border bg-surface px-3 py-2 text-[13px] text-ready-skip">
              {error}
            </div>
          )}

          {/* Avviso non-bloccante (es. conferma email su registrazione) */}
          {notice && (
            <div className="rounded-[9px] border-[0.5px] border-border bg-surface-2 px-3 py-2 text-[13px] text-secondary">
              {notice}
            </div>
          )}

          {/* 4. Bottone primario ambra */}
          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded-[9px] bg-amber text-sm font-medium text-amber-on transition-colors hover:bg-amber-hover disabled:pointer-events-none disabled:opacity-50"
          >
            {loading
              ? "Attendere…"
              : isSignin
                ? "Accedi"
                : "Crea account"}
          </button>

          {/* 5. Password dimenticata — solo tab Accedi.
              Visivo per ora: il flusso di reset non è ancora in scope, quindi
              niente route dedicata (resta un placeholder non navigante). */}
          {isSignin && (
            <div className="text-center">
              <button
                type="button"
                className="text-[12px] text-muted hover:text-secondary"
              >
                Password dimenticata?
              </button>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
