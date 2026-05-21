# Handoff: Gymmoo · App Redesign

## Overview
Aquest paquet conté el redisseny complet de l'app **Gymmoo** (anteriorment SmartGym): home / quick-log, rutines, estadístiques, amics, perfil, més un sistema de logotip. L'objectiu és substituir l'UI actual (a `gymmoo/app/`) per aquest nou sistema visual, mantenint tota la lògica de Supabase, contexts, i hooks que ja tens.

## About the Design Files
Els arxius `.html` i `.jsx` d'aquest bundle són **referències de disseny en HTML** — prototips que mostren el look i el comportament desitjat, NO codi de producció per copiar directament. La feina és **recrear aquests dissenys al teu codebase Next.js existent** (a `gymmoo/app/`) usant els patrons que ja tens (Next App Router, Tailwind, contexts).

Els arxius `.jsx` aquí dins són React amb estils inline + Babel inline. Al teu codebase real, vols passar-ho a Tailwind classes o a un sistema com CSS Modules / styled-components segons preferència.

## Fidelity
**Hi-fi.** Colors, tipografia, spacing i interaccions estan tots definits. Recrear pixel-perfect.

---

## Design Tokens

### Color · light mode
```
--bg:         #F5F2EA   /* paper background */
--card:       #FFFFFF   /* card surface */
--card-hi:    #FBF8EF   /* warm tint surface (inputs, hover) */
--input-big:  #FFFFFF
--rule:       #E7E2D2   /* default border */
--rule-soft:  #EFEBDD   /* secondary border */

--text:       #1A1815   /* primary text */
--text-2:     #56524A   /* secondary text */
--text-3:     #8F8B81   /* tertiary / placeholder */

--accent:     #B14E2C   /* sienna · brand */
--accent-soft: rgba(177,78,44,0.13)
--accent-tint: rgba(177,78,44,0.06)
--good:       #5E8F3A   /* moss · positive */
--danger:     #A04A30
--nav-bg:     rgba(245,242,234,0.85)

--shadow: 0 1px 2px rgba(20,15,5,0.03), 0 4px 16px rgba(20,15,5,0.04);
```

### Color · dark mode
```
--bg:         #0B0A09
--card:       #15130F
--card-hi:    #1C1A15
--input-big:  #15130F
--rule:       #2A2620
--rule-soft:  #1C1A15
--text:       #FAF7F0
--text-2:     #A19C8E
--text-3:     #6B6759
--good:       #7CB35B
--shadow:     none
```

### Typography (Geist — final selected system)
```
--font-sans:    "Geist", system-ui, sans-serif         /* UI body */
--font-mono:    "Geist Mono", ui-monospace, monospace  /* tabular numerals, labels */
--font-display: "Geist", system-ui, sans-serif         /* headings */

--display-weight:     600
--heading-tracking:  -0.03em
```

Load via Google Fonts:
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### Spacing & radius
```
--radius-pill:  9999px              /* pills, tags, tab indicators */
--radius-card:  14px - 18px          /* cards, inputs */
--radius-icon:  21% of side          /* app icon (22% rounded square) */
--gap-tight:    6px
--gap-default:  8-12px
--gap-section:  16-20px
--page-padding-x: 20px
--page-padding-bottom: 110px (because of fixed bottom nav)
```

### Brand
- Brand name: **gymmoo** (moo from the cow sound — keep this story; don't draw cows)
- Wordmark style: `gym.moo.` — gym at 70% opacity, two periods in accent at full weight
- Tagline (optional): `el teu gimnàs`
- Accent: sienna `#B14E2C`

---

## Logo System

**Primary wordmark** — used in app header:
```html
<span style="font-family: Geist; font-weight: 600; letter-spacing: -0.035em;">
  <span style="opacity: 0.7;">gym</span><span style="color: #B14E2C; font-weight: 700;">.</span>moo<span style="color: #B14E2C; font-weight: 700;">.</span>
</span>
```

**Short mark** (favicons, social): `moo.` in 700 weight, letter-spacing -0.055em.

**App icon variants**: square rounded (22% radius). Recommended: sienna background with "moo." or "gm." in white at ~46% font-size.

See `logo.jsx` for all variants.

---

## Screens

### 1 · Home / Quick-Log Form (replaces `app/page.tsx`)
**Purpose:** Quick set-logging when user opens the app (out of session).

**Layout (top to bottom):**
1. **Header** — wordmark `gym.moo.` left, streak chip `🔥 12` right (animated flame)
2. **Today recap strip** — 3-col card: sèries / volum / sessió, with `+12%` delta in moss
3. **Exercise pills (scroll)** — horizontal pills with muscle tag in non-selected (e.g. `Press Banca PEC`)
4. **Variant pills** — smaller secondary pills (Barra, Mancuernes, Màquina, Politja)
5. **Weight card** — large card with `−` button, big number (56px mono, tabular), `±2.5` label, `+` button. "RÈCORD" badge appears when weight > last
6. **Reps card** — same structure but 44px number; below: 6 quick-pills (5,8,10,12,15,20). In-range pills (8,10,12 for Press Banca) get a tiny accent dot. "OBJECTIU ✓" pop badge when current reps land in range
7. **RIR row** — 5 pills (0-4) with sensation labels (fallo / molt / dur / còmode / fàcil), accent border + glow on selected
8. **1RM estimat + millor 1RM** — 2-col card row, live calculation. Estimat goes accent if > best
9. **Notes** — collapsible "+ afegir nota" link
10. **CTA** — `Anotar sèrie · 75kg × 10` with `🏆` if PR-eligible. Breathing animation when enabled
11. **Bottom tab nav** — Inici / Rutines / Estadístiques / Amics / Perfil (active = accent tint pill behind icon)

**Key animations:**
- Number ticker on weight change (220ms ease-out cubic, AnimatedNumber)
- Flip-in on reps change (280ms cubic-bezier(.34,1.56,.64,1))
- TapScale on all pills (0.94 scale on pointer-down)
- "OBJECTIU ✓" pop badge with scale-from-0 spring
- CTA breathing (2.4s ease-in-out infinite, scale 1 → 1.015)
- Save: confetti burst (22 particles, sienna + moss + white) + ribbon
- PR save: 36 particles in sienna + gold + orange + white + sparkle layer + radial accent glow on full screen + gradient ribbon with rotating star

See `quicklog.jsx` for full implementation.

### 2 · Rutines (replaces `app/rutines/page.tsx`)
**Layout:**
1. **Header** — "Rutines." display heading + "Nova" pill button right
2. **Filter pills** — Totes / Preferides / Eliminades with counts
3. **This week card** — 7 day columns; today highlighted with accent border + accent dot if there's a routine
4. **Routine cards** (stagger animation 70ms between each):
   - Name (DM-style display) + ★ favorite indicator
   - Description, muscle tags (PEC, ESP), exercise count, last done
   - Right: 7 small circular day badges (M, T, W, T, F, S, S) — active ones filled with accent
   - "En curs" tag + progress bar at bottom if routine has progress
   - Expanded state: "Continuar →" CTA + "Editar" secondary

See `routines-screen.jsx`.

### 3 · Estadístiques (replaces `app/stats/page.tsx`)
**Layout:**
1. **Header** — "Estadístiques." display heading
2. **Period segmented control** — 1 mes / 3 mesos / Tot (pill container with active state)
3. **2 KPI cards** — millora total `+52%` (moss), grups millorats `4/6` (mono large)
4. **Per muscle group** — 6 bars (Esquena, Pectoral, Cames, Espatlles, Braços, Abdominals), each with label + improvement % + animated fill bar (stagger 80ms)
5. **Volum setmanal** — 5 muscle rows with double bar (lastWeek subtle, thisWeek accent), `+9%` delta in moss
6. **Exercise history**:
   - Horizontal exercise pills (Press Banca selected)
   - 1RM evolution mini-chart (SVG line + gradient area in accent, 6 points)
   - Session cards grouped by day: "PR" badge if PR day, set chips, italic notes

See `stats-screen.jsx`.

### 4 · Amics (replaces `app/amics/page.tsx`)
**Layout:**
1. **Header** — "Amics." display heading + "feed de competició" eyebrow
2. **Search input** — magnifier icon + transparent input
3. **This-week banner** — "la Júlia va al capdavant 🥇" + "−7%" delta to top
4. **Ranking** (5 rows, stagger 60ms):
   - Medal (🥇🥈🥉) or number
   - Avatar (initials in 40px circle with brand or random color)
   - Name + flame `🔥 12` if streak active
   - Days `26/30 dies · en forma`
   - Right: consistency % (large mono) + label
   - Animated consistency bar (delay = idx*80 + 400ms)
   - Reaction buttons row (only for non-me): `🐄 Moo-tivar`, `⚡ Donar Volt`, `💉 Injectar`, `🚀 Empènyer`
   - On reaction: text badge pops in + emoji flies up/rotates (1600ms)

See `friends-profile-screens.jsx` (`FriendsScreen` export).

### 5 · Perfil (replaces `app/perfil/page.tsx`)
**Layout:**
1. **Header** — "Perfil." display heading + "tema · clar" toggle
2. **Avatar card** — 60px circle with initial "M" in accent + name + email + "editar" pill
3. **Streak + Level overall** (2-col): `12 dies 🔥` in accent + `Intermedi` with `68% cap a Avançat` and progress bar
4. **Dades** card — 4-col grid: edat / alçada / pes / sexe
5. **Per exercici** — 6 cards, each with: exercise name, level chip (color-coded: novell/grey, beginner/green, intermediate/blue, advanced/purple, elite/orange, worldclass/red), `1.27× pes corp.` ratio, right: 1RM kg value
6. **Preferències** — joined card with rows: Unitat de pes, Unitat d'alçada, Idioma, Tema
7. **Tancar sessió** button (danger color outlined)

See `friends-profile-screens.jsx` (`ProfileScreen` export).

---

## Animations · "Dopamine" toolkit

All animations live in `dopamine.jsx`. Key primitives:

- **`<AnimatedNumber value duration format>`** — tweens a numeric value with ease-out-cubic
- **`<FlipNumber value>`** — slot-machine flip-in for discrete changes (220ms cubic-bezier(.34,1.56,.64,1))
- **`<Confetti active colors count>`** — emits N particles from origin, 1.1s
- **`<Sparkles active color count>`** — soft star bursts for PR moments
- **`<TapScale>`** — wraps any clickable with 0.94 scale-on-press feedback
- **`<AnimatedBar value max color>`** — progress bar that fills with stagger delay
- **`<StreakFlame intense>`** — flickering flame emoji

Keyframes provided: `dopConf`, `dopSpark`, `dopFlip`, `dopFlame`, `dopPulse`, `dopBreathe`, `dopGlow`, `dopSlideUp`, `dopScalePop`, `dopShake`, `dopStarPop`.

Sprinkle these everywhere users *do something*:
- Logging a set → confetti + ribbon
- Hitting a PR → bigger confetti + sparkles + gradient ribbon + screen radial glow
- Adding +2.5kg → number tickers
- Tapping any pill → scale feedback
- Loading any list → stagger entry
- Friends reaction → emoji float

---

## State Management

This is a redesign, **don't rewrite the data layer**. Keep all existing:
- Supabase queries (`workout_logs`, `routines`, `routine_exercises`, `routine_sets`, `profiles`)
- `AuthContext`, `LanguageContext`, `ThemeContext`, `UnitContext`
- `useTranslation()` hook + locale JSON files
- 1RM calculation (Epley: `weight / (1.0278 - 0.0278 * reps)`)
- Streak computation
- All localStorage keys (`routine_order`, `favorite_routine_ids`, `routine_days`, etc.)

Just swap the JSX/styling layer. The components in `quicklog.jsx` etc. show the target structure — port them to use your real data from contexts and hooks.

---

## Implementation Order (suggested)

1. **Design tokens first** — update `app/globals.css` with the new color tokens, type, radius. Add `Geist` + `Geist Mono` to font loading
2. **Logo component** — create `app/components/Logo.tsx` from the wordmark spec above
3. **Bottom nav** — update `app/components/Navigation.tsx` to use new accent treatment (pill behind icon when active)
4. **Quick-log form** — refresh `app/page.tsx` (loggedout view + home logging view) using the new layout
5. **Rutines** — refresh `app/rutines/page.tsx`
6. **Stats** — refresh `app/stats/page.tsx`
7. **Amics** — refresh `app/amics/page.tsx`
8. **Perfil** — refresh `app/perfil/page.tsx`
9. **Dopamine layer** — port `dopamine.jsx` primitives to `app/components/animations/` (TapScale, AnimatedNumber, Confetti, etc.). Sprinkle in the screens above.

---

## Files in this bundle

| File | Purpose |
|---|---|
| `Gymmoo Active Session.html` | Master canvas — all artboards together |
| `quicklog.jsx` | QuickLog form (home / page.tsx) |
| `routines-screen.jsx` | Rutines list |
| `stats-screen.jsx` | Estadístiques dashboard |
| `friends-profile-screens.jsx` | Amics + Perfil |
| `logo.jsx` | Logo variants |
| `dopamine.jsx` | Animation primitives |

To preview locally: open `Gymmoo Active Session.html` in a browser. Pan/zoom the canvas; double-click an artboard's title to open fullscreen with arrow-key nav.

---

## Brand do's & don'ts

✅ Use `gym.moo.` wordmark for headers (with both periods in accent)
✅ Sienna `#B14E2C` only for: active state, PR, CTA, accent in tabs, brand period
✅ Keep all numbers in `Geist Mono` for tabular alignment
✅ Generous radii (14-18px on cards, 999 on pills)

❌ No cow drawings — the brand lives in the type
❌ No gradients on backgrounds (only on the PR ribbon)
❌ No new accent colors — use moss `#5E8F3A` for positive delta, sienna for brand, that's it
❌ Don't break tabular numerals in stats/inputs
