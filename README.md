# ProofShot

**The open-source, agent-agnostic CLI that gives AI coding agents eyes.**

Your agent builds a feature — ProofShot records video proof it works. Three commands. Any agent. Real browser verification.

Works with: Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Windsurf, and any agent that runs shell commands.

## Why ProofShot?

AI coding agents build UI features blind. They write code but can't verify the result. Cursor shipped video review for their cloud agents — but it's locked into Cursor's ecosystem. QA tools like TestDriver and TestZeus capture browser sessions — but they're built for test automation, not for closing the coding agent feedback loop.

**ProofShot is the missing piece:** an open-source CLI that plugs into *any* AI coding agent and gives it a verification workflow — test in a real browser, record video proof, collect errors, and bundle everything for the human to review. No vendor lock-in. No cloud dependency. Just `npm install -g proofshot` and your agent can see.

The human gets: a video recording showing what was tested, screenshots of key moments, and a report of any console or server errors found.

## Install

```bash
npm install -g proofshot
```

This also installs `agent-browser` and downloads a headless Chromium.

## Setup (10 seconds)

```bash
cd your-project
proofshot init
```

This creates a config file and installs a skill file that teaches your AI agent the verification workflow.

## How It Works

ProofShot uses a **start / test / stop** workflow:

```bash
# 1. Start — browser, recording, error capture (--run starts and captures your dev server)
proofshot start --run "npm run dev" --port 3000 --description "Login form: fill credentials, submit, verify redirect"

# 2. Test — the AI agent drives the browser
agent-browser snapshot -i                                    # See interactive elements
agent-browser open http://localhost:3000/login               # Navigate
agent-browser fill @e2 "test@example.com"                    # Fill form
agent-browser click @e5                                      # Click submit
agent-browser screenshot ./proofshot-artifacts/step-login.png # Capture proof

# 3. Stop — bundle video + screenshots + errors into proof artifacts
proofshot stop
```

You get: a video recording, screenshots, console errors, server errors, and a markdown summary — all in `./proofshot-artifacts/`.

The skill file teaches the agent this workflow automatically. The user just says "verify this with proofshot" and the agent handles the rest.

## Commands

### `proofshot init`

Creates config and installs skill file.

```bash
proofshot init
proofshot init --agent claude    # Specify agent type
proofshot init --force           # Overwrite existing config
```

### `proofshot start`

Start a verification session: browser, recording, error capture.

```bash
proofshot start                                                          # Server already running
proofshot start --run "npm run dev" --port 3000                          # Start and capture server
proofshot start --run "npm run dev" --port 3000 --description "what"     # With description for report
proofshot start --url http://localhost:3000/login                        # Open specific URL
proofshot start --port 3001                                              # Custom port
proofshot start --headed                                                 # Show browser window
```

### `proofshot stop`

Stop session: stop recording, collect errors, bundle proof artifacts, generate summary.

```bash
proofshot stop                   # Stop and close browser
proofshot stop --no-close        # Stop but keep browser open
```

### `proofshot diff`

Compare current screenshots against baseline.

```bash
proofshot diff --baseline ./previous-artifacts
```

### `proofshot pr`

Format artifacts as a GitHub PR description snippet.

```bash
proofshot pr                    # Output to stdout
proofshot pr >> pr-body.md      # Append to file
```

### `proofshot clean`

Remove artifact files.

```bash
proofshot clean
```

## Config

`proofshot init` creates a `proofshot.config.json`:

```json
{
  "devServer": {
    "port": 3000,
    "startupTimeout": 30000
  },
  "output": "./proofshot-artifacts",
  "viewport": { "width": 1280, "height": 720 },
  "headless": true
}
```

The dev server command is provided at runtime via `--run`, not in the config. If `--run` is omitted, ProofShot assumes the server is already running.

## Supported Agents

Skill files are provided for:

- **Claude Code** — `.claude/skills/proofshot/SKILL.md`
- **Cursor** — `.cursor/rules/proofshot.mdc`
- **Codex** — Appends to `AGENTS.md`
- **Generic** — `PROOFSHOT.md` in project root

Built on [agent-browser](https://github.com/vercel-labs/agent-browser) by Vercel.

## License

MIT
