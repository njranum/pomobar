# Focus Session Lifecycle (sequence)

This traces one focus session end-to-end: the user starting it, the 250 ms tick stream,
natural completion (notifications + auto-started break + local-first session write), and
the mark-complete write-back to Notion. It's the one view that shows ordering over *time* —
in particular that `naturalComplete` fires *before* `sessionEnded`, and that the session is
written to disk before it's pushed to Notion.

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant UI as Renderer<br/>(useTimer)
    participant M as Main · ipc.ts
    participant T as timer<br/>(state machine)
    participant S as sessions.ts<br/>+ store
    participant N as Notion API
    participant X as Notifiers<br/>(macOS · Discord)

    Note over U,X: 1 — Start focus
    U->>UI: pick task, click Start
    UI->>M: invoke startFocus(task)
    alt needsPlanning()
        M-->>UI: { ok: false, reason: 'planning_required' }
    else allowed
        M->>M: activeFocusTask = task
        M->>T: startFocus(task)
        T->>T: begin focus · persist lastState
        T-)UI: push TimerSnapshot (focus)
        M-->>UI: { ok: true }
    end

    Note over U,X: 2 — Running
    loop every 250 ms
        T->>T: tick() · elapsed from Date.now()
        T-)UI: push TimerSnapshot
    end
    T-)X: nearComplete @ 80% → macOS banner

    Note over U,X: 3 — Natural completion
    T->>T: elapsed ≥ total → onSessionComplete
    T-)X: naturalComplete → "Focus complete" banner
    T-)UI: push PromptMarkComplete(task)
    T->>T: completeFocus → endSession(completed)
    T-)S: sessionEnded(record)
    S->>S: writeSession → sessions += rec, syncQueue += id
    S-)UI: push StatsUpdated
    S->>N: processSyncQueue → pages.create
    N-->>S: page.id → markSynced + dropFromQueue
    T->>T: begin shortBreak / longBreak
    T-)UI: push TimerSnapshot (break)

    Note over U,X: 4 — Mark-complete write-back
    U->>UI: click "Mark complete"
    UI->>M: invoke resolveComplete(true)
    M-)N: markTaskDone(task.id) — Status → Done (fire-and-forget)
    M->>M: activeFocusTask = null
```

**Arrow legend** — `──▶` synchronous call · `╌╌▶` invoke return (Promise resolves) ·
`──▷` async push / fire-and-forget (timer events, `webContents.send`, best-effort writes).

## Notes & alternative paths (kept off the diagram)

- **Push routing.** Every `-)` to the renderer really travels `timer` event →
  `index.ts` subscription → `broadcast.ts` (`webContents.send`) → preload `ipcRenderer.on`.
  Drawn as a direct arrow here for legibility. `onSnapshot` also repaints the tray icon
  (not shown).
- **Notifier conditions.** `naturalComplete`/`nearComplete` always raise a macOS banner;
  Discord posts only for **break** boundaries, and the `PromptMarkComplete` push only
  fires for a **focus** completion that has a task attached.
- **endEarly()** short-circuits the run: it skips to step 3's `completeFocus` path *and*
  calls `markTaskDone(task.id)` immediately (no prompt) — the write-back happens in the
  handler, not via step 4.
- **cancel()** ends the session as *not completed* → straight back to `idle`, no break,
  no write-back; `activeFocusTask` is cleared.
- **Write-back identity.** `timer.ts` never sees the Notion task id. `ipc.ts` holds
  `activeFocusTask` at module scope so `resolveComplete` / `endEarly` can resolve
  `task.id` after the session has ended.
- **Offline.** If `pages.create` throws in step 3, the record stays in `syncQueue` and is
  retried on the next launch / 5-min tick / session end (see the sync-queue lifecycle in
  `integration-connectivity.md`).
