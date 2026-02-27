import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { loadConfig } from '../utils/config.js';
import { loadSession } from '../session/state.js';

const SESSION_LOG_FILENAME = 'session-log.json';

export interface SessionLogEntry {
  action: string;
  relativeTimeSec: number;
  timestamp: string;
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
 * proofshot exec <agent-browser-args...>
 *
 * 1. Read session state to get sessionDir and startedAt
 * 2. For screenshot commands, resolve paths into the session dir
 * 3. Calculate timestamp relative to session start
 * 4. Append entry to session-log.json
 * 5. Pass through to agent-browser and return its output
 */
export async function execCommand(args: string[]): Promise<void> {
  const action = args.join(' ');

  // Load session state
  const config = loadConfig();
  const outputDir = path.resolve(config.output);
  const session = loadSession(outputDir);

  // Resolve args (screenshot path rewriting)
  let resolvedArgs = args;
  if (session) {
    resolvedArgs = resolveScreenshotPath(args, session.sessionDir);
  }

  const resolvedAction = resolvedArgs.join(' ');

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

    const logPath = path.join(session.sessionDir, SESSION_LOG_FILENAME);
    const entries = loadSessionLog(session.sessionDir);
    entries.push(entry);
    fs.writeFileSync(logPath, JSON.stringify(entries, null, 2) + '\n');
  }

  // Pass through to agent-browser
  try {
    const result = execSync(`agent-browser ${resolvedAction}`, {
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
}
