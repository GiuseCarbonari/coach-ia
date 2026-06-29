# SPEC — Commenti AI: modello Groq più economico + commenti più brevi

**Summary:** Sostituire il modello Groq dei commenti (`qwen/qwen3.6-27b`, reasoning) con `llama-3.1-8b-instant` (non-reasoning, il più economico), abbassare il budget token del path Groq e accorciare i cap di parole nei prompt. Diff in un solo file: `lib/ai/groq-provider.ts`.

## OPEN QUESTIONS
NESSUNA — tutte le decisioni hanno un default ragionevole. Default scelti:
- Modello Groq → `llama-3.1-8b-instant`.
- Cap token Groq separato a `350` (non tocco lo `MAX_TOKENS = 800` condiviso, così il path Anthropic/fallback resta invariato).
- Cap parole nei 3 prompt → ~80-90 parole.
- `reasoning_effort: "none"` → RIMOSSO (parametro reasoning, non supportato da un modello non-reasoning; lasciarlo rischia un 400).

## MODELLO SCELTO
**`llama-3.1-8b-instant`**
- Fonte: https://console.groq.com/docs/models (verificato via WebFetch il 2026-06-29).
- Production model, NON reasoning → elimina alla radice il problema dei reasoning-token (niente blocco `<think>`, niente content vuoto).
- Il più economico in catalogo: $0.05/M input, $0.08/M output. Context 131k. ~560 tok/s.
- Alternativa scartata: `openai/gpt-oss-20b` (più veloce ma ~4x costo output, $0.30/M).

## EDITS (solo `lib/ai/groq-provider.ts`)

1. **Cap token separato per Groq** — dopo la riga 46 (`const MAX_TOKENS = 800;`):
   - AGGIUNGERE:
     ```ts
     // Groq usa un budget più stretto: commenti brevi, modello economico.
     const MAX_TOKENS_GROQ = 350;
     ```
   - `MAX_TOKENS = 800` resta invariato (path Anthropic = default/fallback).

2. **Model id** — riga 148:
   - BEFORE: `model: "qwen/qwen3.6-27b",`
   - AFTER:  `model: "llama-3.1-8b-instant",`

3. **max_tokens del path Groq** — riga 149:
   - BEFORE: `max_tokens: MAX_TOKENS,`
   - AFTER:  `max_tokens: MAX_TOKENS_GROQ,`

4. **Rimuovere reasoning_effort** — righe 150-153 (il commento + `reasoning_effort: "none",`):
   - ELIMINARE le 4 righe (il blocco commento `// Spegne il reasoning...` e la riga `reasoning_effort: "none",`). Modello non-reasoning → parametro inutile/rischioso.

5. **Accorciare i cap di parole nei prompt** — `SYSTEM_PROMPTS` (righe 48-91):
   - `oggi` (riga 57): `Max 200 parole.` → `Max 90 parole. Vai dritto al punto: stato di oggi in una frase, poi un consiglio pratico. Niente preamboli.`
   - `profilo` (riga 73): `Max 180 parole.` → `Max 90 parole. Sintetico: fenotipo, 1 limitatore, 1 consiglio. Niente preamboli.`
   - `percorso` (riga 90): `Max 220 parole.` → `Max 100 parole. Sintetico: tipo di gara, punto critico, 1 consiglio di pacing, 1 di nutrizione. Niente preamboli.`
   - Le lunghe liste "ANALIZZA in questo ordine" (5-7 punti) restano: servono da guida al modello su COSA guardare; il cap parole + "Sintetico/Niente preamboli" forza l'output corto senza riscrivere i prompt. Se dopo il test i commenti restano lunghi, secondo giro: tagliare le liste a 3 punti. ponytail: cap-prima-dei-tagli, taglia le liste solo se il cap non basta.

## PRESERVARE
- `cleanComment()` invariata (gestisce ancora asterischi; lo strip `<think>` diventa no-op innocuo con un modello non-reasoning).
- Le guardie `GROQ_EMPTY_RESPONSE` / `GROQ_EMPTY_CONTENT` / `finish_reason === "length"` invariate.

## TEST (una verifica runnable)
Con `COACH_AI_PROVIDER=groq` e `GROQ_API_KEY` in env, chiamare l'endpoint commento OGGI:
```
curl -s http://localhost:3000/api/comments/oggi -X POST -H "Content-Type: application/json" -d '{...payload reale...}'
```
oppure aprire la dashboard OGGI con auto-comment attivo.
**Pass se:** risposta 200 (nessun 400 da parametro reasoning rifiutato), `comment` non vuoto, lunghezza ~80-90 parole, `tokens_used.completion` nettamente sotto i valori precedenti.
Controprova rapida del rischio reasoning_effort: se il 400 si presentasse, è confermato che il parametro andava rimosso (già fatto in edit #4).
