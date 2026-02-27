import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { loadConfig } from '../utils/config.js';
import { closeBrowser, getConsoleErrors, getConsoleOutput } from '../browser/session.js';
import { stopRecording } from '../browser/capture.js';
import { loadSession, clearSession } from '../session/state.js';
import { writeViewer } from '../artifacts/viewer.js';

interface StopOptions {
  noClose?: boolean;
}

export async function stopCommand(options: StopOptions): Promise<void> {
  const config = loadConfig();
  const outputDir = path.resolve(config.output);

  // Load session state
  const session = loadSession(outputDir);
  if (!session) {
    console.error(
      chalk.red('✗') +
        ' No active session found.\n' +
        chalk.dim('Run "proofshot start" first.'),
    );
    process.exit(1);
  }

  const startTime = new Date(session.startedAt).getTime();
  const durationMs = Date.now() - startTime;
  const durationSec = Math.round(durationMs / 1000);

  // Step 1: Collect console errors and output
  console.log(chalk.dim('Collecting errors...'));
  let consoleErrors = '';
  let consoleOutput = '';
  try {
    consoleErrors = getConsoleErrors();
    consoleOutput = getConsoleOutput();
  } catch {
    // Browser may already be closed
  }

  // Step 2: Stop recording
  console.log(chalk.dim('Stopping recording...'));
  stopRecording();

  // Step 3: Close browser (unless --no-close)
  if (!options.noClose) {
    console.log(chalk.dim('Closing browser...'));
    closeBrowser();
  }

  // Step 4: Read server error log
  let serverErrors = '';
  if (fs.existsSync(session.serverErrorLog)) {
    serverErrors = fs.readFileSync(session.serverErrorLog, 'utf-8');
  }

  // Step 5: Find all screenshots in output dir
  const screenshots = fs.existsSync(outputDir)
    ? fs.readdirSync(outputDir).filter((f) => f.endsWith('.png'))
    : [];

  // Step 5.5: Trim video dead time
  if (fs.existsSync(session.videoPath) && screenshots.length > 0) {
    trimVideo(session.videoPath, screenshots, outputDir, startTime);
  }

  // Step 6: Count errors
  const consoleErrorLines = consoleErrors
    .split('\n')
    .filter((l) => l.trim() && l.trim() !== 'No errors');
  const consoleErrorCount = consoleErrorLines.length > 0 && consoleErrors.trim() !== '' ? consoleErrorLines.length : 0;

  // Extract actual errors from server log (lines containing "error", "Error", "ERR", stack traces)
  const serverErrorLines = serverErrors
    .split('\n')
    .filter((l) => /error|ERR|Error|ENOENT|EACCES|TypeError|ReferenceError|SyntaxError|at\s+/.test(l));
  const serverErrorCount = serverErrorLines.length;

  // Step 7: Generate SUMMARY.md
  const summaryPath = path.join(outputDir, 'SUMMARY.md');
  const summary = generateProofSummary({
    description: session.description,
    framework: session.framework,
    port: session.port,
    videoPath: session.videoPath,
    screenshots,
    consoleErrors,
    consoleErrorCount,
    serverErrors,
    serverErrorCount,
    durationSec,
    outputDir,
  });
  fs.writeFileSync(summaryPath, summary);

  // Step 7.5: Generate interactive viewer (if session log exists)
  const viewerPath = writeViewer(outputDir, {
    description: session.description,
    framework: session.framework,
    durationSec,
    videoFilename: path.basename(session.videoPath),
    consoleErrorCount,
    serverErrorCount,
  });

  // Step 8: Clear session state
  clearSession(outputDir);

  // Step 9: Print results
  console.log('');
  console.log(chalk.green.bold('✅ ProofShot verification complete'));
  console.log('');

  if (fs.existsSync(session.videoPath)) {
    console.log(`📹 Video:         ${chalk.dim(session.videoPath)} (${durationSec}s)`);
  }
  console.log(`📸 Screenshots:   ${screenshots.length} captured`);
  console.log(`📝 Summary:       ${chalk.dim(summaryPath)}`);
  if (viewerPath) {
    console.log(`🎬 Viewer:        ${chalk.dim(viewerPath)}`);
  } else {
    console.log(chalk.dim('Tip: Use "proofshot exec" instead of "agent-browser" to get an interactive timeline viewer.'));
  }
  console.log('');
  console.log(
    `Console errors:   ${consoleErrorCount === 0 ? chalk.green('0') : chalk.red(String(consoleErrorCount))}`,
  );
  console.log(
    `Server errors:    ${serverErrorCount === 0 ? chalk.green('0') : chalk.red(String(serverErrorCount))}`,
  );
  console.log(`Duration:         ${durationSec} seconds`);
  console.log('');
  console.log(`Proof artifacts saved to ${chalk.dim(outputDir)}`);

  // If errors were found, print them for immediate feedback
  if (consoleErrorCount > 0) {
    console.log('');
    console.log(chalk.red.bold('Console Errors:'));
    for (const line of consoleErrorLines.slice(0, 10)) {
      console.log(chalk.red(`  ${line}`));
    }
    if (consoleErrorLines.length > 10) {
      console.log(chalk.dim(`  ... and ${consoleErrorLines.length - 10} more (see SUMMARY.md)`));
    }
  }

  if (serverErrorCount > 0) {
    console.log('');
    console.log(chalk.red.bold('Server Errors:'));
    for (const line of serverErrorLines.slice(0, 10)) {
      console.log(chalk.red(`  ${line}`));
    }
    if (serverErrorLines.length > 10) {
      console.log(chalk.dim(`  ... and ${serverErrorLines.length - 10} more (see SUMMARY.md)`));
    }
  }
}

interface SummaryData {
  description: string | null;
  framework: string;
  port: number;
  videoPath: string;
  screenshots: string[];
  consoleErrors: string;
  consoleErrorCount: number;
  serverErrors: string;
  serverErrorCount: number;
  durationSec: number;
  outputDir: string;
}

function generateProofSummary(data: SummaryData): string {
  const date = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const projectName = path.basename(process.cwd());

  let md = `# ProofShot Verification Report

**Date:** ${date}
**Project:** ${projectName}
**Framework:** ${data.framework}
**Dev Server:** localhost:${data.port}

`;

  if (data.description) {
    md += `## What Was Verified

${data.description}

`;
  }

  // Video
  const relativeVideo = path.basename(data.videoPath);
  md += `## Video Recording

Full session recording: [${relativeVideo}](./${relativeVideo}) (${data.durationSec}s)

`;

  // Screenshots
  if (data.screenshots.length > 0) {
    md += `## Screenshots

`;
    for (const ss of data.screenshots) {
      md += `![${ss}](./${ss})\n\n`;
    }
  }

  // Console errors
  md += `## Console Errors

`;
  if (data.consoleErrorCount === 0) {
    md += `No console errors detected.\n\n`;
  } else {
    md += `${data.consoleErrorCount} error(s) detected:\n\n\`\`\`\n${data.consoleErrors}\n\`\`\`\n\n`;
  }

  // Server errors
  md += `## Server Errors

`;
  if (data.serverErrorCount === 0) {
    md += `No server errors detected.\n\n`;
  } else {
    md += `${data.serverErrorCount} error(s) detected:\n\n\`\`\`\n${data.serverErrors.slice(0, 5000)}\n\`\`\`\n\n`;
    if (data.serverErrors.length > 5000) {
      md += `_(truncated — see server-errors.log for full output)_\n\n`;
    }
  }

  // Environment
  md += `## Environment
- Browser: Chromium (headless)
- Viewport: 1280x720
- Duration: ${data.durationSec} seconds
`;

  return md;
}

/**
 * Trim dead time from the beginning and end of the session video.
 * Uses screenshot file creation timestamps to find the active portion,
 * then trims with ffmpeg if available.
 */
function trimVideo(
  videoPath: string,
  screenshots: string[],
  outputDir: string,
  recordingStartMs: number,
): void {
  // Get file birth times for all screenshots
  const timestamps = screenshots
    .map((f) => {
      try {
        return fs.statSync(path.join(outputDir, f)).birthtimeMs;
      } catch {
        return null;
      }
    })
    .filter((t): t is number => t !== null);

  if (timestamps.length === 0) return;

  const firstActionMs = Math.min(...timestamps);
  const lastActionMs = Math.max(...timestamps);

  // Buffer: 2s for multiple screenshots, 5s for a single screenshot
  const buffer = timestamps.length === 1 ? 5 : 2;

  const trimStartSec = Math.max(0, (firstActionMs - recordingStartMs) / 1000 - buffer);
  const trimEndSec = (lastActionMs - recordingStartMs) / 1000 + buffer;

  // Don't trim very short videos
  if (trimEndSec - trimStartSec < 5) return;

  // Check if ffmpeg is available
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
  } catch {
    console.log(chalk.dim('Tip: Install ffmpeg to auto-trim dead time from videos.'));
    return;
  }

  // Trim the video
  const dir = path.dirname(videoPath);
  const ext = path.extname(videoPath);
  const base = path.basename(videoPath, ext);
  const rawPath = path.join(dir, `${base}-raw${ext}`);

  try {
    // Rename original to -raw
    fs.renameSync(videoPath, rawPath);

    execSync(
      `ffmpeg -i "${rawPath}" -ss ${trimStartSec.toFixed(2)} -to ${trimEndSec.toFixed(2)} -c copy "${videoPath}"`,
      { stdio: 'pipe', timeout: 60000 },
    );

    // Remove raw file on success
    fs.unlinkSync(rawPath);
    const trimmedDuration = Math.round(trimEndSec - trimStartSec);
    console.log(chalk.dim(`Trimmed video to ${trimmedDuration}s (removed dead time)`));
  } catch {
    // Restore original if trimming failed
    if (fs.existsSync(rawPath)) {
      if (!fs.existsSync(videoPath)) {
        fs.renameSync(rawPath, videoPath);
      } else {
        fs.unlinkSync(rawPath);
      }
    }
    console.log(chalk.dim('Video trimming failed, keeping original'));
  }
}
