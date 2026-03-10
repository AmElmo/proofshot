<p align="center">
  <img src="brand-assets/banners/proofshot-banner.svg" alt="ProofShot — Visual verification for AI coding agents" width="100%" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/proofshot"><img src="https://img.shields.io/npm/v/proofshot?color=0ea5e9" alt="npm version"></a>
  <a href="https://github.com/AmElmo/proofshot/blob/main/LICENSE"><img src="https://img.shields.io/github/license/AmElmo/proofshot" alt="license"></a>
  <a href="https://www.npmjs.com/package/proofshot"><img src="https://img.shields.io/npm/dm/proofshot?color=6366f1" alt="downloads"></a>
</p>

<p align="center">
  <strong>Open-source, agent-agnostic CLI that gives AI coding agents eyes.</strong><br>
  Your agent builds a feature — ProofShot records video proof it works.
</p>

<p align="center">
  Works with Claude Code &middot; Cursor &middot; Codex &middot; Gemini CLI &middot; Windsurf &middot; GitHub Copilot &middot; any agent that runs shell commands
</p>

---

## Why ProofShot?

AI coding agents build UI features blind. They write code but can't verify the result looks right, works correctly, or throws no errors.

ProofShot closes the loop: an open-source CLI that plugs into *any* AI coding agent and gives it a verification workflow — test in a real browser, record video proof, collect errors, and bundle everything for the human to review.

The human gets a video recording, screenshots of key moments, and a report of any console or server errors found. View artifacts locally, or run `proofshot pr` to upload everything to the GitHub PR as an inline comment. No vendor lock-in. No cloud dependency.

<p align="center">
  <img src="brand-assets/screenshots/viewer-timeline.png" alt="ProofShot Viewer — video playback with interactive timeline" width="100%" />
  <br>
  <em>The interactive viewer: video recording with scrub bar, action markers, and step-by-step timeline</em>
</p>

## Install

```bash
npm install -g proofshot
proofshot install
```

The first command installs the CLI and [agent-browser](https://github.com/vercel-labs/agent-browser) (with headless Chromium). The second detects your AI coding tools and installs the ProofShot skill at user level — works across all your projects automatically.

## How It Works

Three-step workflow: **start**, **test**, **stop**.

```bash
# 1. Start — open browser, begin recording, capture server logs
proofshot start --run "npm run dev" --port 3000 --description "Login form verification"

# 2. Test — the AI agent drives the browser
agent-browser snapshot -i                                    # See interactive elements
agent-browser open http://localhost:3000/login               # Navigate
agent-browser fill @e2 "test@example.com"                    # Fill form
agent-browser click @e5                                      # Click submit
agent-browser screenshot ./proofshot-artifacts/step-login.png # Capture proof

# 3. Stop — bundle video + screenshots + errors into proof artifacts
proofshot stop
```

The skill file teaches the agent this workflow automatically. The user just says *"verify this with proofshot"* and the agent handles the rest.

## Output Artifacts

Each session produces a timestamped folder in `./proofshot-artifacts/`:

| File | Description |
|------|-------------|
| `session.webm` | Video recording of the entire session |
| `viewer.html` | Standalone interactive viewer with scrub bar, timeline, and Console/Server log tabs |
| `SUMMARY.md` | Markdown report with errors, screenshots, and video |
| `step-*.png` | Screenshots captured at key moments |
| `session-log.json` | Action timeline with timestamps and element data |
| `server.log` | Dev server stdout/stderr (when using `--run`) |
| `console-output.log` | Browser console output |

<p align="center">
  <img src="brand-assets/screenshots/artifacts-folder.png" alt="ProofShot artifacts folder" width="480" />
  <br>
  <em>Generated artifacts for a single verification session</em>
</p>

The viewer also includes tabs for browsing console and server logs, with error highlighting and timestamps synced to the video:

<p align="center">
  <img src="brand-assets/screenshots/viewer-console.png" alt="ProofShot Viewer — console logs tab" width="100%" />
  <br>
  <em>Console logs tab with error highlighting and video-synced timestamps</em>
</p>

## Commands

### `proofshot install`

Detect AI coding tools on your machine and install the ProofShot skill. Run once per machine.

```bash
proofshot install               # Interactive tool selection
proofshot install --only claude  # Only install for specific tools
proofshot install --skip cursor  # Skip specific tools
proofshot install --force        # Overwrite existing installations
```

### `proofshot start`

Start a verification session: browser, recording, error capture.

```bash
proofshot start                                        # Server already running
proofshot start --run "npm run dev" --port 3000         # Start and capture server
proofshot start --description "Verify checkout flow"    # Add description to report
proofshot start --url http://localhost:3000/login       # Open specific URL
proofshot start --headed                                # Show browser (debugging)
proofshot start --force                                 # Override a stale session from a previous crash
```

### `proofshot stop`

Stop recording, collect errors, generate proof artifacts.

```bash
proofshot stop              # Stop session and close browser
proofshot stop --no-close   # Stop but keep browser open
```

### `proofshot exec`

Pass-through to agent-browser with automatic session logging. Captures timestamps, element data, and resolves screenshot paths.

```bash
proofshot exec click @e3
proofshot exec screenshot step-checkout.png
```

### `proofshot diff`

Compare current screenshots against a baseline for visual regression.

```bash
proofshot diff --baseline ./previous-artifacts
```

### `proofshot pr`

Upload session artifacts to GitHub and post a verification comment on the PR. Finds all sessions recorded on the current branch, uploads screenshots and video, and posts a formatted comment with inline media.

```bash
proofshot pr              # Auto-detect PR from current branch
proofshot pr 42           # Target a specific PR
proofshot pr --dry-run    # Preview the markdown without posting
```

Requires the [GitHub CLI](https://cli.github.com) (`gh`) to be installed and authenticated. Converts `.webm` video to `.mp4` if `ffmpeg` is available.

### `proofshot clean`

Remove the `./proofshot-artifacts/` directory.

```bash
proofshot clean
```

## Supported Agents

`proofshot install` detects and configures skills for:

| Agent | Install location |
|-------|-----------------|
| **Claude Code** | `~/.claude/skills/proofshot/SKILL.md` |
| **Cursor** | `~/.cursor/rules/proofshot.mdc` |
| **Codex (OpenAI)** | `~/.codex/skills/proofshot/SKILL.md` |
| **Gemini CLI** | Appends to `~/.gemini/GEMINI.md` |
| **Windsurf** | Appends to `~/.codeium/windsurf/memories/global_rules.md` |

All skills install at **user level** — no per-project configuration needed.

## Try It

The repo includes sample apps so you can see ProofShot in action without your own project.

```bash
git clone https://github.com/AmElmo/proofshot.git
cd proofshot
npm install && npm run build && npm link

# Set up the sample app
cd test/fixtures/sample-app
npm install
```

Open your AI agent in the `test/fixtures/sample-app/` directory and prompt it:

> Verify the sample app with proofshot. Start on the homepage, check the hero section, navigate to the Dashboard and check the metrics, then go to Settings and update the profile name. Screenshot each page.

Or run the automated test script without an agent:

```bash
bash test-proofshot.sh
```

Check `proofshot-artifacts/` for the video, screenshots, and report.

## Error Detection

ProofShot automatically detects errors from server logs across 10+ languages: JavaScript/Node.js, Python, Ruby/Rails, Go, Java/Kotlin, Rust, PHP, C#/.NET, Elixir/Phoenix, and more. Add patterns for new languages in [`src/utils/error-patterns.ts`](src/utils/error-patterns.ts).

## Documentation

- **[Architecture](docs/architecture.md)** — How ProofShot works under the hood, why agent-browser was chosen, the session lifecycle, viewer internals, and design decisions.
- **[Test Apps](docs/test-apps.md)** — Three sample apps with ready-to-use prompts for testing ProofShot end-to-end across different UI patterns (SaaS dashboard, kanban board, chat interface).

## Contributing

Contributions welcome! The project uses TypeScript (ESM-only) with tsup for builds and vitest for tests.

```bash
npm install
npm run build    # Build (required after changes)
npm test         # Run tests
npm run dev      # Watch mode
```

Three sample apps in `test/fixtures/` cover different UI patterns for end-to-end testing: a SaaS dashboard (`sample-app`), a kanban board (`todo-app`), and a chat interface (`chat-app`).

Built on [agent-browser](https://github.com/vercel-labs/agent-browser) by Vercel.

## License

[MIT](LICENSE)
