# ProofShot Visual Verification

ProofShot is an open-source, agent-agnostic CLI that lets any AI coding agent verify its own work in a real browser — no vendor lock-in required.

After building or modifying UI features, verify with this workflow:

1. Start: `proofshot start --run "your-dev-command" --port PORT --description "what you are verifying"`
   If the server is already running, omit --run.
2. Test: Use `proofshot exec` to navigate, click, fill forms, take screenshots
3. Stop: `proofshot stop` — bundles video, screenshots, and error report

Key proofshot exec commands:
- `proofshot exec snapshot -i` — see interactive elements
- `proofshot exec click @e3` — click an element
- `proofshot exec fill @e2 "text"` — fill a form field
- `proofshot exec screenshot step.png` — capture a moment

Artifacts saved to ./proofshot-artifacts/ including video, screenshots, errors, and summary.
