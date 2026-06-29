# Changes — Commenti AI: modello Groq economico + commenti più brevi

Single-file change to `lib/ai/groq-provider.ts` per `.pipeline/spec.md`.
Typecheck (`npx tsc --noEmit`) pulito (exit 0). Non committato, dev server non avviato.

## Cosa è cambiato (file: `lib/ai/groq-provider.ts`)

- **JSDoc di intestazione** (riga ~8): `Max tokens: 300/comment (tight budget → ≤150 words output).` →
  `Max tokens: Groq 350 / Anthropic 800 → commenti brevi (~90 parole).`
- **Cap token Groq** (dopo `const MAX_TOKENS = 800;`): aggiunto
  `// Groq usa un budget più stretto: commenti brevi, modello economico.` +
  `const MAX_TOKENS_GROQ = 350;`. `MAX_TOKENS = 800` invariato (path Anthropic).
- **Model id Groq** (path Groq): `model: "qwen/qwen3.6-27b",` → `model: "llama-3.1-8b-instant",`
- **max_tokens Groq** (path Groq): `max_tokens: MAX_TOKENS,` → `max_tokens: MAX_TOKENS_GROQ,`
- **reasoning_effort rimosso** (path Groq): eliminato il blocco commento
  `// Spegne il reasoning: ...` (3 righe) + la riga `reasoning_effort: "none",`.
  Modello non-reasoning → parametro inutile, rischio 400.
- **Cap parole nei 3 system prompt** (`SYSTEM_PROMPTS`):
  - oggi: `Max 200 parole.` → `Max 90 parole. Vai dritto al punto: stato di oggi in una frase, poi un consiglio pratico. Niente preamboli.`
  - profilo: `Max 180 parole.` → `Max 90 parole. Sintetico: fenotipo, 1 limitatore, 1 consiglio. Niente preamboli.`
  - percorso: `Max 220 parole.` → `Max 100 parole. Sintetico: tipo di gara, punto critico, 1 consiglio di pacing, 1 di nutrizione. Niente preamboli.`

## Preservato (invariato)

- `cleanComment()` — lo strip `<think>` resta come no-op innocuo col modello non-reasoning.
- Guardie `GROQ_EMPTY_RESPONSE`, `GROQ_EMPTY_CONTENT`, `finish_reason === "length"`.
- Path Anthropic (modello, `MAX_TOKENS = 800`) e le liste "ANALIZZA in questo ordine".

## Typecheck

`npx tsc --noEmit` → **PASS** (exit 0, nessun errore).

## Deviazioni dalla spec

Nessuna.
