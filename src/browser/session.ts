import { ab, ProofShotError } from '../utils/exec.js';
import {
  DEFAULT_BROWSER_OPEN_TIMEOUT_MS,
  type BrowserConfig,
  type TimeoutConfig,
  type ViewportConfig,
} from '../utils/config.js';

export function buildOpenBrowserCommand(
  url: string,
  headless = true,
  browserConfig?: BrowserConfig,
): string {
  const flags: string[] = [];

  if (!headless) flags.push('--headed');
  if (browserConfig?.ignoreHttpsErrors) flags.push('--ignore-https-errors');
  if (browserConfig?.executablePath) flags.push(`--executable-path "${browserConfig.executablePath.replace(/"/g, '\\"')}"`);

  const suffix = flags.length > 0 ? ` ${flags.join(' ')}` : '';
  return `open ${url}${suffix}`;
}
/**
 * Initialize a browser session.
 * Opens the browser and sets viewport dimensions.
 */
export function openBrowser(
  url: string,
  viewport: ViewportConfig,
  headless = true,
  sessionName?: string,
  browserConfig?: BrowserConfig,
  timeouts?: TimeoutConfig,
): void {
  ab(buildOpenBrowserCommand(url, headless, browserConfig), {
    timeoutMs: timeouts?.browserOpenMs ?? DEFAULT_BROWSER_OPEN_TIMEOUT_MS,
    session: sessionName,
  });
  ab(`set viewport ${viewport.width} ${viewport.height}`, { session: sessionName });
}

/**
 * Close the browser session.
 */
export function closeBrowser(sessionName?: string): void {
  try {
    ab('close', { session: sessionName });
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
export function getConsoleErrors(sessionName?: string): string {
  try {
    return ab('errors', { session: sessionName });
  } catch {
    return '';
  }
}

/**
 * Get console output from the current page.
 */
export function getConsoleOutput(sessionName?: string): string {
  try {
    return ab('console', { session: sessionName });
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
export function getConsoleOutputJson(sessionName?: string): ConsoleMessage[] {
  try {
    const raw = ab('console --json', { session: sessionName });
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
export function getPageTitle(sessionName?: string): string {
  try {
    return ab('get title', { session: sessionName });
  } catch {
    return '';
  }
}

/**
 * Get the current page URL.
 */
export function getPageUrl(sessionName?: string): string {
  try {
    return ab('get url', { session: sessionName });
  } catch {
    return '';
  }
}
