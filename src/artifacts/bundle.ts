import * as fs from 'fs';
import * as path from 'path';

export interface PageResult {
  page: string;
  title: string;
  url: string;
  screenshotPath: string;
  snapshot: string;
  errors: string;
  consoleOutput: string;
}

export interface VerificationResult {
  pageResults: PageResult[];
  videoPath: string | null;
  outputDir: string;
  timestamp: string;
  framework: string;
  port: number;
  serverAlreadyRunning: boolean;
  durationMs: number;
}

/**
 * Ensure the output directory exists.
 */
export function ensureOutputDir(outputDir: string): void {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Slugify a page path for use in filenames.
 * "/" -> "home", "/dashboard" -> "dashboard", "/settings/profile" -> "settings-profile"
 */
export function slugifyPage(pagePath: string): string {
  if (pagePath === '/' || pagePath === '') return 'home';
  return pagePath
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/\//g, '-')
    .replace(/[^a-zA-Z0-9-_]/g, '');
}

/**
 * Generate a timestamp string for filenames.
 */
export function generateTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

/**
 * Generate a session folder name from timestamp and optional description.
 * e.g. "2026-02-27_14-22-09_verify-settings-page" or "2026-02-27_14-22-09"
 */
export function generateSessionDirName(timestamp: string, description: string | null): string {
  if (!description) return timestamp;
  const slug = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .replace(/-$/, '');
  return slug ? `${timestamp}_${slug}` : timestamp;
}

/**
 * Count interactive elements from a snapshot string.
 */
export function countInteractiveElements(snapshot: string): {
  buttons: number;
  links: number;
  forms: number;
  inputs: number;
} {
  const buttons = (snapshot.match(/button/gi) || []).length;
  const links = (snapshot.match(/link|<a /gi) || []).length;
  const forms = (snapshot.match(/form/gi) || []).length;
  const inputs = (snapshot.match(/input|textbox|textarea/gi) || []).length;
  return { buttons, links, forms, inputs };
}

/**
 * Count console errors from the errors string.
 */
export function countErrors(errors: string): number {
  if (!errors || errors.trim() === '' || errors.trim() === 'No errors') return 0;
  return errors.split('\n').filter((line) => line.trim()).length;
}

/**
 * Count console warnings from console output.
 */
export function countWarnings(consoleOutput: string): number {
  if (!consoleOutput) return 0;
  return (consoleOutput.match(/warn/gi) || []).length;
}

/**
 * Get all artifact file paths in the output directory.
 */
export function listArtifacts(outputDir: string): string[] {
  if (!fs.existsSync(outputDir)) return [];
  return fs.readdirSync(outputDir).map((f) => path.join(outputDir, f));
}
