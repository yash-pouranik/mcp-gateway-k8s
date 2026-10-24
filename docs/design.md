# VYNN MCP Gateway — Design System Specification

## 1. Design Philosophy & Aesthetic
VYNN follows a **Dark Industrial Minimalist** design language inspired by modern developer platforms like Cloudflare, Vercel, and Linear.

- **Background Tone:** Deep obsidian / pitch black (`#000000`) providing high contrast.
- **Surface Elevation:** Subtle layered zinc cards (`#09090b` for primary cards, `#18181b` for sub-cards and inputs, `#1f1f23` for hover surfaces).
- **Primary Accent:** Cloudflare Orange (`#f38020`), symbolizing speed, routing, and developer connectivity.
- **Border Hierarchy:** Muted hairline borders (`#27272a`) to delineate sections without visual noise.
- **Typography:** Crisp humanist sans-serif (`Inter`) paired with code-grade monospace (`JetBrains Mono`).

---

## 2. Color Palette System

| Token | Hex Value | Tailwind Class | Usage |
| :--- | :--- | :--- | :--- |
| **Canvas** | `#000000` | `bg-black` | Main page background |
| **Card Surface** | `#09090b` | `bg-zinc-950` | Primary container cards, dialogs, modals |
| **Input & Inner** | `#18181b` | `bg-zinc-900` | Input fields, inner panels, code containers |
| **Sub-element** | `#1f1f23` | `bg-zinc-850` | Sub-toolbars, elevated hover layers |
| **Border Muted** | `#27272a` | `border-zinc-800` | Standard hairline card & divider borders |
| **Border Active** | `#3f3f46` | `border-zinc-700` | Hover states, active input borders |
| **Text Primary** | `#f4f4f5` | `text-zinc-100` | Headings, primary labels, active buttons |
| **Text Secondary** | `#a1a1aa` | `text-zinc-400` | Descriptions, secondary metadata, hints |
| **Text Muted** | `#71717a` | `text-zinc-500` | Monospace tags, timestamps, icons |
| **CF Orange** | `#f38020` | `bg-cf-orange` | Primary CTAs, active tab accents, key badges |
| **CF Orange Hover**| `#fa8c16` | `hover:bg-cf-hover` | Button hover state |
| **CF Orange Glow** | `rgba(243,128,32,0.15)` | `bg-cf-glow` | Subtle badge backgrounds, selection highlights |
| **Success Emerald**| `#10b981` | `text-emerald-400` | Connected state, approved tools, active keys |
| **Danger Rose** | `#f43f5e` | `text-rose-400` | Destructive confirmations, auth errors |

---

## 3. Typography & Scaling

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
```

- **Brand Header:** 16px / SemiBold (`text-base font-semibold tracking-tight`)
- **Section Title:** 18px / SemiBold (`text-lg font-semibold tracking-tight`)
- **Body & Labels:** 12px / Medium (`text-xs font-medium`)
- **Microcopy / Badges:** 10px / Mono (`text-[10px] font-mono tracking-wide`)

---

## 4. Component Patterns

### A. Brand Mark & Header
- **Logo Container:** `w-10 h-10 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center`
- **Logo Asset:** `/vynn_ai_logo.png` (object-contain)
- **Title Block:** `VYNN / MCP Gateway` with an inline `k8s` pill badge (`text-[10px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800 rounded px-1.5 py-0.5`).

### B. Form Inputs
- **Container:** `relative w-full`
- **Field:** `w-full pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-700`
- **Leading Icon:** `absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-500`

### C. Buttons
- **Primary CTA:** `bg-cf-orange hover:bg-cf-hover active:bg-cf-dark text-white font-medium text-xs py-2 px-3 rounded shadow-sm transition`
- **Secondary / Deny:** `bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white font-medium text-xs py-2 px-3 rounded transition`

### D. Permission / Scope Cards
- Boxed in `bg-zinc-900 border border-zinc-800 rounded-lg p-3.5`
- Scope tags in emerald (`bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`) and blue (`bg-blue-500/10 text-blue-400 border border-blue-500/20`).

---

## 5. OAuth Consent & Authorization Screen
The OAuth authorization screen (`/oauth/authorize`) is rendered server-side as standalone HTML to support web-based OAuth clients (Claude Web, ChatGPT Web, mobile browsers). It must strictly reflect the exact styling tokens above:
1. Pure pitch-black canvas (`#000000`).
2. Centered card in `#09090b` with `#27272a` hairline border and subtle orange brand glow.
3. Official logo mark and `k8s` pill.
4. Requesting application banner (`Client Name`).
5. Granular permissions checklist.
6. Email & password inputs with leading Lucide SVG icons.
7. Two-column action bar: `Deny` (neutral) and `Allow Access` (Cloudflare Orange).
8. Footer with secure verification stamp.
