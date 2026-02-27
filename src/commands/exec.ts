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
export function loadSessionLog(outputDir: string): SessionLogEntry[] {
  const logPath = path.join(outputDir, SESSION_LOG_FILENAME);
  if (!fs.existsSync(logPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(logPath, 'utf-8'));
  } catch {
    return [];
  }
}

/**
 * proofshot exec <agent-browser-args...>
 *
 * 1. Read session state to get outputDir and startedAt
 * 2. Calculate timestamp relative to session start
 * 3. Append entry to session-log.json
 * 4. Pass through to agent-browser and return its output
 */
export async function execCommand(args: string[]): Promise<void> {
  const action = args.join(' ');

  // Load session state
  const config = loadConfig();
  const outputDir = path.resolve(config.output);
  const session = loadSession(outputDir);

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

    const logPath = path.join(outputDir, SESSION_LOG_FILENAME);
    const entries = loadSessionLog(outputDir);
    entries.push(entry);
    fs.writeFileSync(logPath, JSON.stringify(entries, null, 2) + '\n');
  }

  // Pass through to agent-browser
  try {
    const result = execSync(`agent-browser ${action}`, {
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
