# pomobar — Visual Redesign Spec

> Goal: make pomobar look like a native macOS menu bar app — as though it were
> designed by Apple's HIG team. Clean, quiet, polished. This is a **presentation
> redesign only**. Do not change timer logic, IPC, the state machine, electron-store,
> or any behaviour. Only touch styling, markup, and the window's visual material.

---

## Design principles

1. **It lives in the menu bar.** It should feel at home beside Control Center and the
   Wi-Fi/volume popovers — not like a web page in a window.
2. **Restraint over decoration.** One accent colour. No gradients, no drop shadows,
   no patterns, no borders-on-everything. Spend all the polish in one place (the timer ring).
3. **Hierarchy through type and spacing**, not boxes and colour.
4. **Quiet by default, clear on action.** Selection and the primary button are the only
   loud things on screen.

---

## The material (biggest single lever — do this first)

Real menu bar popovers use the macOS vibrancy material (frosted translucency), not a flat
dark fill. Set this on the popover `BrowserWindow` in the main process:

```ts
new BrowserWindow({
  // ...existing options...
  transparent: true,
  backgroundColor: '#00000000',
  vibrancy: 'popover', // macOS frosted material
  visualEffectState: 'active', // stay frosted even when the app isn't focused
})
```

Then the renderer root must be transparent (or only lightly tinted) so the vibrancy shows
through. Remove any opaque dark `background` on `<body>` / the root container.

> ⚠️ Watch the close-on-blur behaviour. `transparent: true` + vibrancy can interact with
> existing window options. If the popover stops closing on blur, or the corners go wrong,
> revert `transparent` and instead use a translucent dark fill (`rgba(28,28,30,0.72)`) with
> `backdrop-filter: blur(30px)` on the root — it's a close-enough fallback. Test this in
> isolation before doing anything else.

---

## Design tokens (dark appearance)

Add these to the Tailwind theme (`tailwind.config` `theme.extend`) so they're reusable.
These are the macOS dark system values.

| Token             | Value                    | Use                                                           |
| ----------------- | ------------------------ | ------------------------------------------------------------- |
| `accent`          | `#0A84FF`                | selection, progress, primary button, links                    |
| `danger`          | `#FF453A`                | destructive text, overdue dates — **text only, never a fill** |
| `label`           | `rgba(255,255,255,0.92)` | primary text                                                  |
| `label-secondary` | `rgba(255,255,255,0.55)` | values, dates, captions                                       |
| `label-tertiary`  | `rgba(255,255,255,0.30)` | section headers, disabled                                     |
| `fill`            | `rgba(255,255,255,0.08)` | subtle control backgrounds                                    |
| `fill-hover`      | `rgba(255,255,255,0.12)` | hover state on subtle controls                                |
| `separator`       | `rgba(255,255,255,0.10)` | hairline dividers                                             |
| `track`           | `rgba(255,255,255,0.12)` | progress-bar tracks                                           |

Font stack (renders as SF Pro on macOS):
`-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`

---

## Typography scale

| Role                   | Size | Weight | Notes                                               |
| ---------------------- | ---- | ------ | --------------------------------------------------- |
| Timer (active)         | 30px | 500    | `font-variant-numeric: tabular-nums`                |
| Settings heading       | 17px | 600    |                                                     |
| Task title / body      | 13px | 400    |                                                     |
| Buttons                | 13px | 500    |                                                     |
| Stats / values / dates | 11px | 400    | secondary colour                                    |
| Section header         | 11px | 500    | uppercase, `letter-spacing: 0.4px`, tertiary colour |

All numbers (timer, counts, dates, durations) use `tabular-nums`. Sentence case everywhere.

---

## Spacing

- 8px grid. Window padding: 12px.
- Task/list row: ~7px vertical padding, 10px horizontal, 6px radius.
- Buttons: ~8px vertical padding, 6px radius.
- Generous but not loose — match the mockup's density.

---

## Component specs

### Popover chrome

- **Remove the "PomoApp" title and the contour-line background entirely.**
- Top row: small day-summary text on the left (`5 sessions · 48m · 1-day streak`),
  settings cog icon on the right. That's it.

### Stats / goals

- Replace the chunky green/grey bars with **4px-tall rounded bars**.
- Track = `track` token; fill = `accent`. (Optionally turn the fill green only when a
  goal is met — otherwise keep it blue.)
- Label on the left, `value / target` right-aligned, both 11px secondary.

### Task list

- Rows, **not** outlined boxes. No per-item borders.
- Selected row: solid `accent` background, white text, 6px radius.
- Unselected: transparent; hover = `fill`.
- Date right-aligned, 11px secondary; overdue dates use `danger` text.
- Section headers (`Today's plan`, `Scheduled`) use the section-header type style above.

### Primary button (Start session)

- Full width, solid `accent` fill, white text, 13px/500, 6px radius.
- Disabled state = same button at ~40% opacity (`opacity-40 cursor-not-allowed`),
  **not** a different dark colour. Keep one button identity across states.

### Active session

- Add a **circular progress ring** (SVG): track circle + accent arc, rounded line caps,
  6px stroke. Time in the centre at 30px/500 tabular; below it a small secondary line
  (`Focus · 5 of 9`). Task title under the ring in 12px secondary.
- The arc represents time elapsed/remaining in the current session.

### Session controls — redo the three-slab screen

- **Drop the bordered box and the three equal coloured slabs.**
- Layout: one wide **Pause** button (subtle `fill` background, label colour), then a row
  of two smaller buttons beneath — **Cancel** (`danger` text on `fill` at 0.06) and
  **End & complete** (`accent` text on `fill` at 0.06).
- The destructive action is the least prominent thing, not the loudest.

### Settings screen

- Keep the `← Back` link in accent.
- Form rows: label on the left, a compact macOS-style number field on the right
  (subtle `fill` background, 0.5px inset border `separator`, 6px radius, right-aligned).
- **Save** = accent primary button (same identity as Start session). Consider whether
  it should autosave instead, but that's optional and out of scope for the reskin.
- Connection rows: tidy list — `Notion` / green check / `Connected` in secondary, with a
  `Reconnect` accent link right-aligned. Same for Discord.

---

## What to remove

- The "PomoApp" title.
- The contour-line / topographic background texture.
- All per-item outline borders on tasks and inputs (replace with fills/selection).
- Saturated full-colour button slabs (red, green, white).
- The border box wrapping the session controls.

---

## What NOT to touch

- Timer state machine, cycle counting, timekeeping.
- IPC channels and handlers.
- electron-store schema and persistence.
- Notion / Discord integration logic.
- The task-picker interface contract (`TaskRef`) — only restyle its rendering.

This is purely how it looks. If a change would require touching behaviour, stop and flag it.
