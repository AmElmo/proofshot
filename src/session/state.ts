import * as fs from 'fs';
import * as path from 'path';

const SESSION_FILENAME = '.session.json';

export interface SessionState {
  startedAt: string;
  description: string | null;
  outputDir: string;
  sessionDir: string;
  videoPath: string;
  serverErrorLog: string;
  port: number;
  serverCommand: string | null;
  serverAlreadyRunning: boolean;
  recordingActive: boolean;
  viewport?: { width: number; height: number };
}

/**
 * Write session state to disk.
 */
export function saveSession(state: SessionState): void {
  const sessionPath = path.join(state.outputDir, SESSION_FILENAME);
  fs.writeFileSync(sessionPath, JSON.stringify(state, null, 2) + '\n');
}

/**
 * Read session state from disk.
 * Returns null if no active session.
 */
export function loadSession(outputDir: string): SessionState | null {
  const sessionPath = path.join(outputDir, SESSION_FILENAME);
  if (!fs.existsSync(sessionPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Check if a session is currently active.
 */
export function hasActiveSession(outputDir: string): boolean {
  return fs.existsSync(path.join(outputDir, SESSION_FILENAME));
}

/**
 * Delete the session state file (called after stop).
 */
export function clearSession(outputDir: string): void {
  const sessionPath = path.join(outputDir, SESSION_FILENAME);
  if (fs.existsSync(sessionPath)) {
    fs.unlinkSync(sessionPath);
  }
}
