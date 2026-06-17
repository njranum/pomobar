# pomobar-temp

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS (build + ad-hoc sign in one step)
$ npm run sign:mac

# For Linux
$ npm run build:linux
```

### macOS ad-hoc signing

The packaged macOS build is **unsigned** (`identity: null`), and native macOS
notifications will silently fail until the bundle is signed. `npm run sign:mac`
builds the app and ad-hoc signs it in one step. To sign an existing build
manually:

```bash
$ codesign --force --deep --sign - release/mac-arm64/pomobar.app
```

The `-` identity means **ad-hoc** (no Apple Developer ID required). Verify it
took with `codesign -dvv release/mac-arm64/pomobar.app` (look for
`Signature=adhoc`).

Notes:

- Notifications do **not** fire under `npm run dev` — only from the packaged,
  signed `.app`.
- Ad-hoc signing satisfies codesign but not Gatekeeper notarization, so the
  first launch may need right-click → **Open**, or clear the quarantine flag
  with `xattr -dr com.apple.quarantine release/mac-arm64/pomobar.app`.

## Testing

Unit tests run on [Vitest](https://vitest.dev/) in the `node` environment, since
the code under test is deterministic main-process logic.

```bash
$ npm test         # run the suite once (used by CI)
$ npm run test:watch  # re-run on change during development
```

The suite (in `test/`) covers the riskiest untested logic:

- **`src/main/timer.ts`** — the state machine: initial idle state;
  start/pause/resume/cancel; focus → break → focus transitions; cycle counting
  including the deferred final-pomodoro increment and the post-long-break reset;
  elapsed-time accounting that excludes paused time; the single 20%-remaining
  warning; and the `completed` true/false paths.
- **`src/shared/validateConfig.ts`** — duration (1–120) and cycle (1–8) bounds at
  their edges and the Discord webhook validation.
- **`src/main/sessions.ts`** — session-record construction and the mapping to
  Notion properties.

`timer.ts` reads from `electron-store`, so the `./store` module is mocked with an
in-memory stub and the suite drives Vitest's fake timers — no real clock, so it
is fully deterministic and fast. The tests run in CI as part of the `validate`
job, gating merges into `main`.
