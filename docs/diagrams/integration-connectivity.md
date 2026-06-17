# External Integrations & Connectivity

pomobar talks to three external systems, and **pomobar is always the client/initiator** —
nothing calls *in*. Notion is request/response (reads *and* writes); Discord and macOS
are fire-only. This doc covers the connectivity map, the reliability mechanism behind
Notion session writes (the sync queue), and the two-ID-type gotcha that the API surface
depends on.

---

## 1. Connectivity overview — what crosses the boundary

```mermaid
flowchart LR
    subgraph APP["pomobar · main process"]
        direction TB
        NOTION["notion.ts<br/>(lazy Client singleton)"]
        SESS["sessions.ts<br/>+ sync queue"]
        DISCORD["discord.ts"]
        NOTIF["notification.ts"]
    end

    subgraph WS["Notion workspace"]
        direction TB
        TASKS[("DB Focus Tasks")]
        SESSIONS[("DB Sessions")]
        PLANNING[("DB Planning")]
    end

    DWH(["Discord webhook"])
    MAC(["macOS Notification Center"])

    NOTION -->|"read scheduled tasks · mark done"| TASKS
    SESS   -->|"create session rows (via queue)"| SESSIONS
    NOTION -->|"today's planning row · goals · tasks"| PLANNING
    DISCORD -->|"POST JSON · retry ≤3 (2s/4s backoff)"| DWH
    NOTIF   -->|"native banner (signed builds only)"| MAC
```

Auth: `notion.ts` holds a lazy `Client` singleton built from `notionSecret`. That secret
(and `notionTargets`) is **blocked from `store:get`** so the renderer can never read it —
all Notion traffic stays in the main process.

---

## 2. Session sync-queue lifecycle (local-first durability)

Sessions are never lost to a flaky network: a record is written to disk *first* and
queued, then pushed to Notion on the next trigger. Failures simply stay queued.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif','lineColor':'#94a3b8'}}}%%
stateDiagram-v2
    direction LR

    [*] --> pending_sync : session ends → buildRecord()<br/>writeSession(): store.sessions += rec<br/>syncQueue += rec.id

    pending_sync --> synced : processSyncQueue()<br/>pages.create OK → markSynced(pageId) + dropFromQueue
    pending_sync --> pending_sync : pages.create throws<br/>→ left in queue, retried later

    synced --> [*]

    note right of pending_sync
        processSyncQueue() fires on:
        • app launch
        • every 5 minutes
        • after each sessionEnded
    end note

    classDef pending fill:#f59e0b,stroke:#b45309,color:#ffffff
    classDef synced fill:#16a34a,stroke:#15803d,color:#ffffff

    class pending_sync pending
    class synced synced
```

The renderer surfaces a faint `●` dot whenever `syncQueue.length > 0` (`sync:pendingGet`).

---

## 3. The two Notion ID types (the M2 gotcha)

The internal `@notionhq/client` uses **two different IDs** for the same database, and the
wrong one silently fails. Setup resolves both up front:

```mermaid
flowchart TB
    URL["Notion DB URL / pasted ID"]
    URL -->|"extractNotionId()"| PAGE["Page UUID"]
    PAGE -->|"databases.retrieve()<br/>→ data_sources[0].id"| COLL["Collection UUID<br/>(data source id)"]

    PAGE -. "consumed by" .-> PUSE["pages.create()<br/>pages.update()<br/>databases.retrieve()"]
    COLL -. "consumed by" .-> CUSE["dataSources.query()"]
```

| Stored / runtime value | ID type | Consumed by |
|------------------------|---------|-------------|
| `notionTargets.tasksDbId` | **Collection UUID** (resolved at setup) | `dataSources.query` → `fetchScheduledTasks` |
| `notionTargets.sessionsDbId` | **Page UUID** (raw) | `pages.create` → session sync |
| `planningDbId` | **Page UUID** (raw) | `pages.create` / `pages.update`; resolved to a collection UUID on demand for `dataSources.query` |
| a task's `page.id` | **Page UUID** | `pages.update` → `markTaskDone` |

> **Rule:** `dataSources.query` needs the **collection UUID**; everything else
> (`pages.*`, `databases.retrieve`) needs the **page UUID**. Mixing them up was the M2
> bug. Also note **DB Focus Tasks `Status` is a `select`, not a `status`** property —
> filter/update with `{ select: { … } }`.

---

## Per-database call reference

| Database | Calls | ID used |
|----------|-------|---------|
| **DB Focus Tasks** | `dataSources.query` (Status ≠ Done/Abandoned, Scheduled ≤ today or empty); `pages.update` (Status→Done + Completed Date) | collection UUID (query) · page UUID (update) |
| **DB Sessions** | `pages.create` (Name, Date, Start/End, Duration mins, Type, Cycle #, Completed, Task relation) | page UUID |
| **DB Planning** | `dataSources.query` (find today's row); `pages.create` (new row); `pages.update` (Pomodoro Goal); `pages.retrieve` (goals + Tasks to Complete) | collection UUID (query) · page UUID (page ops) |

Discord (`sendDiscord`) POSTs `{ content }` and retries up to 3 times with a 2 s × attempt
backoff on any non-OK response or network error; a missing webhook URL is a silent no-op.
