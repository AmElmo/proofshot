import { ab } from '../utils/exec.js';

/**
 * Start video recording to the given file path.
 */
export function startRecording(outputPath: string): void {
  ab(`record start ${outputPath}`, 10000);
}

/**
 * Stop the current recording.
 */
export function stopRecording(): void {
  try {
    ab('record stop', 15000);
  } catch {
    // Recording may not have started — that's fine
  }
}

/**
 * Take a screenshot and save to the given path.
 */
export function takeScreenshot(outputPath: string, fullPage = true): void {
  const fullFlag = fullPage ? ' --full' : '';
  ab(`screenshot ${outputPath}${fullFlag}`, 15000);
}

/**
 * Take an annotated screenshot (labels interactive elements).
 */
export function takeAnnotatedScreenshot(outputPath: string): void {
  ab(`screenshot ${outputPath} --annotate`, 15000);
}

/**
 * Compare two screenshots and output a diff image.
 * Returns the mismatch percentage, or null if diff failed.
 */
export function diffScreenshots(
  baseline: string,
  current: string,
  outputPath: string,
): number | null {
  try {
    const result = ab(`diff screenshot ${baseline} ${current} ${outputPath}`, 15000);
    // Parse mismatch percentage from output
    const match = result.match(/([\d.]+)%/);
    return match ? parseFloat(match[1]) : null;
  } catch {
    return null;
  }
}
