import { NextResponse } from "next/server";

import { decryptToken } from "@/lib/crypto";
import { runDedupProbe } from "@/lib/intervals/dedup-probe";
import { runReconcileProbe } from "@/lib/intervals/reconcile-probe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/debug/inspect-events — SOLO SVILUPPO.
 *
 * Strumento di ispezione una-tantum (stesso ruolo di inspect-power, M3 p1):
 * mostra la STRUTTURA grezza degli eventi calendario di Intervals
 * (/athlete/0/events) per la verifica congiunta prevista dalla regola ferma
 * n.6 — nessun endpoint si implementa prima di averne visto la forma reale.
 * Obiettivo: capire come sono esposti gli allegati GPX/route degli eventi
 * RACE_A (base della futura gap analysis, PRD §33 C.6).
 *
 * Non salva nulla, non parsa nulla. In produzione risponde 404.
 * Output sanificato: niente token, valori troncati, chiavi personali oscurate.
 */

// La route legge i cookie di sessione: mai prerenderizzarla in build.
export const dynamic = "force-dynamic";

const EVENTS_URL =
  "https://intervals.icu/api/v1/athlete/0/events?oldest=2026-01-01&newest=2026-12-31&category=RACE_A";

/** Campi che indicano allegati/percorso: vanno evidenziati a parte. */
const TERRAIN_KEY_PATTERN = /attachment|file|gpx|route|terrain/i;

/**
 * Chiavi personali da oscurare. NB: volutamente più stretto del pattern di
 * inspect-power — qui "name" è il nome della GARA (serve vederlo) e "file"
 * è proprio ciò che cerchiamo.
 */
const REDACTED_KEY_PATTERN = /email|phone|address|password|token|secret/i;

const MAX_STRING_LENGTH = 80;

/** Rappresenta un valore come "tipo · valore troncato a 80 chars". */
function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") {
    const shown =
      value.length > MAX_STRING_LENGTH
        ? `${value.slice(0, MAX_STRING_LENGTH)}…`
        : value;
    return `string · "${shown}"${value.length > MAX_STRING_LENGTH ? ` [${value.length} chars]` : ""}`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return `${typeof value} · ${String(value)}`;
  }
  if (Array.isArray(value)) {
    const json = JSON.stringify(value);
    const shown =
      json.length > MAX_STRING_LENGTH
        ? `${json.slice(0, MAX_STRING_LENGTH)}…`
        : json;
    return `array(${value.length}) · ${shown}`;
  }
  if (typeof value === "object") {
    const json = JSON.stringify(value);
    const shown =
      json.length > MAX_STRING_LENGTH
        ? `${json.slice(0, MAX_STRING_LENGTH)}…`
        : json;
    return `object · ${shown}`;
  }
  return `[${typeof value}]`;
}

interface InspectedEvent {
  summary: {
    id: unknown;
    name: unknown;
    start_date_local: unknown;
    category: unknown;
  };
  /** Sottoinsieme delle chiavi attachment/file/gpx/route/terrain, in chiaro. */
  terrain_related_fields: Record<string, string>;
  /** TUTTE le chiavi dell'evento: "tipo · valore troncato". */
  all_fields: Record<string, string>;
}

function inspectEvent(event: Record<string, unknown>): InspectedEvent {
  const terrain: Record<string, string> = {};
  const all: Record<string, string> = {};

  for (const [key, value] of Object.entries(event)) {
    const described = REDACTED_KEY_PATTERN.test(key)
      ? "[redacted]"
      : describeValue(value);
    all[key] = described;
    if (TERRAIN_KEY_PATTERN.test(key)) terrain[key] = described;
  }

  return {
    summary: {
      id: event.id ?? null,
      name: event.name ?? null,
      start_date_local: event.start_date_local ?? null,
      category: event.category ?? null,
    },
    terrain_related_fields: terrain,
    all_fields: all,
  };
}

/**
 * Un evento "ha un allegato GPX" se una chiave attachment/file/gpx/route ha
 * un valore non vuoto (non null/false/""/[]). Euristica da raffinare dopo
 * aver visto i campi reali — per questo è solo un inspector.
 */
function hasGpxAttachment(event: Record<string, unknown>): boolean {
  return Object.entries(event).some(([key, value]) => {
    if (!TERRAIN_KEY_PATTERN.test(key)) return false;
    if (value == null || value === false || value === "") return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });
}

export async function GET() {
  // Mai esposta fuori dallo sviluppo locale.
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("intervals_connections")
    .select("access_token_encrypted")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!connection) {
    return NextResponse.json(
      { error: "Nessun account Intervals collegato" },
      { status: 409 }
    );
  }

  const accessToken = decryptToken(connection.access_token_encrypted);
  const headers = { Authorization: `Bearer ${accessToken}` };

  // Endpoint in corso di verifica (docs/INTERVALS_API_NOTES.md, regola n.6).
  const eventsResponse = await fetch(EVENTS_URL, {
    headers,
    cache: "no-store",
  });

  if (!eventsResponse.ok) {
    // Solo lo status: il body potrebbe echeggiare parametri sensibili.
    return NextResponse.json({
      events_endpoint: EVENTS_URL.replace(/^https:\/\/intervals\.icu/, ""),
      _error: `HTTP ${eventsResponse.status}`,
    });
  }

  const raw = (await eventsResponse.json()) as unknown;
  const events = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];

  const inspected = events.map(inspectEvent);

  // Primo evento con allegato GPX → prova /events/{id}/file.
  let fileProbe: Record<string, unknown> = {
    _note: "Nessun evento con campo attachment/file/gpx/route valorizzato",
  };
  const withGpx = events.find(hasGpxAttachment);
  if (withGpx?.id != null) {
    const fileUrl = `https://intervals.icu/api/v1/athlete/0/events/${String(withGpx.id)}/file`;
    try {
      const fileResponse = await fetch(fileUrl, { headers, cache: "no-store" });
      const bodyText = await fileResponse.text();
      fileProbe = {
        event_id: withGpx.id,
        event_name: withGpx.name ?? null,
        url: fileUrl.replace(/^https:\/\/intervals\.icu/, ""),
        http_status: fileResponse.status,
        content_type: fileResponse.headers.get("content-type"),
        body_first_200_chars: bodyText.slice(0, 200),
        body_length: bodyText.length,
      };
    } catch (error) {
      fileProbe = {
        event_id: withGpx.id,
        url: fileUrl.replace(/^https:\/\/intervals\.icu/, ""),
        _error: error instanceof Error ? error.message : "errore di rete",
      };
    }
  }

  // Secondo probe (verifica congiunta, passo 2): l'evento 115782549 ha un
  // allegato con UUID noto dal primo run — proviamo l'endpoint attachments
  // (plurale, poi singolare se 404) per capire come scaricare il file.
  const attachmentProbe = await probeAttachment(headers);

  // Terzo probe (M7, calibrazione stima tempi): vogliamo gli stream di una
  // attività reale (altitude/velocity/latlng/watts) per tarare il modello su
  // dati MTB veri. Verifichiamo QUALE path di /streams risponde.
  const activityStreamsProbe = await probeActivityStreams(headers);

  return NextResponse.json({
    events_endpoint: EVENTS_URL.replace(/^https:\/\/intervals\.icu/, ""),
    events_count: events.length,
    response_is_array: Array.isArray(raw),
    events: inspected,
    // L'oggetto attachments COMPLETO (non troncato): il run precedente ha
    // mostrato {id, filename…} tagliato a 80 chars — qui cerchiamo un
    // eventuale campo `url` di download. Contenuto non personale (file gara).
    attachments_full: events.map((e) => ({
      event_id: e.id ?? null,
      attachments: e.attachments ?? null,
    })),
    file_probe: fileProbe,
    attachment_probe: attachmentProbe,
    activity_streams_probe: activityStreamsProbe,
  });
}

/**
 * POST /api/debug/inspect-events — probe distruttivo controllato, solo dev.
 * Richiede { "confirmed": true }, crea due coppie di eventi test, le conta
 * e tenta sempre la pulizia per id.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    confirmed?: unknown;
    probe?: unknown;
  } | null;
  if (body?.confirmed !== true) {
    return NextResponse.json(
      { error: "Conferma esplicita richiesta per il probe" },
      { status: 400 }
    );
  }
  // Default invariato = dedup probe; "reconcile" = probe lookup-id per il fix orfani.
  const probe = body.probe === "reconcile" ? "reconcile" : "dedup";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("intervals_connections")
    .select("access_token_encrypted, granted_scopes")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!connection) {
    return NextResponse.json(
      { error: "Nessun account Intervals collegato" },
      { status: 409 }
    );
  }
  const canWrite = String(connection.granted_scopes ?? "")
    .split(/[\s,]+/)
    .some((scope) => scope.toUpperCase() === "CALENDAR:WRITE");
  if (!canWrite) {
    return NextResponse.json(
      { error: "Scope CALENDAR:WRITE mancante" },
      { status: 403 }
    );
  }

  try {
    const accessToken = decryptToken(connection.access_token_encrypted);
    const result =
      probe === "reconcile"
        ? await runReconcileProbe(accessToken)
        : await runDedupProbe(accessToken);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Probe fallito",
      },
      { status: 502 }
    );
  }
}

/** ID evento e UUID allegato emersi dal primo run dell'inspector. */
const PROBE_EVENT_ID = "115782549";
const PROBE_ATTACHMENT_UUID = "b2d6a010-b100-423f-ba26-e3cce8544aaf";

const ATTACHMENT_BODY_CHARS = 500;

/** GET su un URL allegato: status, content-type, lunghezza e inizio body. */
async function fetchAttachmentInfo(
  url: string,
  headers: Record<string, string>
): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(url, { headers, cache: "no-store" });
    const bodyText = await response.text();
    return {
      url: url.replace(/^https:\/\/intervals\.icu/, ""),
      http_status: response.status,
      content_type: response.headers.get("content-type"),
      body_length: bodyText.length,
      body_first_500_chars: bodyText.slice(0, ATTACHMENT_BODY_CHARS),
    };
  } catch (error) {
    return {
      url: url.replace(/^https:\/\/intervals\.icu/, ""),
      _error: error instanceof Error ? error.message : "errore di rete",
    };
  }
}

/** Prova attachments/{uuid} (plurale); se 404, riprova attachment/{uuid}. */
async function probeAttachment(
  headers: Record<string, string>
): Promise<Record<string, unknown>> {
  const base = `https://intervals.icu/api/v1/athlete/0/events/${PROBE_EVENT_ID}`;

  const plural = await fetchAttachmentInfo(
    `${base}/attachments/${PROBE_ATTACHMENT_UUID}`,
    headers
  );
  if (plural.http_status !== 404) {
    return { plural };
  }

  const singular = await fetchAttachmentInfo(
    `${base}/attachment/${PROBE_ATTACHMENT_UUID}`,
    headers
  );
  return { plural, singular_fallback: singular };
}

// ============================================================================
// Terzo probe: stream di una attività (M7 — calibrazione stima tempi)
// ============================================================================

const ACTIVITIES_URL =
  "https://intervals.icu/api/v1/athlete/0/activities" +
  "?oldest=2026-01-01&newest=2026-12-31" +
  "&fields=id,name,type,start_date_local,moving_time,stream_types,distance,total_elevation_gain";

const STREAM_TYPES = "altitude,velocity_smooth,latlng,watts";

interface RawActivity {
  id?: string | number;
  name?: string;
  type?: string;
  start_date_local?: string;
  moving_time?: number;
  stream_types?: unknown;
  distance?: number;
  total_elevation_gain?: number;
}

/**
 * Riassume un corpo /streams: prova a parsarlo come JSON e descrive la
 * struttura (array di {type,data} oppure oggetto per-chiave), con _length e
 * primi 3 elementi di ogni stream. Niente dato personale sensibile (sono
 * tracce sportive); latlng troncato come gli altri.
 */
function summarizeStreams(bodyText: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return {
      _shape: "non-JSON",
      body_length: bodyText.length,
      body_first_200_chars: bodyText.slice(0, 200),
    };
  }

  // Forma A: array di stream objects [{ type, data: [...] }, ...].
  if (Array.isArray(parsed)) {
    return {
      _shape: "array",
      stream_count: parsed.length,
      streams: parsed.map((s) => {
        const obj = (s ?? {}) as Record<string, unknown>;
        const data = obj.data;
        return {
          keys: Object.keys(obj),
          type: obj.type ?? null,
          _length: Array.isArray(data) ? data.length : null,
          first_3: Array.isArray(data) ? data.slice(0, 3) : null,
        };
      }),
    };
  }

  // Forma B: oggetto per-chiave { altitude: {data:[...]} | [...] , ... }.
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const perKey: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const arr = Array.isArray(value)
        ? value
        : value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).data)
          ? ((value as Record<string, unknown>).data as unknown[])
          : null;
      perKey[key] = {
        value_type: Array.isArray(value) ? "array" : typeof value,
        _length: arr ? arr.length : null,
        first_3: arr ? arr.slice(0, 3) : null,
      };
    }
    return { _shape: "object", top_level_keys: Object.keys(obj), streams: perKey };
  }

  return { _shape: typeof parsed, value: parsed };
}

/** GET su un URL /streams: status, content-type e riassunto struttura. */
async function fetchStreamInfo(
  url: string,
  headers: Record<string, string>
): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(url, { headers, cache: "no-store" });
    const bodyText = await response.text();
    return {
      url: url.replace(/^https:\/\/intervals\.icu/, ""),
      http_status: response.status,
      content_type: response.headers.get("content-type"),
      body_length: bodyText.length,
      // Riassunto solo se la risposta sembra ok; altrimenti inizio body grezzo.
      ...(response.ok
        ? { summary: summarizeStreams(bodyText) }
        : { body_first_200_chars: bodyText.slice(0, 200) }),
    };
  } catch (error) {
    return {
      url: url.replace(/^https:\/\/intervals\.icu/, ""),
      _error: error instanceof Error ? error.message : "errore di rete",
    };
  }
}

/**
 * Trova la prima attività MTB/Ride recente e prova i due path di /streams
 * (singolare /activity/{id} vs plurale /athlete/0/activities/{id}). Se
 * entrambi 404, riprova /activity/{id}/streams.json senza ?types.
 */
async function probeActivityStreams(
  headers: Record<string, string>
): Promise<Record<string, unknown>> {
  // 1) Lista attività con i soli campi richiesti.
  let listResponse: Response;
  try {
    listResponse = await fetch(ACTIVITIES_URL, { headers, cache: "no-store" });
  } catch (error) {
    return {
      activities_endpoint: ACTIVITIES_URL.replace(/^https:\/\/intervals\.icu/, ""),
      _error: error instanceof Error ? error.message : "errore di rete",
    };
  }
  if (!listResponse.ok) {
    return {
      activities_endpoint: ACTIVITIES_URL.replace(/^https:\/\/intervals\.icu/, ""),
      _error: `HTTP ${listResponse.status}`,
    };
  }

  const rawList = (await listResponse.json().catch(() => null)) as unknown;
  const activities = Array.isArray(rawList) ? (rawList as RawActivity[]) : [];

  // 2) Prima attività MTB; se nessuna, primo Ride; se nessuno, prima in lista.
  const mtb = activities.find((a) => a.type === "MountainBikeRide");
  const ride = activities.find((a) => a.type === "Ride");
  const chosen = mtb ?? ride ?? activities[0] ?? null;

  if (!chosen?.id) {
    return {
      activities_endpoint: ACTIVITIES_URL.replace(/^https:\/\/intervals\.icu/, ""),
      activities_count: activities.length,
      _note: "Nessuna attività con id trovata nel periodo",
    };
  }

  const id = String(chosen.id);
  const chosen_activity = {
    id: chosen.id,
    name: chosen.name ?? null,
    type: chosen.type ?? null,
    start_date_local: chosen.start_date_local ?? null,
    moving_time: chosen.moving_time ?? null,
    distance: chosen.distance ?? null,
    total_elevation_gain: chosen.total_elevation_gain ?? null,
    // stream_types dice già quali stream esistono per questa attività.
    stream_types: chosen.stream_types ?? null,
  };

  // 3) Probe A: path singolare /activity/{id}/streams.json
  const probeA = await fetchStreamInfo(
    `https://intervals.icu/api/v1/activity/${id}/streams.json?types=${STREAM_TYPES}`,
    headers
  );

  // 4) Probe B: path plurale /athlete/0/activities/{id}/streams
  const probeB = await fetchStreamInfo(
    `https://intervals.icu/api/v1/athlete/0/activities/${id}/streams?types=${STREAM_TYPES}`,
    headers
  );

  const result: Record<string, unknown> = {
    activities_endpoint: ACTIVITIES_URL.replace(/^https:\/\/intervals\.icu/, ""),
    activities_count: activities.length,
    chosen_activity,
    probe_A_activity_singular: probeA,
    probe_B_athlete_plural: probeB,
  };

  // 5) Se entrambi 404, riprova A senza ?types.
  if (probeA.http_status === 404 && probeB.http_status === 404) {
    result.probe_A_no_types = await fetchStreamInfo(
      `https://intervals.icu/api/v1/activity/${id}/streams.json`,
      headers
    );
  }

  return result;
}
