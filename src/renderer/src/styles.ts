// Canonical text + control styles — the single source of truth for every screen.
// Mirrors the typography scale in docs/design-spec.md. Define each style ONCE here
// and import it; never hand-roll a size/weight/colour in a component.

// Section / group headers: "Today", "Today's plan", "Scheduled", "Settings" title.
export const SECTION_HEADER =
  'text-[11px] font-medium uppercase tracking-[0.4px] text-label-tertiary'

// Body / list labels: task titles, settings row labels, prompt text. 13px / 400 / label.
export const BODY = 'text-[13px] text-label'

// Secondary text: dates, values, streak line, "Focus · 1 of 4". 11px / 400 / secondary.
export const SECONDARY = 'text-[11px] text-label-secondary'

// Accent links: "← Back", "Reconnect", "Connect".
export const LINK = 'text-[13px] text-accent'

// Buttons share one size + weight. Compose with a fill below.
const BTN = 'text-[13px] font-medium'

// Primary (accent) button — Save, Start session, Plan my day, Validate & save…
export const BTN_PRIMARY = `${BTN} rounded-md bg-accent px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40`

// Subtle (fill) button — Pause / Cancel / End & complete / Yes / No. Set the text
// colour per role at the call site (text-label / text-danger / text-accent / …).
export const BTN_SUBTLE = `${BTN} rounded-md bg-fill px-3 py-2 hover:bg-fill-hover`

// Compact macOS-style number field (settings).
export const NUMBER_FIELD =
  'w-12 rounded border-[0.5px] border-separator bg-fill px-1.5 py-0.5 text-right text-[12px] tabular-nums text-label'

// Text input field (wizard / discord setup).
export const TEXT_FIELD = `${BODY} rounded border-[0.5px] border-separator bg-fill px-2 py-1`
