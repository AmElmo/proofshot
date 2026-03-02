import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolve the directory where bundled skill files are shipped.
 */
export function getSkillsDir(): string {
  return path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..', '..', 'skills',
  );
}

/**
 * Read a bundled skill file. Returns the content string, or null if not found.
 */
export function readBundledSkill(relativePath: string): string | null {
  try {
    return fs.readFileSync(path.join(getSkillsDir(), relativePath), 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Generate inline skill content as a fallback when bundled files aren't available.
 */
export function getInlineSkillContent(agent: string): string {
  if (agent === 'claude' || agent === 'codex') {
    return `---
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

\`\`\`bash
proofshot start --run "your-dev-command" --port PORT --description "what you are about to verify"
\`\`\`

This opens a browser and begins recording. If --run is provided, it also starts and captures your dev server output.
If the server is already running, omit --run (no server logs captured).
The description appears in the proof report for the human.

### Step 2: Drive the browser and test

Use proofshot exec to navigate, interact, and verify:

\`\`\`bash
proofshot exec snapshot -i                                    # See interactive elements
proofshot exec open http://localhost:PORT/page                # Navigate to a page
proofshot exec click @e3                                      # Click a button
proofshot exec fill @e2 "test@example.com"                    # Fill a form field
proofshot exec screenshot step-NAME.png                       # Capture key moments
\`\`\`

Take screenshots at important moments — these become the visual proof.
Verify what you expect to see by reading the snapshot output.

### Step 3: Stop and bundle the proof

\`\`\`bash
proofshot stop
\`\`\`

This stops recording, collects console + server errors, and generates
a SUMMARY.md with video, screenshots, and error report.

### Step 4 (optional): Post proof to the PR

\`\`\`bash
proofshot pr              # Auto-detect PR from current branch
proofshot pr 42           # Target a specific PR number
\`\`\`

This uploads screenshots and video to GitHub and posts a formatted comment on the PR with inline media. Requires \`gh\` CLI to be authenticated.

## Tips

- Always include a meaningful --description so the human knows what was tested
- Take screenshots before AND after key actions (e.g., before form submit, after redirect)
- If you find errors during verification, fix them and re-run the workflow
- Use \`proofshot pr\` after stopping to attach proof directly to the pull request
`;
  }

  if (agent === 'cursor') {
    return `---
description: Visual verification of UI changes using ProofShot
globs: ["**/*.tsx", "**/*.jsx", "**/*.vue", "**/*.svelte", "**/*.html"]
---

After modifying UI files, visually verify changes with this workflow:

1. Start session: \`proofshot start --run "your-dev-command" --port PORT --description "what you are verifying"\`
   If the server is already running, omit --run.
2. Drive browser: Use \`proofshot exec\` commands to navigate, click, fill forms, and take screenshots
3. Stop session: \`proofshot stop\` to bundle video + screenshots + error report
4. (Optional) Post to PR: \`proofshot pr\` to upload proof to the GitHub PR

Key proofshot exec commands:
- \`proofshot exec snapshot -i\` — see interactive elements
- \`proofshot exec click @e3\` — click an element
- \`proofshot exec fill @e2 "text"\` — fill a form field
- \`proofshot exec screenshot step.png\` — capture a moment
`;
  }

  // Generic / gemini / windsurf
  return `# ProofShot Visual Verification

After building or modifying UI features, verify with this workflow:

1. Start: \`proofshot start --run "your-dev-command" --port PORT --description "what you are verifying"\`
   If the server is already running, omit --run.
2. Test: Use \`proofshot exec\` to navigate, click, fill forms, take screenshots
3. Stop: \`proofshot stop\` — bundles video, screenshots, and error report
4. (Optional) Post to PR: \`proofshot pr\` — uploads proof to the GitHub PR

Key proofshot exec commands:
- \`proofshot exec snapshot -i\` — see interactive elements
- \`proofshot exec click @e3\` — click an element
- \`proofshot exec fill @e2 "text"\` — fill a form field
- \`proofshot exec screenshot step.png\` — capture a moment

Artifacts saved to ./proofshot-artifacts/ including video, screenshots, errors, and summary.
`;
}
