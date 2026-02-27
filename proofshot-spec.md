# ProofShot — Visual Verification for AI Coding Agents

## Product Spec v2.0

**One-liner:** Give any AI coding agent eyes. It builds a feature → ProofShot records video proof it works.

**Tagline:** "Cursor charges $200/mo for agents that can see what they build. Here's the same thing, free, for every agent."

---

## 1. What This Is

ProofShot is an open-source CLI tool + skill file that creates an **agent-driven verification workflow**. When an AI coding agent finishes building a UI feature, ProofShot:

1. Auto-detects and starts the dev server
2. Opens a headless browser and starts recording
3. Captures console errors + server errors throughout the session
4. **Hands control to the AI agent** — the agent navigates, clicks, fills forms, and verifies using `agent-browser`
5. When the agent is done, bundles everything into a proof artifact: video, screenshots, errors, and a markdown summary

**The key insight:** ProofShot doesn't contain verification intelligence. The AI agent IS the intelligence. ProofShot provides the **workflow and infrastructure** — start server, open browser, record, capture errors, bundle proof.

**Who is the output for:** The **human**. The primary value is a video proof + error report that shows the human "here's what your AI agent tested, here's the evidence, here are any errors found." Secondarily, errors can be fed back to the agent for self-correction.

It works with: Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Windsurf, Goose, OpenCode — any agent that can run bash commands.

**What makes this different from just using agent-browser directly:**
- Zero-config dev server detection and startup
- Recording is automatic (starts on `proofshot start`, stops on `proofshot stop`)
- Captures both console errors AND server errors (dev server stderr) throughout the session
- Produces a structured proof artifact bundle (video + screenshots + errors + summary) ready for PR
- Ships with a skill file that teaches any agent the full verification workflow — the user doesn't prompt-engineer anything
- Two commands: `proofshot start` → agent tests → `proofshot stop` bundles the proof

---

## 2. Architecture

### Core Dependency

ProofShot wraps **Vercel's `agent-browser`** (not raw Playwright MCP). Reasons:

- 93% less context usage vs Playwright MCP (~200-400 tokens per snapshot vs ~3000-5000)
- Rust CLI + persistent Node.js daemon = fast command execution
- Snapshot + Refs system (@e1, @e2) for deterministic element selection
- Built-in `record start` / `record stop` for video
- Built-in `screenshot --annotate` for labeled screenshots
- Built-in `diff screenshot` for visual regression detection
- Already works headless — no window on user's screen
- Already works with every major AI coding agent

### Tech Stack

```
proofshot (our tool)
├── TypeScript CLI (workflow orchestration)
├── agent-browser (Vercel's tool — handles all browser work)
│   ├── Rust CLI (fast command parsing)
│   └── Node.js daemon (Playwright under the hood)
├── Dev server detection module
├── Server error capture (dev server stderr logging)
├── Session state management (tracks active sessions)
└── Artifact bundler (video + screenshots + errors + markdown summary)
```

### What We Build vs What We Reuse

| Component | Build or Reuse |
|-----------|---------------|
| Browser automation | **Reuse** — agent-browser |
| Video recording | **Reuse** — agent-browser `record start/stop` |
| Screenshots | **Reuse** — agent-browser `screenshot --annotate` |
| Visual diffs | **Reuse** — agent-browser `diff screenshot` |
| Dev server detection | **Build** — detect framework + start command |
| Server error capture | **Build** — pipe dev server stderr to log file |
| Session state | **Build** — track active session (output dir, timestamp, error log path) |
| Artifact bundling | **Build** — collect video/screenshots/errors/summary into folder |
| Summary generation | **Build** — markdown proof report with errors and description |
| Skill file | **Build** — teaches AI agents the full start → test → stop workflow |
| CLI orchestration | **Build** — `proofshot start` / `proofshot stop` commands |

---

## 3. User Experience

### Installation (30 seconds)

```bash
npm install -g proofshot
```

This also installs `agent-browser` as a dependency and runs `agent-browser install` to download Chromium.

### Setup in a Project (10 seconds)

```bash
cd my-project
proofshot init
```

This does:
1. Detects the framework (Next.js, Vite, Remix, Astro, CRA, etc.)
2. Creates `proofshot.config.json` with detected settings:
   ```json
   {
     "devServer": {
       "command": "npm run dev",
       "port": 3000,
       "waitForText": "ready on",
       "startupTimeout": 30000
     },
     "output": "./proofshot-artifacts",
     "viewport": { "width": 1280, "height": 720 },
     "headless": true
   }
   ```
3. Installs the skill file for the detected agent:
   - Claude Code: `.claude/skills/proofshot/SKILL.md`
   - Codex: `codex.md` / `AGENTS.md` append
   - Cursor: `.cursor/rules/proofshot.mdc`
   - General: `PROOFSHOT.md` in project root

### Usage — The Developer Does Nothing Different

The developer codes normally with their AI agent. When a UI feature is done, they just say:

> "Now verify this visually with proofshot"

The skill file teaches the agent the workflow. The agent runs:

```bash
proofshot start --description "Login form: fill credentials, submit, verify redirect to dashboard"
```

Then the agent uses `agent-browser` to navigate, click, fill forms, and verify. When done:

```bash
proofshot stop
```

### What Happens Behind the Scenes

```
Phase 1: proofshot start
1. proofshot detects dev server is not running
2. proofshot starts dev server (npm run dev)
3. proofshot captures dev server stderr → ./proofshot-artifacts/server-errors.log
4. proofshot waits for server to be ready (detects "ready on" or port open)
5. proofshot calls: agent-browser open http://localhost:3000
6. proofshot calls: agent-browser set viewport 1280 720
7. proofshot calls: agent-browser record start ./proofshot-artifacts/session.webm
8. proofshot saves session state to ./proofshot-artifacts/.session.json
9. proofshot outputs: "Session started. Use agent-browser to test. Run proofshot stop when done."

Phase 2: Agent drives the browser (proofshot is not running)
- agent-browser snapshot -i          → See what's on the page
- agent-browser click @e3            → Click a button
- agent-browser fill @e2 "text"      → Fill a form
- agent-browser screenshot ./proofshot-artifacts/step-1.png  → Capture key moments
- agent-browser open http://localhost:3000/other-page        → Navigate

Phase 3: proofshot stop
1. proofshot calls: agent-browser errors → captures final console errors
2. proofshot calls: agent-browser console → captures console output
3. proofshot calls: agent-browser record stop → saves video
4. proofshot calls: agent-browser close → closes browser
5. proofshot reads server-errors.log for server-side errors
6. proofshot collects all screenshots in the output dir
7. proofshot generates SUMMARY.md with: description, video, screenshots, console errors, server errors
8. proofshot outputs: proof artifact summary to stdout
```

### What the Agent Sees (proofshot start output)

```
✅ ProofShot session started

Dev server: Vite on :5173
Browser: Chromium (headless)
Recording: ./proofshot-artifacts/session-2026-02-25.webm
Errors log: ./proofshot-artifacts/server-errors.log

Use agent-browser to navigate and test:
  agent-browser snapshot -i                              # See interactive elements
  agent-browser click @e3                                # Click an element
  agent-browser fill @e2 "test@example.com"              # Fill a form
  agent-browser screenshot ./proofshot-artifacts/step.png # Capture a moment

When done, run: proofshot stop
```

### What the Agent Sees (proofshot stop output)

```
✅ ProofShot verification complete

📹 Video:         ./proofshot-artifacts/session-2026-02-25.webm (45s)
📸 Screenshots:   3 captured
📝 Summary:       ./proofshot-artifacts/SUMMARY.md

Console errors:   0
Server errors:    0
Duration:         45 seconds

Proof artifacts saved to ./proofshot-artifacts/
```

### The Summary File (SUMMARY.md) — The Proof for the Human

```markdown
# ProofShot Verification Report

**Date:** 2026-02-25 14:32:00
**Project:** my-saas-app
**Framework:** Vite
**Dev Server:** localhost:5173

## What Was Verified

Login form: fill credentials, submit, verify redirect to dashboard

## Video Recording

Full session recording: [session-2026-02-25.webm](./session-2026-02-25.webm) (45s)

## Screenshots

| Step | Screenshot |
|------|-----------|
| ![step-1](./step-1.png) | Login page loaded |
| ![step-2](./step-2.png) | Form filled |
| ![step-3](./step-3.png) | Dashboard after redirect |

## Console Errors

No console errors detected.

## Server Errors

No server errors detected.

## Environment
- Browser: Chromium (headless)
- Viewport: 1280x720
- Duration: 45 seconds
```

---

## 4. CLI Commands

### `proofshot init`

Detects framework, creates config, installs skill file.

```bash
proofshot init
# Flags:
#   --agent claude|codex|cursor|gemini|copilot|generic
#   --force  (overwrite existing config)
```

### `proofshot start`

Start a verification session: dev server, browser, recording, error capture.

```bash
proofshot start
# Flags:
#   --description "what is being verified"  (included in the proof report)
#   --port 3000                             (override detected port)
#   --no-server                             (don't start dev server, assume it's running)
#   --headed                                (show browser window for debugging)
#   --output ./my-artifacts                 (custom output directory)
#   --url http://localhost:3000/login       (open this URL instead of root)
```

### `proofshot stop`

Stop the session: stop recording, collect errors, bundle proof artifacts, generate summary.

```bash
proofshot stop
# Flags:
#   --no-close  (don't close the browser — useful if the agent wants to keep using it)
```

### `proofshot diff`

Compare current state against baseline screenshots.

```bash
proofshot diff --baseline ./previous-artifacts
# Outputs: diff images with changed pixels highlighted in red + mismatch percentage
```

### `proofshot clean`

Remove artifact files.

```bash
proofshot clean
# Removes ./proofshot-artifacts/
```

### `proofshot pr`

Format artifacts for inclusion in a PR description.

```bash
proofshot pr
# Outputs: markdown snippet with embedded screenshot links suitable for GitHub PR body
# Can be piped: proofshot pr >> pr-body.md
```

---

## 5. Dev Server Detection

### Framework Detection Logic

ProofShot reads `package.json` to detect the framework and infer the dev command + port:

```typescript
const FRAMEWORK_DETECTORS = [
  { name: 'Next.js',    detect: (pkg) => pkg.dependencies?.['next'] || pkg.devDependencies?.['next'],   command: 'npm run dev', port: 3000, waitForText: 'ready on' },
  { name: 'Vite',       detect: (pkg) => pkg.devDependencies?.['vite'],                                  command: 'npm run dev', port: 5173, waitForText: 'Local:' },
  { name: 'Remix',      detect: (pkg) => pkg.dependencies?.['@remix-run/node'],                          command: 'npm run dev', port: 3000, waitForText: 'started' },
  { name: 'Astro',      detect: (pkg) => pkg.dependencies?.['astro'] || pkg.devDependencies?.['astro'],  command: 'npm run dev', port: 4321, waitForText: 'watching for file changes' },
  { name: 'CRA',        detect: (pkg) => pkg.dependencies?.['react-scripts'],                            command: 'npm start',   port: 3000, waitForText: 'Compiled' },
  { name: 'Nuxt',       detect: (pkg) => pkg.dependencies?.['nuxt'] || pkg.devDependencies?.['nuxt'],    command: 'npm run dev', port: 3000, waitForText: 'Listening on' },
  { name: 'SvelteKit',  detect: (pkg) => pkg.devDependencies?.['@sveltejs/kit'],                         command: 'npm run dev', port: 5173, waitForText: 'Local:' },
  { name: 'Angular',    detect: (pkg) => pkg.dependencies?.['@angular/core'],                            command: 'npm start',   port: 4200, waitForText: 'Compiled successfully' },
  { name: 'Fallback',   detect: (pkg) => pkg.scripts?.dev,                                               command: 'npm run dev', port: 3000, waitForText: null },
];
```

### Server Startup + Error Capture

```typescript
async function ensureDevServer(config, errorLogPath: string) {
  if (await isPortOpen(config.port)) return { alreadyRunning: true };

  const errorLog = fs.createWriteStream(errorLogPath, { flags: 'a' });
  const proc = spawn('sh', ['-c', config.command], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  // Capture server stderr to error log file
  proc.stderr.pipe(errorLog);
  proc.stdout.pipe(errorLog); // Also capture stdout for full context

  proc.unref();
  await waitForReady(proc, config);
  return { alreadyRunning: false };
}
```

---

## 6. Session State

ProofShot uses a `.session.json` file in the output directory to track the active session:

```json
{
  "startedAt": "2026-02-25T14:32:00.000Z",
  "description": "Login form: fill credentials, submit, verify redirect",
  "outputDir": "./proofshot-artifacts",
  "videoPath": "./proofshot-artifacts/session-2026-02-25.webm",
  "serverErrorLog": "./proofshot-artifacts/server-errors.log",
  "port": 5173,
  "framework": "Vite",
  "pid": 12345
}
```

`proofshot stop` reads this file to know where to find artifacts and what metadata to include in the summary.

---

## 7. Skill File (Critical for Adoption)

The skill file is what makes this "zero effort" for the user. It teaches the AI agent the **full verification workflow**: start session → navigate and test → stop session.

### Claude Code Skill: `.claude/skills/proofshot/SKILL.md`

```markdown
---
name: proofshot
description: Visual verification of UI features. Use after building or modifying any
  UI component, page, or visual feature. Starts a verification session with video
  recording and error capture, then you drive the browser to test, then stop to
  bundle proof artifacts for the human.
allowed-tools: Bash(proofshot:*), Bash(agent-browser:*)
---

# ProofShot — Visual Verification Workflow

## When to use

Use ProofShot after:
- Building a new UI feature or page
- Modifying existing UI components
- Fixing a visual bug
- Any change that affects what the user sees

## The workflow (always follow these 3 steps)

### Step 1: Start the session

```bash
proofshot start --description "what you are about to verify"
```

This starts the dev server, opens a headless browser, and begins recording.
The description appears in the proof report for the human.

### Step 2: Drive the browser and test

Use agent-browser commands to navigate, interact, and verify:

```bash
agent-browser snapshot -i                                    # See interactive elements
agent-browser open http://localhost:PORT/page                # Navigate to a page
agent-browser click @e3                                      # Click a button
agent-browser fill @e2 "test@example.com"                    # Fill a form field
agent-browser screenshot ./proofshot-artifacts/step-NAME.png # Capture key moments
```

Take screenshots at important moments — these become the visual proof.
Verify what you expect to see by reading the snapshot output.

### Step 3: Stop and bundle the proof

```bash
proofshot stop
```

This stops recording, collects console + server errors, and generates
a SUMMARY.md with video, screenshots, and error report.

## Tips

- Always include a meaningful --description so the human knows what was tested
- Take screenshots before AND after key actions (e.g., before form submit, after redirect)
- If you find errors during verification, fix them and re-run the workflow
- The proof artifacts in ./proofshot-artifacts/ can be referenced in commit messages or PRs
```

### Cursor Rule: `.cursor/rules/proofshot.mdc`

```markdown
---
description: Visual verification of UI changes using ProofShot
globs: ["**/*.tsx", "**/*.jsx", "**/*.vue", "**/*.svelte", "**/*.html"]
---

After modifying UI files, visually verify changes with this workflow:

1. Start session: `proofshot start --description "what you are verifying"`
2. Drive browser: Use `agent-browser` commands to navigate, click, fill forms, and take screenshots
3. Stop session: `proofshot stop` to bundle video + screenshots + error report

Key agent-browser commands:
- `agent-browser snapshot -i` — see interactive elements
- `agent-browser click @e3` — click an element
- `agent-browser fill @e2 "text"` — fill a form field
- `agent-browser screenshot ./proofshot-artifacts/step.png` — capture a moment
```

### Generic (AGENTS.md / PROOFSHOT.md)

```markdown
# ProofShot Visual Verification

After building or modifying UI features, verify with this workflow:

1. Start: `proofshot start --description "what you are verifying"`
2. Test: Use `agent-browser` to navigate, click, fill forms, take screenshots
3. Stop: `proofshot stop` — bundles video, screenshots, and error report

Key agent-browser commands:
- `agent-browser snapshot -i` — see interactive elements
- `agent-browser click @e3` — click an element
- `agent-browser fill @e2 "text"` — fill a form field
- `agent-browser screenshot ./proofshot-artifacts/step.png` — capture a moment

Artifacts saved to ./proofshot-artifacts/ including video, screenshots, errors, and summary.
```

---

## 8. Project Structure

```
proofshot/
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE                      # MIT
├── bin/
│   └── proofshot.ts             # CLI entry point
├── src/
│   ├── index.ts                 # Main exports
│   ├── cli.ts                   # CLI argument parsing (commander.js)
│   ├── commands/
│   │   ├── init.ts              # proofshot init
│   │   ├── start.ts             # proofshot start (begin session)
│   │   ├── stop.ts              # proofshot stop (end session, bundle proof)
│   │   ├── diff.ts              # proofshot diff
│   │   ├── clean.ts             # proofshot clean
│   │   └── pr.ts                # proofshot pr
│   ├── server/
│   │   ├── detect.ts            # Framework detection
│   │   ├── start.ts             # Dev server startup + error capture
│   │   └── wait.ts              # Port/text waiting utilities
│   ├── browser/
│   │   ├── session.ts           # agent-browser session management
│   │   ├── navigate.ts          # Page navigation + waiting
│   │   ├── capture.ts           # Screenshot + recording orchestration
│   │   └── interact.ts          # Interactive commands (click, fill, etc.)
│   ├── artifacts/
│   │   ├── bundle.ts            # Collect all artifacts
│   │   ├── summary.ts           # Generate SUMMARY.md proof report
│   │   └── pr-format.ts         # Format for PR description
│   ├── session/
│   │   └── state.ts             # Session state management (.session.json)
│   └── utils/
│       ├── exec.ts              # Shell command execution
│       ├── port.ts              # Port detection utilities
│       └── config.ts            # Config file reading/writing
├── skills/
│   ├── claude/SKILL.md
│   ├── cursor/proofshot.mdc
│   ├── codex/AGENTS.md
│   └── generic/PROOFSHOT.md
└── test/
    └── fixtures/
        └── sample-app/          # Vite test app with 3 pages
```

---

## 9. Key Implementation Details

### How We Wrap agent-browser

We call agent-browser via CLI (child_process), not as a library import:

```typescript
import { execSync } from 'child_process';

function ab(command: string): string {
  return execSync(`agent-browser ${command}`, {
    encoding: 'utf-8',
    timeout: 30000,
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim();
}
```

### Session Lifecycle

```
proofshot start:
  1. Load config
  2. Ensure output dir exists
  3. Start dev server (if needed), piping stderr to server-errors.log
  4. Open browser via agent-browser
  5. Start recording via agent-browser
  6. Write .session.json with metadata
  7. Print instructions for the agent

[Agent uses agent-browser directly — proofshot is not running]

proofshot stop:
  1. Read .session.json
  2. Collect console errors via agent-browser errors
  3. Collect console output via agent-browser console
  4. Stop recording via agent-browser record stop
  5. Close browser via agent-browser close
  6. Read server-errors.log
  7. List all screenshots in output dir
  8. Generate SUMMARY.md
  9. Delete .session.json
  10. Print summary to stdout
```

### Server Error Capture

The dev server's stderr is continuously piped to a log file from the moment `proofshot start` launches it until `proofshot stop` reads it. This catches:
- Runtime errors (unhandled exceptions)
- Compilation errors
- Warning messages
- Stack traces

The log file is included in the SUMMARY.md and can be fed back to the agent.

---

## 10. Open Questions (To Decide During Build)

1. **Name:** "ProofShot" is a working name. Need to check npm availability.
2. **Video format:** agent-browser records .webm. Plays natively in browsers and GitHub, so fine as-is.
3. **Monorepo support:** For now, assume single project root.
4. **Server error log rotation:** For long sessions, the log could get large. Probably fine for v1.
