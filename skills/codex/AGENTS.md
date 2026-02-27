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
