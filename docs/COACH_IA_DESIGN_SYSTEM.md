# Coach IA — Design System (Aurora / Sport Performance)

Direzione visiva attuale: **dark glass, sport performance, telemetria violetto/blu/oro**.
Questo file resta la fonte unica dei token.

## 1. Principio

- **Dark sportivo**, non nero piatto: base molto scura con bagliori ambientali controllati.
- **Violetto Aurora = identità e azione.** Usato per brand, call-to-action, Forma/CTL e trend in crescita.
- **Blu = Fatica/ATL e dati di carico.**
- **Oro = Freschezza/TSB.**
- **Verde/giallo/rosso readiness** restano stati funzionali. Le zone allenamento possono usare scala propria quando serve, sempre etichettata.
- **Readiness al centro.** L'orb visualizza Forma, Fatica e Freschezza intorno alla decisione del giorno.
- Glass effect ammesso ma sobrio: blur, bordi sottili, niente neon aggressivo.

## 2. Palette

### Sfondi

| Token | Valore | Uso |
|---|---|---|
| `bg-base` | `#0A0C10` | sfondo pagina |
| `bg-surface` | `rgba(255,255,255,.055)` | card glass |
| `bg-surface-2` | `rgba(255,255,255,.09)` | hover, tab, elementi attivi |
| `bg-border` | `rgba(255,255,255,.10)` | bordi sottili |

### Testo

| Token | Hex | Uso |
|---|---|---|
| `text-primary` | `#FFFFFF` | titoli, numeri, testo principale |
| `text-secondary` | `#AEB9C2` | testo corpo |
| `text-muted` | `#7E8B96` | label e metadati |
| `text-faint` | `#5E6B76` | hint e assi grafici |

### Identità e telemetria

| Token | Valore | Uso |
|---|---|---|
| `brand` / `amber` | `#A78BFA` | brand, CTA, Forma/CTL |
| `brand-hover` / `amber-hover` | `#C4B5FD` | hover CTA |
| `brand-dim` / `amber-dim` | `rgba(167,139,250,.16)` | highlight violetto |
| `accent-blue` | `#4FA3E0` | Fatica/ATL |
| `accent-blue-dim` | `rgba(79,163,224,.16)` | highlight blu |
| `accent-gold` | `#FFC24D` | Freschezza/TSB |
| `accent-gold-dim` | `rgba(255,194,77,.16)` | highlight oro |

### Readiness

| Stato | Colore | Bordo |
|---|---|---|
| GO | `#5BE89A` | `rgba(91,232,154,.32)` |
| MODIFY | `#FFC24D` | `rgba(255,194,77,.34)` |
| SKIP | `#FF6855` | `rgba(255,104,85,.34)` |

### Zone Allenamento

| Zona | Colore |
|---|---|
| Z1 Recupero | `#8C99A5` |
| Z2 Endurance | `#4FA3E0` |
| Z3 Tempo | `#36C77E` |
| Z4 Soglia | `#F2B33D` |
| Z5+ VO2Max | `#F2553D` |

## 3. Tipografia

- Display/UI: `Archivo`, fallback system.
- Numeri e micro-label: `IBM Plex Mono`, fallback monospace.
- Numeri principali: 28-50px, peso 600-800.
- Label tecniche: 10-12px, uppercase, letter spacing `.08em`-`.14em`.

## 4. Componenti

- **Card glass:** `bg-surface`, bordo `bg-border`, `backdrop-filter: blur`, raggi 20-32px.
- **Orb readiness:** decisione al centro, anelli radar, sweep animato, chip Forma/Fatica/Freschezza.
- **Grafico trend:** linee smussate CTL/ATL/TSB, area sfumata sotto Forma, tooltip glass interattivo.
- **Metriche:** card separate, numero mono, stato/trend sotto.
- **CTA primaria:** violetto `brand`, testo `brand-on`.
- **Header:** sticky, glass, nav pill con icone, tab attivo violetto.

## 5. Regole

- Non inventare token fuori da questo file.
- Readiness sempre più importante di ogni altro dato.
- Non usare rosso/giallo/verde readiness come decorazione generica.
- Le animazioni devono rispettare `prefers-reduced-motion`.
- Mantieni contrasto alto e tap target almeno 40px.
