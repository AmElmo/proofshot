import { ab } from '../utils/exec.js';

/**
 * Navigate to a URL and wait for the page to load.
 */
export function navigateTo(url: string, sessionName?: string): void {
  ab(`open ${url}`, { timeoutMs: 60000, session: sessionName });
  try {
    ab('wait --load networkidle', { timeoutMs: 30000, session: sessionName });
  } catch {
    // networkidle may timeout on some pages — that's okay,
    // we still have the page in whatever state it loaded to
  }
}

/**
 * Get a snapshot of the page's interactive elements.
 * Returns the accessibility tree with element refs (@e1, @e2, etc).
 */
export function getSnapshot(sessionName?: string): string {
  try {
    return ab('snapshot -i', { timeoutMs: 15000, session: sessionName });
  } catch {
    return '';
  }
}
