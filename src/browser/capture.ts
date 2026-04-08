import { ab } from '../utils/exec.js';
import {
  DEFAULT_RECORDING_START_TIMEOUT_MS,
  DEFAULT_RECORDING_STOP_TIMEOUT_MS,
  DEFAULT_SCREENSHOT_TIMEOUT_MS,
  type TimeoutConfig,
} from '../utils/config.js';

/**
 * Start video recording to the given file path.
 */
export function startRecording(
  outputPath: string,
  sessionName?: string,
  timeouts?: TimeoutConfig,
): void {
  ab(`record start ${outputPath}`, {
    timeoutMs: timeouts?.recordingStartMs ?? DEFAULT_RECORDING_START_TIMEOUT_MS,
    session: sessionName,
  });
}

/**
 * Stop the current recording.
 */
export function stopRecording(sessionName?: string, timeouts?: TimeoutConfig): void {
  try {
    ab('record stop', {
      timeoutMs: timeouts?.recordingStopMs ?? DEFAULT_RECORDING_STOP_TIMEOUT_MS,
      session: sessionName,
    });
  } catch {
    // Recording may not have started — that's fine
  }
}

/**
 * Take a screenshot and save to the given path.
 */
export function takeScreenshot(
  outputPath: string,
  fullPage = true,
  sessionName?: string,
  timeouts?: TimeoutConfig,
): void {
  const fullFlag = fullPage ? ' --full' : '';
  ab(`screenshot ${outputPath}${fullFlag}`, {
    timeoutMs: timeouts?.screenshotMs ?? DEFAULT_SCREENSHOT_TIMEOUT_MS,
    session: sessionName,
  });
}

/**
 * Take an annotated screenshot (labels interactive elements).
 */
export function takeAnnotatedScreenshot(
  outputPath: string,
  sessionName?: string,
  timeouts?: TimeoutConfig,
): void {
  ab(`screenshot ${outputPath} --annotate`, {
    timeoutMs: timeouts?.screenshotMs ?? DEFAULT_SCREENSHOT_TIMEOUT_MS,
    session: sessionName,
  });
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
  timeouts?: TimeoutConfig,
): number | null {
  try {
    const result = ab(`diff screenshot ${baseline} ${current} ${outputPath}`, {
      timeoutMs: timeouts?.screenshotMs ?? DEFAULT_SCREENSHOT_TIMEOUT_MS,
      session: sessionName,
    });
    const match = result.match(/([\d.]+)%/);
    return match ? parseFloat(match[1]) : null;
  } catch {
    return null;
  }
}
