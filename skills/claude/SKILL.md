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

Use proofshot exec to navigate, interact, and verify:

```bash
proofshot exec snapshot -i                                    # See interactive elements
proofshot exec open http://localhost:PORT/page                # Navigate to a page
proofshot exec click @e3                                      # Click a button
proofshot exec fill @e2 "test@example.com"                    # Fill a form field
proofshot exec screenshot step-NAME.png                       # Capture key moments
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
