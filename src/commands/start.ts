import * as path from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { loadConfig } from '../utils/config.js';
import { setAgentBrowserDefaults } from '../utils/exec.js';
import { ensureDevServer } from '../server/start.js';
import { applyViewport, closeBrowser, openBrowser, verifyBrowserState, type BrowserState } from '../browser/session.js';
import { startRecording, stopRecording } from '../browser/capture.js';
import { ensureOutputDir, generateTimestamp, generateSessionDirName } from '../artifacts/bundle.js';
import {
  saveSession,
  hasActiveSession,
  clearSession,
  generateAgentBrowserSessionName,
} from '../session/state.js';
import { writeMetadata } from '../session/metadata.js';

interface StartOptions {
  description?: string;
  port?: number;
  run?: string;
  headed?: boolean;
  output?: string;
  url?: string;
  force?: boolean;
}

function formatBrowserState(state: BrowserState | null): string {
  if (!state) return 'unknown';

  const parts = [`url=${state.url || 'unknown'}`];
  if (state.viewport) {
    parts.push(`viewport=${state.viewport.width}x${state.viewport.height}`);
  } else {
    parts.push('viewport=unknown');
  }
  return parts.join(', ');
}

export async function startCommand(options: StartOptions): Promise<void> {
  const config = loadConfig();
  setAgentBrowserDefaults({ configPath: config.browser.configPath });
  if (options.port) config.devServer.port = options.port;
  if (options.output) config.output = options.output;
  if (options.headed !== undefined) config.headless = !options.headed;

  const outputDir = path.resolve(config.output);
  const timestamp = generateTimestamp();

  if (hasActiveSession(outputDir)) {
    if (options.force) {
      clearSession(outputDir);
      console.log(chalk.yellow('⚠') + chalk.dim(' Cleared stale session'));
    } else {
      console.log(
        chalk.yellow('⚠ A session is already active.') +
          chalk.dim(' Run "proofshot stop" first, or use --force to override.'),
      );
      return;
    }
  }

  ensureOutputDir(outputDir);

  const sessionDirName = generateSessionDirName(timestamp, options.description || null);
  const sessionDir = path.join(outputDir, sessionDirName);
  const sessionName = generateAgentBrowserSessionName(timestamp);
  ensureOutputDir(sessionDir);

  const videoPath = path.join(sessionDir, 'session.webm');
  const serverErrorLog = path.join(sessionDir, 'server.log');

  let branch = '';
  let commitSha = '';
  try {
    branch = execSync('git branch --show-current', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    // Non-fatal outside a git repo.
  }
  try {
    commitSha = execSync('git rev-parse HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    // Non-fatal outside a git repo.
  }

  writeMetadata(sessionDir, {
    branch,
    commitSha,
    startedAt: new Date().toISOString(),
    description: options.description || null,
  });

  let serverAlreadyRunning = true;

  if (options.run) {
    console.log(chalk.dim(`Starting: ${options.run}`));
    try {
      await ensureDevServer(
        options.run,
        config.devServer.port,
        config.devServer.startupTimeout,
        serverErrorLog,
      );
      serverAlreadyRunning = false;
      console.log(chalk.green('✓') + ` Dev server started on :${config.devServer.port}`);
      console.log(chalk.dim(`  Server logs → ${serverErrorLog}`));
    } catch (error: any) {
      console.error(chalk.red('✗') + ` Failed to start dev server: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log(chalk.dim('No --run provided, assuming server is already running'));
  }

  const baseUrl = `http://localhost:${config.devServer.port}`;
  const openUrl = options.url || baseUrl;

  console.log(chalk.dim('Opening browser...'));
  try {
    openBrowser(openUrl, config.viewport, config.headless, sessionName, config.browser);
    console.log(chalk.green('✓') + ' Browser ready');
  } catch (error: any) {
    closeBrowser();
    console.error(
      chalk.red('✗') +
        ` Failed to open browser: ${error.message}\n` +
        chalk.dim('Make sure agent-browser is installed: npm install -g agent-browser'),
    );
    process.exit(1);
  }

  const RECORDING_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;
  let recordingStarted = false;
  let lastError: any;
  let lastObservedState: BrowserState | null = null;

  for (let attempt = 1; attempt <= RECORDING_RETRIES; attempt++) {
    let recordingAttemptStarted = false;

    try {
      startRecording(videoPath, sessionName);
      recordingAttemptStarted = true;
      applyViewport(config.viewport, sessionName);
      lastObservedState = verifyBrowserState(openUrl, config.viewport, sessionName);
      recordingStarted = true;
      console.log(chalk.green('✓') + ' Recording started');
      break;
    } catch (error: any) {
      lastError = error;
      if (recordingAttemptStarted) {
        stopRecording(sessionName);
      }
      if (attempt < RECORDING_RETRIES) {
        console.log(
          chalk.yellow('⚠') +
            ` Recording failed (attempt ${attempt}/${RECORDING_RETRIES}), retrying in ${RETRY_DELAY_MS / 1000}s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  if (!recordingStarted) {
    closeBrowser();
    console.error(
      chalk.red('✗') +
        ` Failed to initialize recording after ${RECORDING_RETRIES} attempts: ${lastError?.message}\n` +
        chalk.dim('Recording is required — ProofShot cannot proceed without video capture.\n') +
        chalk.dim(`Observed browser state: ${formatBrowserState(lastObservedState)}\n`) +
        chalk.dim('Troubleshooting:\n') +
        chalk.dim('  1. Make sure agent-browser is installed and running\n') +
        chalk.dim('  2. Try "proofshot clean" then re-run "proofshot start"\n') +
        chalk.dim('  3. If the port was already in use, stop the old server first\n') +
        chalk.dim('  4. If URL or viewport do not match, the recording context may be attached to the wrong page'),
    );
    process.exit(1);
  }

  saveSession({
    startedAt: new Date().toISOString(),
    description: options.description || null,
    outputDir,
    sessionDir,
    sessionName,
    videoPath,
    serverErrorLog,
    port: config.devServer.port,
    serverCommand: options.run || null,
    serverAlreadyRunning,
    recordingActive: true,
    viewport: { width: config.viewport.width, height: config.viewport.height },
  });

  console.log('');
  console.log(chalk.green.bold('✅ ProofShot session started'));
  console.log('');
  console.log(`Server:     ${options.run ? chalk.cyan(options.run) : chalk.dim('external')} on :${config.devServer.port}`);
  console.log(`Browser:    Chromium (${config.headless ? 'headless' : 'headed'})`);
  console.log(`Session:    ${chalk.dim(sessionName)}`);
  console.log(`Recording:  ${chalk.dim(videoPath)}`);
  console.log(`Errors log: ${chalk.dim(serverErrorLog)}`);

  if (options.description) {
    console.log(`Verifying:  ${chalk.white(options.description)}`);
  }

  console.log('');
  console.log(chalk.dim('Use proofshot exec to navigate and test:'));
  console.log(chalk.dim('  proofshot exec snapshot -i            # See interactive elements'));
  console.log(chalk.dim('  proofshot exec click @e3              # Click an element'));
  console.log(chalk.dim('  proofshot exec fill @e2 "text"        # Fill a form field'));
  console.log(chalk.dim('  proofshot exec screenshot step.png    # Capture a moment'));
  console.log('');
  console.log(`When done, run: ${chalk.white('proofshot stop')}`);
}
