import { ab } from '../utils/exec.js';

/**
 * Navigate to a URL and wait for the page to load.
 */
export function navigateTo(url: string): void {
  ab(`open ${url}`, 60000);
  try {
    ab('wait --load networkidle', 30000);
  } catch {
    // networkidle may timeout on some pages — that's okay,
    // we still have the page in whatever state it loaded to
  }
}

/**
 * Get a snapshot of the page's interactive elements.
 * Returns the accessibility tree with element refs (@e1, @e2, etc).
 */
export function getSnapshot(): string {
  try {
    return ab('snapshot -i', 15000);
  } catch {
    return '';
  }
}
