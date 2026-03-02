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

This detects your framework (Next.js, Vite, Remix, etc.), creates a config file, and installs a skill file that teaches your AI agent the verification workflow.

## How It Works

ProofShot uses a **start / test / stop** workflow:

```bash
# 1. Start — dev server, browser, recording, error capture
proofshot start --description "Login form: fill credentials, submit, verify redirect"

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

Detects framework, creates config, installs skill file.

```bash
proofshot init
proofshot init --agent claude    # Specify agent type
proofshot init --force           # Overwrite existing config
```

### `proofshot start`

Start a verification session: dev server, browser, recording, error capture.

```bash
proofshot start                                              # Basic start
proofshot start --description "what is being verified"       # With description for report
proofshot start --url http://localhost:3000/login             # Open specific URL
proofshot start --port 3001                                  # Custom port
proofshot start --no-server                                  # Assume dev server is running
proofshot start --headed                                     # Show browser window
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

## Supported Frameworks

Auto-detected from `package.json`:

- Next.js (port 3000)
- Vite / Vue / React+Vite / Svelte (port 5173)
- Remix (port 3000)
- Astro (port 4321)
- Create React App (port 3000)
- Nuxt (port 3000)
- SvelteKit (port 5173)
- Angular (port 4200)
- Any project with a `dev` script (port 3000)

## Supported Agents

Skill files are provided for:

- **Claude Code** — `.claude/skills/proofshot/SKILL.md`
- **Cursor** — `.cursor/rules/proofshot.mdc`
- **Codex** — Appends to `AGENTS.md`
- **Generic** — `PROOFSHOT.md` in project root

## Try It — Sample App

The repo includes a sample Vite app (`test/fixtures/sample-app/`) so you can see ProofShot in action without setting up your own project.

### 1. Clone and build

```bash
git clone https://github.com/proofshot/proofshot.git
cd proofshot
npm install
npm run build
npm link                    # makes `proofshot` available globally
```

### 2. Set up the sample app

```bash
cd test/fixtures/sample-app
npm install
proofshot init --force
```

### 3. Tell your AI agent to verify it

Open your AI agent (Claude Code, Cursor, etc.) in the `test/fixtures/sample-app/` directory and give it a prompt like:

> Verify the Acme SaaS sample app with proofshot. Start on the homepage, check the hero section and scroll down to see the feature cards and stats. Then navigate to the Dashboard and check the metrics and activity table. Finally go to Settings, update the profile name to "John Smith" and email to "john@acme.com", toggle on the Marketing emails and SMS alerts switches, and click Save Profile. Screenshot each page and every key interaction.

The agent reads the skill file installed by `proofshot init`, runs the full `start → exec → stop` workflow autonomously, and produces the proof artifacts.

### 4. Check the output

After the agent finishes, open `proofshot-artifacts/` to find:

- `session.webm` — video recording of the entire session
- `step-*.png` — screenshots at key moments
- `SUMMARY.md` — markdown report with errors and screenshots
- `viewer.html` — standalone HTML viewer (open in your browser)

### Alternative: run the automated test script

If you just want to see the CLI work end-to-end without an AI agent:

```bash
cd test/fixtures/sample-app
bash test-proofshot.sh
```

This runs the full lifecycle: `init → start → browser interactions → stop → pr → clean`.

Built on [agent-browser](https://github.com/vercel-labs/agent-browser) by Vercel.

## License

MIT
