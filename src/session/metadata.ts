import * as fs from 'fs';
import * as path from 'path';

const METADATA_FILENAME = 'metadata.json';

export interface SessionMetadata {
  branch: string;
  commitSha: string;
  startedAt: string;
  description: string | null;
}

/**
 * Write metadata.json into a session folder.
 * This file persists after proofshot stop (unlike .session.json).
 */
export function writeMetadata(sessionDir: string, metadata: SessionMetadata): void {
  const metadataPath = path.join(sessionDir, METADATA_FILENAME);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n');
}

/**
 * Read metadata.json from a session folder.
 * Returns null if the file doesn't exist or is malformed.
 */
export function loadMetadata(sessionDir: string): SessionMetadata | null {
  const metadataPath = path.join(sessionDir, METADATA_FILENAME);
  if (!fs.existsSync(metadataPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Find all session folders in the output directory that match a given branch.
 * Scans subdirectories for metadata.json, filters by branch name.
 * Returns session directories sorted newest first (by startedAt).
 */
export function findSessionsForBranch(outputDir: string, branch: string): string[] {
  if (!fs.existsSync(outputDir)) return [];

  const entries = fs.readdirSync(outputDir, { withFileTypes: true });
  const matches: { dir: string; startedAt: string }[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sessionDir = path.join(outputDir, entry.name);
    const metadata = loadMetadata(sessionDir);
    if (metadata && metadata.branch === branch) {
      matches.push({ dir: sessionDir, startedAt: metadata.startedAt });
    }
  }

  // Sort newest first
  matches.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return matches.map((m) => m.dir);
}
