# Coach IA — Design System (Dark Premium / Ambra)

Direzione visiva approvata: **dark premium, accento ambra, colori semaforici per la readiness.**
Questo file è la fonte unica dei token. Ogni pagina deve derivare i colori da qui, nessun valore inventato altrove.

---

## 1. Principio

- **Sfondo scuro caldo**, non nero puro (il nero puro è freddo e generico).
- **Ambra = identità di brand.** Usata con parsimonia: logo, valori chiave, azioni primarie, accenti. Mai per grandi superfici.
- **Verde / giallo / rosso = solo readiness e stati funzionali.** Il colore semaforico è *informazione*, non decorazione. Non usarlo per estetica.
- **I dati sono i protagonisti.** Numeri grandi, alto contrasto, molto respiro. Niente glass effect, niente gradienti pesanti, niente ombre drammatiche: l'app si usa ogni giorno, deve restare leggibile e riposante.
- Coerenza totale tra le pagine: stesso header, stessi raggi, stessa spaziatura.

---

## 2. Palette (valori esatti)

### Sfondi
| Token | Hex | Uso |
|---|---|---|
| `bg-base` | `#16130E` | sfondo pagina (marrone-carbone caldo) |
| `bg-surface` | `#1C1810` | card, pannelli |
| `bg-surface-2` | `#221E16` | elementi attivi, hover, tab selezionato |
| `bg-border` | `#262219` | divisori, bordi interni |

### Testo
| Token | Hex | Uso |
|---|---|---|
| `text-primary` | `#F5F2EC` | titoli, numeri, testo principale |
| `text-secondary` | `#B8B2A6` | sottotitoli, testo corpo |
| `text-muted` | `#9A9488` | label, metadati |
| `text-faint` | `#6B665C` | hint, note, caption |

### Accento ambra (brand)
| Token | Hex | Uso |
|---|---|---|
| `amber` | `#F59E0B` | accento primario, bottoni, valori chiave |
| `amber-hover` | `#E08E07` | hover su bottoni ambra |
| `amber-dim` | `rgba(245,158,11,.12)` | sfondo tenue per badge/highlight ambra |

Testo su bottone ambra: **`#16130E`** (lo sfondo base scuro), mai bianco.

### Semaforico readiness (SOLO per stato)
| Stato | Colore | Bordo card | Uso |
|---|---|---|---|
| GO | `#22C55E` | `rgba(34,197,94,.35)` | readiness verde |
| MODIFY | `#EAB308` | `rgba(234,179,8,.35)` | readiness gialla |
| SKIP | `#EF4444` | `rgba(239,68,68,.35)` | readiness rossa |

Le card readiness hanno una barra laterale di 3px del colore di stato + bordo sottile dello stesso colore semitrasparente.

---

## 3. Layout e forme

- Raggi: card grandi `16px`, card interne/metriche `11px`, bottoni `9px`, input `9px`.
- Spaziatura verticale: ritmo a `1rem / 1.25rem / 1.5rem / 1.75rem`.
- Padding card: `1.5rem` per le grandi, `0.9rem` per le metriche.
- Header app: logo ambra (quadrato 28px, raggio 7px, lettera "C" su sfondo ambra) + "Coach IA" + nav a destra (Oggi / Profilo / Piano), tab attivo con `bg-surface-2`.
- Larghezza contenuto: max ~960px centrata su desktop, padding laterale su mobile.

## 4. Tipografia

- Numeri e titoli: peso 500-700, `text-primary`.
- Readiness (GO/MODIFY/SKIP): 42px, peso 700, colore di stato.
- Metriche (CTL, ATL...): valore 22px peso 500, label 11px uppercase `text-muted` letter-spacing .06em.
- Corpo: 14px, `line-height` 1.6, `text-secondary`.
- Mai ALL CAPS se non micro-label (uppercase + letter-spacing su label da 11-12px).

## 5. Componenti chiave

- **Bottone primario:** sfondo `amber`, testo `#16130E`, raggio 9px, hover `amber-hover`. Icona Tabler opzionale a sinistra.
- **Bottone secondario:** trasparente, bordo `0.5px` `bg-border`, testo `text-secondary`, hover `bg-surface-2`.
- **Card metrica:** `bg-surface`, raggio 11px, label uppercase muted + valore grande. Valori "chiave" (es. TSB) in ambra.
- **Card readiness:** `bg-surface`, barra laterale 3px colore stato, bordo stato semitrasparente, label uppercase + valore enorme colorato + frase di spiegazione.
- **Riga lista (attività/sedute):** nome `text-primary` 14px peso 500, metadati `text-faint` 12px, valore a destra in ambra. Divisori `bg-border` 0.5px.
- **Input/form:** sfondo `bg-surface`, bordo `0.5px bg-border`, testo `text-primary`, focus ring ambra sottile. Label sopra in `text-muted` 13px.
- **Tab toggle:** contenitore `bg-surface`, tab attivo `bg-surface-2` + testo `text-primary`, inattivo `text-muted`.

## 6. Regole ferme

- Dark mode è l'unico tema (no toggle chiaro per ora).
- L'accento ambra non si usa mai per testo lungo, solo per accenti e numeri chiave.
- Il colore semaforico non si usa mai fuori dal contesto readiness/stato.
- Niente gradienti, glass/blur, ombre colorate, neon.
- Contrasto AA minimo su tutto il testo (verificare text-secondary su bg-surface).
- Accessibilità: focus visibile (ring ambra), `prefers-reduced-motion` rispettato, tap target ≥ 40px.
- Ogni pagina riusa lo stesso header e lo stesso contenitore.
