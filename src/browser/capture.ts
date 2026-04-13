import { ab } from '../utils/exec.js';

/**
 * Start video recording to the given file path.
 */
export function startRecording(outputPath: string, sessionName?: string): void {
  ab(`record start ${outputPath}`, { timeoutMs: 10000, session: sessionName });
}

/**
 * Stop the current recording.
 */
export function stopRecording(sessionName?: string): void {
  try {
    ab('record stop', { timeoutMs: 15000, session: sessionName });
  } catch {
    // Recording may not have started — that's fine
  }
}

/**
 * Take a screenshot and save to the given path.
 */
export function takeScreenshot(outputPath: string, fullPage = true, sessionName?: string): void {
  const fullFlag = fullPage ? ' --full' : '';
  ab(`screenshot ${outputPath}${fullFlag}`, { timeoutMs: 15000, session: sessionName });
}

/**
 * Take an annotated screenshot (labels interactive elements).
 */
export function takeAnnotatedScreenshot(outputPath: string, sessionName?: string): void {
  ab(`screenshot ${outputPath} --annotate`, { timeoutMs: 15000, session: sessionName });
}

/**
 * Compare two screenshots and output a diff image.
 * Returns the mismatch percentage, or null if diff failed.
 */
export function diffScreenshots(
  baseline: string,
  current: string,
  outputPath: string,
  sessionName?: string,
): number | null {
  try {
    const result = ab(`diff screenshot ${baseline} ${current} ${outputPath}`, {
      timeoutMs: 15000,
      session: sessionName,
    });
    // Parse mismatch percentage from output
    const match = result.match(/([\d.]+)%/);
    return match ? parseFloat(match[1]) : null;
  } catch {
    return null;
  }
}
