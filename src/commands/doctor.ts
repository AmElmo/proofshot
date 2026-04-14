import chalk from 'chalk';
import { PROOFSHOT_VERSION } from '../version.js';
import { findConfigPath, loadConfig } from '../utils/config.js';
import { findExecutablePath, readCommandVersion } from '../utils/process.js';
import { loadSession } from '../session/state.js';

function statusLabel(ok: boolean, text: string): string {
  return ok ? `${chalk.green('✓')} ${text}` : `${chalk.yellow('⚠')} ${text}`;
}

function printLine(label: string, value: string): void {
  console.log(`${label.padEnd(14)} ${value}`);
}

export async function doctorCommand(): Promise<void> {
  const configPath = findConfigPath();
  const config = loadConfig();
  const outputDir = config.output;
  const session = loadSession(outputDir);

  const agentBrowserPath = findExecutablePath('agent-browser');
  const ffmpegPath = findExecutablePath('ffmpeg');
  const agentBrowserVersion = readCommandVersion('agent-browser');
  const ffmpegVersion = readCommandVersion('ffmpeg');

  console.log(chalk.bold('ProofShot Doctor'));
  console.log('');

  printLine('ProofShot', PROOFSHOT_VERSION);
  printLine('Config', configPath || chalk.dim('not found'));
  printLine('Output', outputDir);
  printLine('Browser mode', config.headless ? 'headless' : 'headed');
  printLine('Viewport', `${config.viewport.width}x${config.viewport.height}`);
  console.log('');

  console.log(statusLabel(Boolean(agentBrowserPath), 'agent-browser'));
  printLine('Path', agentBrowserPath || chalk.dim('not found'));
  printLine('Version', agentBrowserVersion || chalk.dim('not available'));
  console.log('');

  console.log(statusLabel(Boolean(ffmpegPath), 'ffmpeg'));
  printLine('Path', ffmpegPath || chalk.dim('not found'));
  printLine('Version', ffmpegVersion || chalk.dim('not available'));
  console.log('');

  console.log(statusLabel(Boolean(session), 'active session'));
  if (session) {
    printLine('Session dir', session.sessionDir);
    printLine('Recording', session.recordingActive ? 'active' : 'stopped');
    printLine('Port', String(session.port));
  } else {
    printLine('Session dir', chalk.dim('none'));
  }
}
