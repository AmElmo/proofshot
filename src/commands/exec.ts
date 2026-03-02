import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { loadConfig } from '../utils/config.js';
import { ab } from '../utils/exec.js';
import { loadSession, saveSession, type SessionState } from '../session/state.js';

const SESSION_LOG_FILENAME = 'session-log.json';

export interface SessionLogEntry {
  action: string;
  relativeTimeSec: number;
  timestamp: string;
  element?: {
    label: string;
    bbox: { x: number; y: number; width: number; height: number };
    viewport: { width: number; height: number };
  };
}

/**
 * Load existing session log entries from disk.
 */
export function loadSessionLog(sessionDir: string): SessionLogEntry[] {
  const logPath = path.join(sessionDir, SESSION_LOG_FILENAME);
  if (!fs.existsSync(logPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(logPath, 'utf-8'));
  } catch {
    return [];
  }
}

/**
 * For screenshot commands, resolve relative paths into the session directory
 * so agents can just say `proofshot exec screenshot step-name.png`.
 */
function resolveScreenshotPath(args: string[], sessionDir: string): string[] {
  if (args[0] !== 'screenshot' || args.length < 2) return args;

  const screenshotPath = args[args.length - 1];
  // If it's already absolute, leave it alone
  if (path.isAbsolute(screenshotPath)) return args;

  // Resolve relative to session dir
  const resolved = path.join(sessionDir, screenshotPath);
  return [...args.slice(0, -1), resolved];
}

/**
 * Build the shell command string for agent-browser.
 *
 * For `eval` commands, we need to pass the JS code as a single quoted argument
 * to prevent the shell from interpreting parentheses, brackets, etc.
 * For other commands, simple joining is fine.
 */
function buildShellCommand(args: string[]): string {
  if (args[0] === 'eval' && args.length > 1) {
    // Join everything after 'eval' as the JS code, wrap in single quotes
    const jsCode = args.slice(1).join(' ');
    // Escape any single quotes in the JS code for shell safety
    const escaped = jsCode.replace(/'/g, "'\\''");
    return `agent-browser eval '${escaped}'`;
  }

  // For all other commands, quote each arg that contains shell-special chars
  const quotedArgs = args.map((arg) => {
    if (/[(){}[\]$`!#&|;<>*? "'\\]/.test(arg)) {
      const escaped = arg.replace(/'/g, "'\\''");
      return `'${escaped}'`;
    }
    return arg;
  });
  return `agent-browser ${quotedArgs.join(' ')}`;
}

/**
 * Parse an element ref (@eN) from command args.
 */
function parseElementRef(args: string[]): string | null {
  for (const arg of args) {
    const match = arg.match(/@e\d+/);
    if (match) return match[0];
  }
  return null;
}

/**
 * Capture element bounding box and label before action execution.
 *
 * agent-browser's `get box` doesn't support @eN refs, but `get text` and
 * `get attr` do. Strategy:
 * 1. Try `get attr @eN id` — if found, use `get box #<id>` (reliable for inputs)
 * 2. Otherwise try `get text @eN` — use `get box "text=<label>"` (works for links/buttons)
 * 3. Label comes from get text (links/buttons) or get attr fallback chain (inputs)
 *
 * None of these commands invalidate snapshot refs, so the subsequent action still works.
 */
function captureElementData(
  ref: string,
  viewport: { width: number; height: number },
): SessionLogEntry['element'] | null {
  try {
    let bbox: { x: number; y: number; width: number; height: number } | null = null;
    let label = '';

    // Strategy 1: Try id-based selector (works for inputs with id attributes)
    let elemId = '';
    try { elemId = ab(`get attr ${ref} id`); } catch { /* empty */ }

    if (elemId) {
      try {
        const raw = ab(`get box '#${elemId}'`);
        bbox = JSON.parse(raw);
      } catch { /* empty */ }

      // For inputs, get label from associated <label> via eval (doesn't invalidate refs)
      try {
        const raw = ab(`eval "document.getElementById('${elemId}')?.labels?.[0]?.textContent||document.getElementById('${elemId}')?.placeholder||document.getElementById('${elemId}')?.getAttribute('aria-label')||''"`);
        label = JSON.parse(raw) || '';
      } catch { /* empty */ }
    }

    // Strategy 2: Try text-based selector (works for links, buttons)
    if (!bbox) {
      try { label = ab(`get text ${ref}`); } catch { /* empty */ }
      if (!label) {
        try { label = ab(`get attr ${ref} placeholder`); } catch { /* empty */ }
      }
      if (!label) {
        try { label = ab(`get attr ${ref} aria-label`); } catch { /* empty */ }
      }
      if (!label) {
        try { label = ab(`get attr ${ref} name`); } catch { /* empty */ }
      }

      if (label) {
        try {
          const escaped = label.replace(/'/g, "\\'");
          const raw = ab(`get box 'text=${escaped}'`);
          bbox = JSON.parse(raw);
        } catch { /* empty */ }
      }
    }

    if (!bbox) return null;

    return {
      label: label || '',
      bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height },
      viewport,
    };
  } catch {
    return null;
  }
}

/**
 * Check if the action is ref-targeted (click, fill, type with @eN).
 */
function isRefTargetedAction(args: string[]): boolean {
  const cmd = args[0]?.toLowerCase();
  return (cmd === 'click' || cmd === 'fill' || cmd === 'type') && parseElementRef(args) !== null;
}

/**
 * proofshot exec <agent-browser-args...>
 *
 * 1. Read session state to get sessionDir and startedAt
 * 2. For screenshot commands, resolve paths into the session dir
 * 3. For ref-targeted actions, capture element bbox + label BEFORE execution
 * 4. Calculate timestamp relative to session start
 * 5. Append entry to session-log.json
 * 6. Pass through to agent-browser and return its output
 * 7. If action was `set viewport`, update cached viewport in session state
 */
export async function execCommand(args: string[]): Promise<void> {
  const action = args.join(' ');

  // Load session state
  const config = loadConfig();
  const outputDir = path.resolve(config.output);
  const session = loadSession(outputDir);

  if (session && !session.recordingActive) {
    console.error(
      'Error: Session has no active recording. Video capture is required.\n' +
        'Run "proofshot stop" to end this session, then start a new one.',
    );
    process.exit(1);
  }

  // Resolve args (screenshot path rewriting)
  let resolvedArgs = args;
  if (session) {
    resolvedArgs = resolveScreenshotPath(args, session.sessionDir);
  }

  // Capture element data BEFORE execution (element may be gone after click navigation)
  let elementData: SessionLogEntry['element'] | undefined;
  if (session && isRefTargetedAction(args)) {
    const ref = parseElementRef(args)!;
    const viewport = session.viewport || { width: 1280, height: 720 };
    const captured = captureElementData(ref, viewport);
    if (captured) elementData = captured;
  }

  // Log the action if a session is active
  if (session) {
    const now = new Date();
    const startTime = new Date(session.startedAt).getTime();
    const relativeTimeSec = parseFloat(((now.getTime() - startTime) / 1000).toFixed(1));

    const entry: SessionLogEntry = {
      action,
      relativeTimeSec,
      timestamp: now.toISOString(),
    };
    if (elementData) {
      entry.element = elementData;
    }

    const logPath = path.join(session.sessionDir, SESSION_LOG_FILENAME);
    const entries = loadSessionLog(session.sessionDir);
    entries.push(entry);
    fs.writeFileSync(logPath, JSON.stringify(entries, null, 2) + '\n');
  }

  // Build shell command with proper quoting
  const shellCmd = buildShellCommand(resolvedArgs);

  // Pass through to agent-browser
  try {
    const result = execSync(shellCmd, {
      encoding: 'utf-8',
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.trim()) {
      process.stdout.write(result);
      // Ensure trailing newline
      if (!result.endsWith('\n')) {
        process.stdout.write('\n');
      }
    }
  } catch (error: any) {
    // Print stderr and exit with the same code
    const stderr = error?.stderr?.toString?.() || '';
    const stdout = error?.stdout?.toString?.() || '';
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    process.exit(error?.status || 1);
  }

  // If the action was `set viewport`, update cached viewport in session state
  if (session && args[0] === 'set' && args[1] === 'viewport') {
    try {
      const vpJson = ab("eval 'JSON.stringify({width: window.innerWidth, height: window.innerHeight})'");
      const vp = JSON.parse(vpJson);
      session.viewport = { width: vp.width, height: vp.height };
      saveSession(session);
    } catch {
      // Non-critical — viewport cache stays stale
    }
  }
}
