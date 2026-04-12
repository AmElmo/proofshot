import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { readBundledSkill, getInlineSkillContent } from '../utils/skills.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToolName =
  | 'claude'
  | 'cursor'
  | 'codex'
  | 'gemini'
  | 'windsurf'
  | 'opencode';

type SkillTarget =
  | { strategy: 'file'; relativePath: string }
  | { strategy: 'append'; relativePath: string };

interface ToolDefinition {
  name: ToolName;
  displayName: string;
  binaryName: string;
  configDir: string;
  skillTarget: SkillTarget;
  /** Path inside the bundled skills/ directory */
  bundledSkill: string;
  /** Fallback agent key for inline content generation */
  inlineAgent: string;
}

interface InstallResult {
  tool: ToolName;
  displayName: string;
  status: 'installed' | 'updated' | 'skipped' | 'failed';
  path: string;
  message?: string;
}

export interface InstallOptions {
  only?: string;
  skip?: string;
  force?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MARKER_START = '<!-- proofshot:start -->';
const MARKER_END = '<!-- proofshot:end -->';

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

function getToolDefinitions(): ToolDefinition[] {
  const home = os.homedir();
  return [
    {
      name: 'claude',
      displayName: 'Claude Code',
      binaryName: 'claude',
      configDir: path.join(home, '.claude'),
      skillTarget: { strategy: 'file', relativePath: 'skills/proofshot/SKILL.md' },
      bundledSkill: 'claude/SKILL.md',
      inlineAgent: 'claude',
    },
    {
      name: 'cursor',
      displayName: 'Cursor',
      binaryName: 'cursor',
      configDir: path.join(home, '.cursor'),
      skillTarget: { strategy: 'file', relativePath: 'rules/proofshot.mdc' },
      bundledSkill: 'cursor/proofshot.mdc',
      inlineAgent: 'cursor',
    },
    {
      name: 'codex',
      displayName: 'Codex (OpenAI)',
      binaryName: 'codex',
      configDir: path.join(home, '.codex'),
      skillTarget: { strategy: 'file', relativePath: 'skills/proofshot/SKILL.md' },
      bundledSkill: 'codex/SKILL.md',
      inlineAgent: 'codex',
    },
    {
      name: 'gemini',
      displayName: 'Gemini CLI',
      binaryName: 'gemini',
      configDir: path.join(home, '.gemini'),
      skillTarget: { strategy: 'append', relativePath: 'GEMINI.md' },
      bundledSkill: 'generic/PROOFSHOT.md',
      inlineAgent: 'generic',
    },
    {
      name: 'windsurf',
      displayName: 'Windsurf',
      binaryName: 'windsurf',
      configDir: path.join(home, '.codeium', 'windsurf'),
      skillTarget: { strategy: 'append', relativePath: 'memories/global_rules.md' },
      bundledSkill: 'generic/PROOFSHOT.md',
      inlineAgent: 'generic',
    },
    {
      name: 'opencode',
      displayName: 'OpenCode',
      binaryName: 'opencode',
      configDir: path.join(home, '.config', 'opencode'),
      skillTarget: { strategy: 'file', relativePath: 'skills/proofshot/SKILL.md' },
      bundledSkill: 'opencode/SKILL.md',
      inlineAgent: 'codex',
    },
  ];
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function isBinaryAvailable(binaryName: string): boolean {
  const cmd = process.platform === 'win32' ? `where ${binaryName}` : `which ${binaryName}`;
  try {
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function detectInstalledTools(): ToolDefinition[] {
  return getToolDefinitions().filter(
    (tool) => isBinaryAvailable(tool.binaryName) || fs.existsSync(tool.configDir),
  );
}

function filterTools(
  detected: ToolDefinition[],
  only?: string,
  skip?: string,
): ToolDefinition[] {
  let tools = detected;
  if (only) {
    const onlySet = new Set(only.split(',').map((s) => s.trim().toLowerCase()));
    tools = tools.filter((t) => onlySet.has(t.name));
  }
  if (skip) {
    const skipSet = new Set(skip.split(',').map((s) => s.trim().toLowerCase()));
    tools = tools.filter((t) => !skipSet.has(t.name));
  }
  return tools;
}

// ---------------------------------------------------------------------------
// Content resolution
// ---------------------------------------------------------------------------

function getSkillContent(tool: ToolDefinition): string {
  return readBundledSkill(tool.bundledSkill) ?? getInlineSkillContent(tool.inlineAgent);
}

// ---------------------------------------------------------------------------
// Installation strategies
// ---------------------------------------------------------------------------

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function installFile(
  tool: ToolDefinition,
  targetPath: string,
  content: string,
  force: boolean,
): InstallResult {
  const exists = fs.existsSync(targetPath);
  if (exists && !force) {
    const existing = fs.readFileSync(targetPath, 'utf-8');
    if (existing === content) {
      return {
        tool: tool.name,
        displayName: tool.displayName,
        status: 'skipped',
        path: targetPath,
        message: 'Already up to date',
      };
    }
  }

  fs.writeFileSync(targetPath, content);
  return {
    tool: tool.name,
    displayName: tool.displayName,
    status: exists ? 'updated' : 'installed',
    path: targetPath,
  };
}

function installAppend(
  tool: ToolDefinition,
  targetPath: string,
  content: string,
  force: boolean,
): InstallResult {
  const markedContent = `${MARKER_START}\n${content}\n${MARKER_END}`;
  const exists = fs.existsSync(targetPath);

  if (exists) {
    const existing = fs.readFileSync(targetPath, 'utf-8');

    if (existing.includes(MARKER_START)) {
      // Replace existing marked block
      const regex = new RegExp(
        `${escapeRegex(MARKER_START)}[\\s\\S]*?${escapeRegex(MARKER_END)}`,
      );
      const updated = existing.replace(regex, markedContent);

      if (updated === existing && !force) {
        return {
          tool: tool.name,
          displayName: tool.displayName,
          status: 'skipped',
          path: targetPath,
          message: 'Already up to date',
        };
      }

      fs.writeFileSync(targetPath, updated);
      return {
        tool: tool.name,
        displayName: tool.displayName,
        status: 'updated',
        path: targetPath,
      };
    }

    // No markers found — append
    fs.appendFileSync(targetPath, '\n\n' + markedContent + '\n');
    return {
      tool: tool.name,
      displayName: tool.displayName,
      status: 'installed',
      path: targetPath,
    };
  }

  // File does not exist — create
  fs.writeFileSync(targetPath, markedContent + '\n');
  return {
    tool: tool.name,
    displayName: tool.displayName,
    status: 'installed',
    path: targetPath,
  };
}

function installForTool(tool: ToolDefinition, force: boolean): InstallResult {
  const content = getSkillContent(tool);
  const targetPath = path.join(tool.configDir, tool.skillTarget.relativePath);
  const targetDir = path.dirname(targetPath);

  try {
    fs.mkdirSync(targetDir, { recursive: true });

    if (tool.skillTarget.strategy === 'file') {
      return installFile(tool, targetPath, content, force);
    } else {
      return installAppend(tool, targetPath, content, force);
    }
  } catch (error: any) {
    return {
      tool: tool.name,
      displayName: tool.displayName,
      status: 'failed',
      path: targetPath,
      message: error.message,
    };
  }
}

// ---------------------------------------------------------------------------
// Interactive prompt
// ---------------------------------------------------------------------------

function checkboxSelect(tools: ToolDefinition[]): Promise<ToolDefinition[]> {
  return new Promise((resolve) => {
    const selected = new Array(tools.length).fill(true);
    let cursor = 0;

    function render() {
      // Move cursor up to overwrite previous render (except first)
      if (renderCount > 0) {
        process.stdout.write(`\x1b[${tools.length + 2}A`);
      }
      renderCount++;

      console.log(chalk.bold('Select tools to install:'));
      console.log('');
      for (let i = 0; i < tools.length; i++) {
        const check = selected[i] ? chalk.green('[x]') : chalk.dim('[ ]');
        const label = tools[i].displayName;
        const pointer = i === cursor ? chalk.green('> ') : '  ';
        console.log(`${pointer}${check} ${label}`);
      }
    }

    let renderCount = 0;
    render();
    console.log('');
    process.stdout.write(chalk.dim('  ↑/↓ navigate · space toggle · enter confirm'));

    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf-8');

    function onData(key: string) {
      // Ctrl+C
      if (key === '\x03') {
        stdin.setRawMode(false);
        stdin.removeListener('data', onData);
        stdin.pause();
        // Clear the hint line and move down
        process.stdout.write('\r\x1b[K\n');
        resolve([]);
        return;
      }

      // Enter
      if (key === '\r' || key === '\n') {
        stdin.setRawMode(false);
        stdin.removeListener('data', onData);
        stdin.pause();
        // Clear the hint line and move down
        process.stdout.write('\r\x1b[K\n');
        resolve(tools.filter((_, i) => selected[i]));
        return;
      }

      // Space — toggle
      if (key === ' ') {
        selected[cursor] = !selected[cursor];
        // Move up to re-render hint, then re-render
        process.stdout.write('\r\x1b[K');
        process.stdout.write(`\x1b[1A`);
        render();
        console.log('');
        process.stdout.write(chalk.dim('  ↑/↓ navigate · space toggle · enter confirm'));
        return;
      }

      // Arrow up
      if (key === '\x1b[A') {
        cursor = (cursor - 1 + tools.length) % tools.length;
        process.stdout.write('\r\x1b[K');
        process.stdout.write(`\x1b[1A`);
        render();
        console.log('');
        process.stdout.write(chalk.dim('  ↑/↓ navigate · space toggle · enter confirm'));
        return;
      }

      // Arrow down
      if (key === '\x1b[B') {
        cursor = (cursor + 1) % tools.length;
        process.stdout.write('\r\x1b[K');
        process.stdout.write(`\x1b[1A`);
        render();
        console.log('');
        process.stdout.write(chalk.dim('  ↑/↓ navigate · space toggle · enter confirm'));
        return;
      }
    }

    stdin.on('data', onData);
  });
}

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------

export async function installCommand(options: InstallOptions): Promise<void> {
  const allDetected = detectInstalledTools();
  const tools = filterTools(allDetected, options.only, options.skip);

  if (tools.length === 0) {
    if (options.only || options.skip) {
      console.log(chalk.yellow('No matching AI tools found after applying filters.'));
      console.log(
        chalk.dim(
          'Detected tools: ' + (allDetected.map((t) => t.name).join(', ') || 'none'),
        ),
      );
    } else {
      console.log(chalk.yellow('No AI coding tools detected on this machine.'));
      console.log(chalk.dim('Looked for: claude, cursor, codex, gemini, windsurf, opencode'));
    }
    return;
  }

  // Interactive selection (or install all if non-interactive)
  let selectedTools = tools;
  if (process.stdin.isTTY) {
    console.log('');
    const picked = await checkboxSelect(tools);
    if (picked.length === 0) {
      console.log(chalk.dim('Aborted.'));
      return;
    }
    selectedTools = picked;
  } else {
    console.log('');
    console.log(chalk.bold('Detected AI coding tools:'));
    console.log('');
    for (const tool of tools) {
      console.log(`  ${chalk.green('\u25cf')} ${tool.displayName}`);
    }
    console.log('');
  }

  // Install for each tool
  const results: InstallResult[] = [];
  for (const tool of selectedTools) {
    const result = installForTool(tool, !!options.force);
    results.push(result);

    const icon =
      result.status === 'failed'
        ? chalk.red('\u2717')
        : result.status === 'skipped'
          ? chalk.dim('\u2013')
          : chalk.green('\u2713');
    const statusText =
      result.status === 'installed'
        ? 'Installed'
        : result.status === 'updated'
          ? 'Updated'
          : result.status === 'skipped'
            ? 'Skipped'
            : 'Failed';
    const suffix = result.message ? chalk.dim(` (${result.message})`) : '';

    console.log(`${icon} ${tool.displayName}: ${statusText}${suffix}`);
    if (result.status !== 'failed') {
      console.log(chalk.dim(`  \u2192 ${result.path}`));
    } else if (result.message) {
      console.log(chalk.red(`  ${result.message}`));
    }
  }

  // Summary
  const installed = results.filter(
    (r) => r.status === 'installed' || r.status === 'updated',
  ).length;
  const failed = results.filter((r) => r.status === 'failed').length;
  console.log('');

  if (failed > 0) {
    console.log(chalk.yellow(`Done. ${installed} installed, ${failed} failed.`));
  } else if (installed > 0) {
    console.log(chalk.green(`Done! ProofShot skills installed for ${installed} tool(s).`));
    console.log('');
    console.log(`You're all set! In any project, tell your AI agent:`);
    console.log('');
    console.log(chalk.white(`  "Verify the changes visually with proofshot"`));
    console.log('');
  } else {
    console.log(chalk.dim('All tools already up to date.'));
  }
}
