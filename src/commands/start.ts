import * as path from 'path';
import chalk from 'chalk';
import { loadConfig } from '../utils/config.js';
import { ensureDevServer } from '../server/start.js';
import { detectFramework } from '../server/detect.js';
import { openBrowser } from '../browser/session.js';
import { startRecording } from '../browser/capture.js';
import { ensureOutputDir, generateTimestamp, generateSessionDirName } from '../artifacts/bundle.js';
import { saveSession, hasActiveSession } from '../session/state.js';

interface StartOptions {
  description?: string;
  port?: number;
  noServer?: boolean;
  headed?: boolean;
  output?: string;
  url?: string;
}

export async function startCommand(options: StartOptions): Promise<void> {
  const config = loadConfig();

  // Override config with CLI options
  if (options.port) config.devServer.port = options.port;
  if (options.output) config.output = options.output;
  if (options.headed !== undefined) config.headless = !options.headed;

  const outputDir = path.resolve(config.output);
  const timestamp = generateTimestamp();

  // Check for existing session
  if (hasActiveSession(outputDir)) {
    console.log(
      chalk.yellow('⚠ A session is already active.') +
        chalk.dim(' Run "proofshot stop" first, or "proofshot clean" to reset.'),
    );
    return;
  }

  // Ensure root output directory
  ensureOutputDir(outputDir);

  // Create per-session subfolder
  const sessionDirName = generateSessionDirName(timestamp, options.description || null);
  const sessionDir = path.join(outputDir, sessionDirName);
  ensureOutputDir(sessionDir);

  // Paths for artifacts (all inside session subfolder)
  const videoPath = path.join(sessionDir, `session.webm`);
  const serverErrorLog = path.join(sessionDir, 'server.log');

  // Step 1: Start dev server with error capture
  let serverResult;
  if (!options.noServer) {
    console.log(chalk.dim('Starting dev server...'));
    try {
      serverResult = await ensureDevServer(config.devServer, serverErrorLog);
      if (serverResult.alreadyRunning) {
        console.log(chalk.green('✓') + ` Dev server already running on :${config.devServer.port}`);
      } else {
        console.log(chalk.green('✓') + ` Dev server started on :${config.devServer.port}`);
        console.log(chalk.dim(`  Server logs → ${serverErrorLog}`));
      }
    } catch (error: any) {
      console.error(chalk.red('✗') + ` Failed to start dev server: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log(chalk.dim('Skipping dev server (--no-server)'));
    serverResult = { alreadyRunning: true, port: config.devServer.port };
  }

  const baseUrl = `http://localhost:${config.devServer.port}`;
  const openUrl = options.url || baseUrl;

  // Step 2: Open browser
  console.log(chalk.dim('Opening browser...'));
  try {
    openBrowser(openUrl, config.viewport, config.headless);
    console.log(chalk.green('✓') + ' Browser ready');
  } catch (error: any) {
    console.error(
      chalk.red('✗') +
        ` Failed to open browser: ${error.message}\n` +
        chalk.dim('Make sure agent-browser is installed: npm install -g agent-browser'),
    );
    process.exit(1);
  }

  // Step 3: Start recording
  try {
    startRecording(videoPath);
    console.log(chalk.green('✓') + ' Recording started');
  } catch {
    console.log(chalk.yellow('⚠') + ' Could not start recording, continuing without video');
  }

  // Step 4: Save session state (including viewport for overlay coordinate scaling)
  const framework = detectFramework();
  saveSession({
    startedAt: new Date().toISOString(),
    description: options.description || null,
    outputDir,
    sessionDir,
    videoPath,
    serverErrorLog,
    port: config.devServer.port,
    framework: framework?.name || 'Unknown',
    serverAlreadyRunning: serverResult?.alreadyRunning ?? true,
    viewport: { width: config.viewport.width, height: config.viewport.height },
  });

  // Step 5: Print instructions for the agent
  console.log('');
  console.log(chalk.green.bold('✅ ProofShot session started'));
  console.log('');
  console.log(`Dev server: ${chalk.cyan(framework?.name || 'Unknown')} on :${config.devServer.port}`);
  console.log(`Browser:    Chromium (${config.headless ? 'headless' : 'headed'})`);
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
