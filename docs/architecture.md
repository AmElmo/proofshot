# Architecture

How ProofShot works under the hood, and why it's built the way it is.

## Overview

```
┌──────────────┐     shell commands      ┌───────────────┐     CLI calls     ┌──────────────────┐
│  AI Coding   │ ──────────────────────► │   ProofShot   │ ───────────────► │  agent-browser   │
│    Agent     │                         │     CLI       │                   │  (Rust + Node)   │
│              │  "proofshot start"       │               │  "ab open ..."   │                  │
│  Claude Code │  "proofshot exec ..."   │  session mgmt │  "ab click ..."  │  Chromium daemon │
│  Cursor      │  "proofshot stop"       │  video trim   │  "ab screenshot" │  video recording │
│  Codex       │                         │  error detect  │                  │  element refs    │
│  OpenCode    │                         │  artifact gen  │                  │                  │
│  Gemini CLI  │                         │  artifact gen  │                  │                  │
│  Windsurf    │                         │               │                   │                  │
└──────────────┘                         └───────────────┘                   └──────────────────┘
```

ProofShot is a thin orchestration layer between AI coding agents and a browser. The agent calls ProofShot CLI commands via shell. ProofShot manages session state, logging, and artifact generation, delegating all browser work to [agent-browser](https://github.com/vercel-labs/agent-browser).

## Why agent-browser?

The choice of agent-browser as the browser automation layer is the most important architectural decision in ProofShot.

**Agent-agnostic by design.** agent-browser exposes a CLI interface (`agent-browser open`, `agent-browser click @e3`). Any AI agent that can run shell commands can drive it. This is what makes ProofShot work with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, and Windsurf without custom integrations for each.

**Persistent daemon.** agent-browser runs a Node.js daemon that maintains browser state across CLI calls. This means `proofshot exec click @e3` and the next `proofshot exec screenshot step.png` operate on the same browser tab and page state. Without this, each command would need to reconnect to the browser.

**Stable element references.** The `@eN` ref system (`@e1`, `@e2`, etc.) provides stable handles to interactive elements. An agent takes a snapshot, sees `@e3: Submit button`, and can target it reliably. This is far more robust than CSS selectors or XPath for AI-driven interaction.

**Lightweight context.** agent-browser's snapshot output is ~93% smaller than Playwright MCP's equivalent. This matters because AI agents have context limits — smaller snapshots mean more room for reasoning.

**Built-in recording.** Playwright's screencast API is exposed directly, so video recording comes free without ffmpeg during capture (ffmpeg is only used for optional post-processing trim).

All browser commands in ProofShot go through a single function:

```typescript
// src/utils/exec.ts
export function ab(command: string, timeoutMs = 30000): string {
  return execSync(`agent-browser ${command}`, {
    encoding: 'utf-8',
    timeout: timeoutMs,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}
```

## Session lifecycle

ProofShot uses a three-phase model: **start**, **exec** (repeated), **stop**.

### Start

```
proofshot start --run "npm run dev" --port 3000 --description "Login flow"
```

1. Check if port is already occupied (fail fast if `--run` conflicts)
2. Spawn dev server as a detached process, pipe stdout/stderr to `server.log`
3. Wait for port to become available (polls every 500ms, 30s timeout)
4. Open headless Chromium via agent-browser
5. Start video recording (Playwright screencast → `.webm`)
6. Write `.session.json` to the artifacts directory

Recording is mandatory. If it fails after 3 retries, the session aborts. Video proof is the whole point.

### Exec

```
proofshot exec click @e3
proofshot exec screenshot step-login.png
```

Each `exec` call:

1. Loads `.session.json`, validates recording is active
2. For click/fill/type actions targeting `@eN` refs: captures element bounding box and label *before* execution (used for viewer overlays)
3. Appends an entry to `session-log.json` with relative timestamp and element data
4. Forwards the command to agent-browser
5. Returns agent-browser's output

The element data capture uses a multi-strategy approach because agent-browser's `get box` command doesn't accept refs directly:
- Try to get the element's `id` attribute, then query by `#id`
- Fall back to getting the element's text content, then query by `text=<label>`
- If both fail, skip element data (overlays won't render for this action, but it's non-critical)

### Stop

```
proofshot stop
```

1. Collect console errors and console output from the browser (point-in-time snapshots)
2. Stop video recording
3. Close browser (unless `--no-close`)
4. **Trim video** — remove dead time before first action (5s buffer) and after last action (3s buffer) using ffmpeg. Adjust all `session-log.json` timestamps by the trim offset to stay in sync with the trimmed video.
5. **Extract server errors** — scan `server.log` with multi-language regex patterns
6. Generate `SUMMARY.md` — markdown report with description, video link, screenshots, and errors
7. Generate `viewer.html` — standalone interactive viewer
8. Clear `.session.json`

## Interactive viewer

The viewer (`viewer.html`) is a self-contained HTML file that serves as the primary proof artifact. It has no external dependencies — you can open it in any browser or attach it to a PR.

```
┌─────────────────────────────────────────────┐
│  Header: description, error badges          │
├────────────────────────┬────────────────────┤
│                        │                    │
│  Video (62%)           │  Timeline (38%)    │
│                        │                    │
│  Custom scrub bar      │  Action steps      │
│  with action markers   │  with timestamps   │
│                        │                    │
│  Overlay layer:        │  Click to seek     │
│  - Click ripples       │  Arrow key nav     │
│  - Scroll indicators   │                    │
│  - Action toasts       │                    │
│                        │                    │
└────────────────────────┴────────────────────┘
```

Key features:

- **Scrub bar markers** — each action gets a marker on the progress bar, positioned at its timestamp. Click a marker to jump to that moment.
- **Action overlays** — click ripples, scroll indicators, and action label toasts rendered on a transparent layer over the video, synced via `requestAnimationFrame`. Coordinates are scaled from the original viewport size to the current video display size.
- **Timeline sync** — clicking a step in the timeline seeks the video. Playing the video highlights the current step and auto-scrolls it into view.
- **Error badges** — top-right corner shows console and server error counts (green = clean, red = N errors).

## Skill installation

`proofshot install` detects AI tools on the machine and installs a skill file that teaches the agent the ProofShot workflow.

Two installation strategies:

| Strategy | Used by | How it works |
|----------|---------|-------------|
| **File** | Claude Code, Cursor, Codex, OpenCode | Writes a standalone skill file to the tool's config directory |
| **Append** | Gemini CLI, Windsurf | Appends to an existing config file using `<!-- proofshot:start -->` / `<!-- proofshot:end -->` markers for clean updates |

All installations are at **user level** (home directory), not per-project. This means one `proofshot install` works across every project on the machine.

Detection checks both binary availability (`which <tool>`) and config directory existence, so it finds tools even if they're not on PATH.

## Error detection

`src/utils/error-patterns.ts` scans server logs with regex patterns for 10+ languages:

- **JavaScript / Node.js** — `Error:`, `ERR_`, unhandled rejections, stack traces
- **Python** — `Traceback`, `File:line`, exception classes
- **Ruby / Rails** — `ActionController` errors, `FATAL--` prefix
- **Go** — `panic:`, goroutine stacks, `runtime error:`
- **Java / Kotlin** — `Exception in thread`, `Caused by:`, `at` stack frames
- **Rust** — `thread panicked`, `error[E***]` compiler errors
- **PHP** — `Parse error`, `Fatal error`, `Warning`
- **C# / .NET** — `Unhandled exception`, `:line N`
- **Elixir / Phoenix** — `** (EXIT)`, runtime errors
- **Generic** — `FATAL`, `CRITICAL`, `Segmentation fault`, `out of memory`

Adding support for a new language is one entry in the `PATTERNS` array.

## Project structure

```
src/
├── cli.ts                    # Commander.js command registration
├── commands/
│   ├── install.ts            # Tool detection + skill installation
│   ├── start.ts              # Session init: server, browser, recording
│   ├── stop.ts               # Cleanup: trim, errors, artifacts
│   ├── exec.ts               # Action logging + agent-browser passthrough
│   ├── diff.ts               # Visual regression (screenshot comparison)
│   ├── pr.ts                 # GitHub PR description formatting
│   └── clean.ts              # Artifact directory removal
├── browser/
│   ├── session.ts            # Browser open/close, console collection
│   ├── capture.ts            # Recording start/stop, screenshots, diffs
│   ├── navigate.ts           # URL navigation, snapshot
│   └── interact.ts           # Click, fill, type, scroll, press
├── server/
│   └── start.ts              # Dev server spawn + port waiting
├── session/
│   └── state.ts              # .session.json read/write/clear
├── artifacts/
│   ├── viewer.ts             # Interactive HTML viewer generation
│   ├── summary.ts            # Markdown summary generation
│   ├── pr-format.ts          # PR description formatting
│   └── bundle.ts             # Artifact bundling
└── utils/
    ├── config.ts             # Config file search + merge
    ├── exec.ts               # ab() and exec() shell wrappers
    ├── error-patterns.ts     # Multi-language regex patterns
    ├── port.ts               # isPortOpen, waitForPort
    └── skills.ts             # Skill file bundling
```

## Design decisions

**ESM-only with `.js` extensions.** All imports use explicit `.js` extensions (`import { ab } from '../utils/exec.js'`). This ensures files resolve correctly after TypeScript compilation without relying on module resolution heuristics.

**tsup with two entry points.** The CLI binary (`bin/proofshot.ts`) builds to a single file with a shebang. The library entry (`src/index.ts`) builds with code splitting and `.d.ts` generation. This supports both CLI usage and programmatic import by other tools.

**Minimal dependencies.** Only three production dependencies: `commander` (CLI framework), `chalk` (terminal colors), `detect-port` (port checking). agent-browser is an optional peer dependency. This keeps the install fast and the supply chain small.

**Session state in the output directory.** `.session.json` lives alongside artifacts, not in a global location. This allows parallel sessions in different projects and ensures `proofshot clean` removes everything.

**Config file walk-up.** `proofshot.config.json` is searched from cwd upward to filesystem root, supporting monorepo layouts where config lives at the repo root.

**Graceful degradation everywhere.** Missing ffmpeg skips video trimming. Failed element data capture skips overlays. Browser already closed gets a silent catch. Console errors unavailable shows "0 errors". Non-critical failures never abort a session.
