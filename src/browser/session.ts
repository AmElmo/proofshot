import { ab, ProofShotError } from '../utils/exec.js';
import type { ViewportConfig } from '../utils/config.js';

/**
 * Initialize a browser session.
 * Opens the browser and sets viewport dimensions.
 */
export function openBrowser(
  url: string,
  viewport: ViewportConfig,
  headless = true,
): void {
  const headlessFlag = headless ? '' : ' --headed';
  ab(`open ${url}${headlessFlag}`, 60000);
  ab(`set viewport ${viewport.width} ${viewport.height}`);
}

/**
 * Close the browser session.
 */
export function closeBrowser(): void {
  try {
    ab('close');
  } catch {
    // Browser may already be closed — that's fine
  }
}

/**
 * Check if agent-browser is installed and accessible.
 */
export function checkAgentBrowser(): boolean {
  try {
    ab('--version', 5000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get any console errors from the current page.
 */
export function getConsoleErrors(): string {
  try {
    return ab('errors');
  } catch {
    return '';
  }
}

/**
 * Get console output from the current page.
 */
export function getConsoleOutput(): string {
  try {
    return ab('console');
  } catch {
    return '';
  }
}

export interface ConsoleMessage {
  text: string;
  timestamp: number; // epoch ms
  type: string; // log, warn, error, etc.
}

/**
 * Get console output as structured JSON with per-message timestamps.
 */
export function getConsoleOutputJson(): ConsoleMessage[] {
  try {
    const raw = ab('console --json');
    const parsed = JSON.parse(raw);
    // agent-browser wraps JSON output: {success, data: {messages: [...]}, error}
    const messages = parsed?.data?.messages ?? parsed;
    return Array.isArray(messages) ? messages : [];
  } catch {
    return [];
  }
}

/**
 * Get the current page title.
 */
export function getPageTitle(): string {
  try {
    return ab('get title');
  } catch {
    return '';
  }
}

/**
 * Get the current page URL.
 */
export function getPageUrl(): string {
  try {
    return ab('get url');
  } catch {
    return '';
  }
}
