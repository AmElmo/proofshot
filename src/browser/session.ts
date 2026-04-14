import { ab, ProofShotError } from '../utils/exec.js';
import type { BrowserConfig, ViewportConfig } from '../utils/config.js';

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

export interface BrowserState {
  url: string;
  viewport: ViewportConfig | null;
}

export function openBrowser(
  url: string,
  viewport: ViewportConfig,
  headless = true,
  sessionName?: string,
  browserConfig?: BrowserConfig,
): void {
  ab(buildOpenBrowserCommand(url, headless, browserConfig), { timeoutMs: 60000, session: sessionName });
  applyViewport(viewport, sessionName);
}

export function applyViewport(viewport: ViewportConfig, sessionName?: string): void {
  const scale = viewport.deviceScaleFactor;
  const suffix = typeof scale === 'number' && Number.isFinite(scale) ? ` ${scale}` : '';
  ab(`set viewport ${viewport.width} ${viewport.height}${suffix}`, { session: sessionName });
}

export function closeBrowser(sessionName?: string): void {
  try {
    ab('close', { session: sessionName });
  } catch {
    // Browser may already be closed — that's fine
  }
}

export function checkAgentBrowser(): boolean {
  try {
    ab('--version', 5000);
    return true;
  } catch {
    return false;
  }
}

export function getConsoleErrors(sessionName?: string): string {
  try {
    return ab('errors', { session: sessionName });
  } catch {
    return '';
  }
}

export function getConsoleOutput(sessionName?: string): string {
  try {
    return ab('console', { session: sessionName });
  } catch {
    return '';
  }
}

export interface ConsoleMessage {
  text: string;
  timestamp: number;
  type: string;
}

export function getConsoleOutputJson(sessionName?: string): ConsoleMessage[] {
  try {
    const raw = ab('console --json', { session: sessionName });
    const parsed = JSON.parse(raw);
    const messages = parsed?.data?.messages ?? parsed;
    return Array.isArray(messages) ? messages : [];
  } catch {
    return [];
  }
}

export function getPageTitle(sessionName?: string): string {
  try {
    return ab('get title', { session: sessionName });
  } catch {
    return '';
  }
}

export function getPageUrl(sessionName?: string): string {
  try {
    return ab('get url', { session: sessionName });
  } catch {
    return '';
  }
}

export function getViewport(sessionName?: string): ViewportConfig | null {
  try {
    const raw = ab("eval 'JSON.stringify({width: window.innerWidth, height: window.innerHeight})'", {
      session: sessionName,
    });
    const parsed = parseViewportPayload(raw);
    if (
      typeof parsed?.width === 'number' &&
      Number.isFinite(parsed.width) &&
      typeof parsed?.height === 'number' &&
      Number.isFinite(parsed.height)
    ) {
      return { width: parsed.width, height: parsed.height };
    }
    return null;
  } catch {
    return null;
  }
}

function parseViewportPayload(raw: string): unknown {
  const parsed = JSON.parse(raw);
  if (typeof parsed === 'string') {
    return JSON.parse(parsed);
  }
  return parsed;
}

function normalizeUrlForComparison(value: string): string {
  try {
    const url = new URL(value);
    const pathname = url.pathname !== '/' ? url.pathname.replace(/\/+$/, '') : '/';
    return `${url.origin}${pathname}${url.search}`;
  } catch {
    return value.trim();
  }
}

export function urlsMatch(expectedUrl: string, actualUrl: string): boolean {
  return normalizeUrlForComparison(expectedUrl) === normalizeUrlForComparison(actualUrl);
}

export function verifyBrowserState(
  expectedUrl: string,
  expectedViewport: ViewportConfig,
  sessionName?: string,
): BrowserState {
  const url = getPageUrl(sessionName);
  const viewport = getViewport(sessionName);

  if (!url) {
    throw new ProofShotError(
      'Could not read the current browser URL after recording started. The browser session may not be attached correctly.',
    );
  }

  if (!urlsMatch(expectedUrl, url)) {
    throw new ProofShotError(
      `Browser navigated to ${url}, expected ${expectedUrl}. Recording may be attached to the wrong page or session.`,
    );
  }

  if (!viewport) {
    throw new ProofShotError(
      'Could not read the current viewport after recording started. The browser session may not be attached correctly.',
    );
  }

  if (viewport.width !== expectedViewport.width || viewport.height !== expectedViewport.height) {
    throw new ProofShotError(
      `Browser viewport is ${viewport.width}x${viewport.height}, expected ${expectedViewport.width}x${expectedViewport.height}. Recording may be attached to the wrong page or session.`,
    );
  }

  return { url, viewport };
}
