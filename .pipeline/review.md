# Review — Commenti AI: modello Groq economico + commenti più brevi

Branch: `feature/auto-refresh-oggi` (uncommitted). Single-file diff: `lib/ai/groq-provider.ts`.
Reviewer pass over spec.md, changes.md, test-results.md, the full edited file, and `git diff HEAD`.
Groq model id cross-checked live against https://console.groq.com/docs/models (WebFetch reachable).

## VERDICT: APPROVE

The diff is exactly what the spec ordered — nothing more, nothing less. Model
id is valid and current, dropping `reasoning_effort` is correct for a
non-reasoning model, the 350-token Groq cap has comfortable headroom for ~90-100
word output, and every preservation guarantee holds. No blockers, no
should-fixes. Two nits below, neither worth a second round.

---

## Correctness — CORRECT

- **Spec match:** the diff is byte-for-byte what spec §EDITS 1–5 describe.
  `MAX_TOKENS_GROQ = 350` added (`:48`), Anthropic `MAX_TOKENS = 800` untouched
  (`:46,:103`), model → `llama-3.1-8b-instant` (`:150`), `max_tokens` → the new
  Groq cap (`:151`), `reasoning_effort` block removed (4 lines gone), 3 word caps
  shortened (90/90/100). Header JSDoc updated to match. No deviations.
- **Model id is valid + current:** Groq docs confirm `llama-3.1-8b-instant` is a
  production model, non-reasoning, $0.05/M in · $0.08/M out, 131k context.
  Matches the spec's claim exactly.
- **Dropping `reasoning_effort` is correct, not just safe:** it's a reasoning-only
  param. A non-reasoning model would at best ignore it and at worst 400. Removing
  it eliminates the risk at the root and kills the old `<think>`/empty-content
  failure mode the qwen path had.
- **350-token headroom confirmed:** ~90 words IT ≈ 130–180 tokens, ~100 words ≈
  ~200. 350 leaves roughly 2x headroom over the largest cap — comfortable, no
  routine truncation expected. The `finish_reason === "length"` guard
  (`:172-174`) still logs a warning if it ever does hit the cap. Headroom + log
  both intact.

## Token / cost goal — MET (with one honest caveat)

- **Output cost:** drops hard. Smaller model ($0.08/M out vs qwen's higher tier),
  lower `max_tokens` (350 vs 800), and shorter word caps that actually shrink
  generated length. Real reduction, as the spec intends.
- **Input cost caveat (NICE-TO-HAVE):** the prompts still carry the long
  "ANALIZZA in questo ordine" lists (5–7 points) + the multi-line "CONSIGLI
  CONCRETI" examples. Those are INPUT tokens billed on every call and they're the
  bulk of the prompt now. The word caps shrink *output*, not input. So input cost
  is largely unchanged. This is a known, deliberate trade — spec §EDITS 5 makes
  the **cap-first, trim-only-if-needed** call explicitly (the `ponytail:` note),
  and at $0.05/M input on an 8b model the absolute input cost is tiny. Correct to
  defer. Flagging only so the second-round trim (lists → 3 points) is on record
  if comments still come back long.

## Regression risk — LOW

- **Anthropic path untouched:** model, `MAX_TOKENS = 800`, system prompts'
  structure, `cleanComment` call — all unchanged (`:95-127`). Verified in diff.
- **Guards intact:** `GROQ_EMPTY_RESPONSE` (`:164`), `GROQ_EMPTY_CONTENT`
  (`:169`), `finish_reason === "length"` warn (`:172`), and `cleanComment`
  (`:133`, called at `:113` and `:175`) all present and unmodified.
- **No stale references repo-wide:** grepped `qwen`, `qwen3`, `reasoning_effort`
  across the tree. Zero hits except one — the descriptive comment in
  `cleanComment`'s docstring (`:130`, "...reasoning model (qwen)..."). It's prose,
  not an active model id or API param. `cleanComment`'s `<think>` strip becomes a
  harmless no-op with a non-reasoning model (it still strips markdown asterisks,
  which is still wanted). Innocuous. (See NIT below.)
- **Consumers are provider-agnostic:** the 3 routes (`comments/{oggi,profilo,
  percorso}/route.ts`) import only `generateComment`/`isAIConfigured`, never the
  model id or the Groq function directly. Nothing downstream is coupled to the
  swapped model. No caller needs updating.

## Over-engineering / laziness (ponytail lens) — CLEAN

- Diff is minimal and surgical: one constant added, three values changed, four
  lines deleted, three prompt caps reworded. Nothing speculative, no new module,
  no abstraction. The separate `MAX_TOKENS_GROQ` constant (vs reusing the shared
  800) is the right call — it keeps the Anthropic path provably unchanged.
- Lists left in place per the spec's explicit cap-first decision — that IS the
  lazy-correct move (don't rewrite prompts on a guess; cap first, measure, trim
  only if needed).
- Nothing missing for the stated scope.

## Nits (non-blocking)

- **NIT** — `cleanComment` docstring (`:130`) still says "reasoning model (qwen)".
  Stale wording now that qwen is gone. One-word fix ("...reasoning model..." or
  drop the parenthetical) next time the file is touched. Zero functional impact.
- **NIT** — `cleanComment`'s two `<think>` regex replaces are now dead paths for
  the Groq route (model never emits `<think>`). Harmless and they still protect the
  Anthropic path's markdown strip; not worth removing. Noting for completeness.

## What's good

Textbook minimal change. Spec, changes log, and tests all agree; the one model
fact that mattered (id validity + non-reasoning) was verified against the live
Groq docs and holds. Guards and the Anthropic path are demonstrably untouched.
The single real trade-off (input tokens unchanged) was made consciously and
documented. Ship it.
