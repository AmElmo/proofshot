import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { diffCommand } from './commands/diff.js';
import { cleanCommand } from './commands/clean.js';
import { prCommand } from './commands/pr.js';
import { execCommand } from './commands/exec.js';

export function createCLI(): Command {
  const program = new Command();

  program
    .name('proofshot')
    .description('Visual verification for AI coding agents')
    .version('0.1.0');

  program
    .command('init')
    .description('Detect framework, create config, and install skill file')
    .option('--agent <agent>', 'Agent type: claude, codex, cursor, gemini, copilot, generic')
    .option('--force', 'Overwrite existing config')
    .action(async (options) => {
      await initCommand(options);
    });

  program
    .command('start')
    .description('Start a verification session: dev server, browser, recording, error capture')
    .option('--description <text>', 'What is being verified (included in the proof report)')
    .option('--port <port>', 'Override detected port', parseInt)
    .option('--no-server', 'Don\'t start dev server, assume it\'s running')
    .option('--headed', 'Show browser window for debugging')
    .option('--output <dir>', 'Custom output directory')
    .option('--url <url>', 'Open this URL instead of the root')
    .action(async (options) => {
      await startCommand(options);
    });

  program
    .command('stop')
    .description('Stop session: stop recording, collect errors, bundle proof artifacts')
    .option('--no-close', 'Don\'t close the browser (keep it open for further use)')
    .action(async (options) => {
      await stopCommand(options);
    });

  program
    .command('diff')
    .description('Compare current screenshots against a baseline')
    .requiredOption('--baseline <dir>', 'Directory with baseline screenshots')
    .action(async (options) => {
      await diffCommand(options);
    });

  program
    .command('clean')
    .description('Remove artifact files')
    .action(async () => {
      await cleanCommand();
    });

  program
    .command('pr')
    .description('Format artifacts as a GitHub PR description snippet')
    .action(async () => {
      await prCommand();
    });

  program
    .command('exec')
    .description('Run an agent-browser command with logging (use instead of agent-browser directly)')
    .argument('<args...>', 'agent-browser command and arguments')
    .allowUnknownOption()
    .action(async (args) => {
      await execCommand(args);
    });

  return program;
}
