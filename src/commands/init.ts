import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { detectFramework } from '../server/detect.js';
import { writeConfig, configExists, type ProofShotConfig } from '../utils/config.js';

interface InitOptions {
  agent?: string;
  force?: boolean;
}

const SKILL_FILES: Record<string, { path: string; content: () => string }> = {
  claude: {
    path: '.claude/skills/proofshot/SKILL.md',
    content: () =>
      fs.readFileSync(
        path.join(getSkillsDir(), 'claude', 'SKILL.md'),
        'utf-8',
      ),
  },
  cursor: {
    path: '.cursor/rules/proofshot.mdc',
    content: () =>
      fs.readFileSync(
        path.join(getSkillsDir(), 'cursor', 'proofshot.mdc'),
        'utf-8',
      ),
  },
  codex: {
    path: 'AGENTS.md',
    content: () =>
      fs.readFileSync(
        path.join(getSkillsDir(), 'codex', 'AGENTS.md'),
        'utf-8',
      ),
  },
  generic: {
    path: 'PROOFSHOT.md',
    content: () =>
      fs.readFileSync(
        path.join(getSkillsDir(), 'generic', 'PROOFSHOT.md'),
        'utf-8',
      ),
  },
};

function getSkillsDir(): string {
  // Skills are shipped alongside the package
  return path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..', '..', 'skills',
  );
}

/**
 * Detect which agent is likely being used based on project files.
 */
function detectAgent(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, '.claude'))) return 'claude';
  if (fs.existsSync(path.join(cwd, '.cursor'))) return 'cursor';
  if (fs.existsSync(path.join(cwd, 'AGENTS.md'))) return 'codex';
  return 'generic';
}

/**
 * Install the skill file for the detected/selected agent.
 */
function installSkillFile(agent: string): string | null {
  const skill = SKILL_FILES[agent] || SKILL_FILES.generic;

  try {
    const content = skill.content();
    const targetPath = path.join(process.cwd(), skill.path);
    const targetDir = path.dirname(targetPath);

    fs.mkdirSync(targetDir, { recursive: true });

    // For AGENTS.md, append rather than overwrite if it exists
    if (agent === 'codex' && fs.existsSync(targetPath)) {
      const existing = fs.readFileSync(targetPath, 'utf-8');
      if (!existing.includes('ProofShot')) {
        fs.appendFileSync(targetPath, '\n\n' + content);
      }
    } else {
      fs.writeFileSync(targetPath, content);
    }

    return skill.path;
  } catch {
    // If skill files aren't bundled (dev mode), create inline
    return createInlineSkillFile(agent);
  }
}

function createInlineSkillFile(agent: string): string | null {
  const skillContent = getInlineSkillContent(agent);
  const skill = SKILL_FILES[agent] || SKILL_FILES.generic;
  const targetPath = path.join(process.cwd(), skill.path);
  const targetDir = path.dirname(targetPath);

  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(targetPath, skillContent);
  return skill.path;
}

function getInlineSkillContent(agent: string): string {
  if (agent === 'claude') {
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
proofshot start --description "what you are about to verify"
\`\`\`

This starts the dev server, opens a headless browser, and begins recording.
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

## Tips

- Always include a meaningful --description so the human knows what was tested
- Take screenshots before AND after key actions (e.g., before form submit, after redirect)
- If you find errors during verification, fix them and re-run the workflow
- The proof artifacts in ./proofshot-artifacts/ can be referenced in commit messages or PRs
`;
  }

  if (agent === 'cursor') {
    return `---
description: Visual verification of UI changes using ProofShot
globs: ["**/*.tsx", "**/*.jsx", "**/*.vue", "**/*.svelte", "**/*.html"]
---

After modifying UI files, visually verify changes with this workflow:

1. Start session: \`proofshot start --description "what you are verifying"\`
2. Drive browser: Use \`proofshot exec\` commands to navigate, click, fill forms, and take screenshots
3. Stop session: \`proofshot stop\` to bundle video + screenshots + error report

Key proofshot exec commands:
- \`proofshot exec snapshot -i\` — see interactive elements
- \`proofshot exec click @e3\` — click an element
- \`proofshot exec fill @e2 "text"\` — fill a form field
- \`proofshot exec screenshot step.png\` — capture a moment
`;
  }

  // Generic / codex
  return `# ProofShot Visual Verification

After building or modifying UI features, verify with this workflow:

1. Start: \`proofshot start --description "what you are verifying"\`
2. Test: Use \`proofshot exec\` to navigate, click, fill forms, take screenshots
3. Stop: \`proofshot stop\` — bundles video, screenshots, and error report

Key proofshot exec commands:
- \`proofshot exec snapshot -i\` — see interactive elements
- \`proofshot exec click @e3\` — click an element
- \`proofshot exec fill @e2 "text"\` — fill a form field
- \`proofshot exec screenshot step.png\` — capture a moment

Artifacts saved to ./proofshot-artifacts/ including video, screenshots, errors, and summary.
`;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd();

  // Check for existing config
  if (configExists() && !options.force) {
    console.log(
      chalk.yellow('proofshot.config.json already exists. Use --force to overwrite.'),
    );
    return;
  }

  // Detect framework
  const framework = detectFramework();
  if (!framework) {
    console.log(
      chalk.yellow(
        'Could not detect framework. No package.json found or no recognized framework.',
      ),
    );
    console.log(chalk.dim('Creating config with defaults. Edit proofshot.config.json to customize.'));
  }

  // Build config
  const config: ProofShotConfig = {
    devServer: {
      command: framework?.command || 'npm run dev',
      port: framework?.port || 3000,
      waitForText: framework?.waitForText || null,
      startupTimeout: 30000,
    },
    output: './proofshot-artifacts',
    defaultPages: ['/'],
    viewport: { width: 1280, height: 720 },
    headless: true,
  };

  // Write config
  const configPath = writeConfig(config, cwd);
  console.log(
    chalk.green('✓') +
      ` Created ${chalk.bold('proofshot.config.json')}` +
      (framework ? ` (detected ${chalk.cyan(framework.name)})` : ''),
  );

  // Detect/select agent and install skill file
  const agent = options.agent || detectAgent();
  const skillPath = installSkillFile(agent);
  if (skillPath) {
    console.log(
      chalk.green('✓') +
        ` Installed skill file: ${chalk.bold(skillPath)}` +
        ` (${agent})`,
    );
  }

  console.log('');
  console.log(chalk.dim('Ready! Tell your AI agent:'));
  console.log(chalk.white('  "Verify the changes visually with proofshot"'));
  console.log('');
  console.log(chalk.dim('Or run directly:'));
  console.log(chalk.white('  proofshot verify --pages "/"'));
}
