import { NextResponse, type NextRequest } from "next/server";

import {
  INTERVALS_TOKEN_URL,
  OAUTH_STATE_COOKIE,
  type IntervalsTokenResponse,
} from "@/lib/intervals/config";
import { encryptToken } from "@/lib/crypto";
import { syncIntervalsData } from "@/lib/intervals/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/intervals/callback — completa il flusso OAuth.
 *
 * Cosa fa, in ordine:
 *  1. verifica lo state CSRF contro il cookie emesso da /login (401 se non
 *     coincide: la richiesta non è partita da noi);
 *  2. scambia il code con l'access token (server-side: il client_secret
 *     non arriva mai al browser);
 *  3. cifra il token con AES-256-GCM PRIMA di toccare il database;
 *  4. salva la connessione e l'identità atleta (id e nome: gli unici dati
 *     Intervals consentiti in Milestone 1);
 *  5. cancella il cookie state e porta l'utente in dashboard.
 *
 * Nota sicurezza: in questo file non si logga MAI l'access token né il
 * client_secret — in caso d'errore si logga solo lo status HTTP.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  // Verifica CSRF: state della query e cookie devono esistere e coincidere.
  if (!code || !state || !stateCookie || state !== stateCookie) {
    return new NextResponse("Stato OAuth non valido", { status: 401 });
  }

  // Serve la sessione Supabase per sapere a chi appartiene la connessione.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Scambio code → token. Form data come da documentazione verificata;
  // grant_type è il parametro standard del flusso authorization code.
  const tokenResponse = await fetch(INTERVALS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.INTERVALS_OAUTH_CLIENT_ID!,
      client_secret: process.env.INTERVALS_OAUTH_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env.INTERVALS_REDIRECT_URI!,
    }),
  });

  if (!tokenResponse.ok) {
    // Solo lo status: il body potrebbe echeggiare parametri sensibili.
    console.error(
      `Scambio token Intervals fallito: HTTP ${tokenResponse.status}`
    );
    return new NextResponse("Scambio token fallito", { status: 502 });
  }

  const tokenData = (await tokenResponse.json()) as IntervalsTokenResponse;
  if (!tokenData.access_token || !tokenData.athlete?.id) {
    console.error("Risposta token Intervals incompleta (campi attesi assenti)");
    return new NextResponse("Risposta token non valida", { status: 502 });
  }

  const athleteId = String(tokenData.athlete.id);
  const athleteName = tokenData.athlete.name ?? null;

  // Cifratura PRIMA di qualsiasi scrittura: il plaintext del token non
  // deve mai raggiungere il database (regola ferma del milestone).
  const accessTokenEncrypted = encryptToken(tokenData.access_token);

  // Scritture con service role: le policy RLS non consentono al client di
  // scrivere su intervals_connections/users/audit_logs (by design).
  const admin = createAdminClient();

  // Upsert: ricollegare un account già collegato sovrascrive la connessione.
  const { error: connError } = await admin.from("intervals_connections").upsert(
    {
      user_id: user.id,
      access_token_encrypted: accessTokenEncrypted,
      intervals_athlete_id: athleteId,
      intervals_athlete_name: athleteName,
      granted_scopes: tokenData.scope ?? "",
      connected_at: new Date().toISOString(),
      status: "active",
    },
    { onConflict: "user_id" }
  );
  if (connError) {
    console.error("Salvataggio connessione fallito:", connError.message);
    return new NextResponse("Salvataggio connessione fallito", { status: 500 });
  }

  // Upsert (non update) su users: copre anche utenti creati prima del
  // trigger handle_new_user. Aggiorna solo i campi qui elencati.
  const { error: userError } = await admin.from("users").upsert(
    {
      id: user.id,
      email: user.email,
      intervals_athlete_id: athleteId,
      intervals_athlete_name: athleteName,
    },
    { onConflict: "id" }
  );
  if (userError) {
    console.error("Aggiornamento utente fallito:", userError.message);
    return new NextResponse("Aggiornamento utente fallito", { status: 500 });
  }

  // Traccia l'evento (PRD §24.2 "log accessi"). Il payload non contiene
  // token, solo l'identità atleta.
  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: "intervals.connected",
    source: "oauth_callback",
    payload: { intervals_athlete_id: athleteId },
  });

  // Sync immediato (Milestone 2): l'utente atterra in dashboard con dati
  // freschi. Non bloccante: se fallisce, il bottone "Aggiorna dati" resta
  // disponibile in dashboard.
  try {
    await syncIntervalsData(user.id);
  } catch {
    console.error("Sync iniziale post-connessione fallito (non bloccante)");
  }

  // State monouso: cancellato subito dopo l'uso.
  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}
