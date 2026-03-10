import { Command } from 'commander';
import { installCommand } from './commands/install.js';
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
    .command('install')
    .description('Install ProofShot skills at user level for all detected AI coding tools')
    .option('--only <tools>', 'Only install for these tools (comma-separated: claude,codex,cursor,gemini,windsurf)')
    .option('--skip <tools>', 'Skip these tools (comma-separated)')
    .option('--force', 'Overwrite existing skill files even if unchanged')
    .action(async (options) => {
      await installCommand(options);
    });

  program
    .command('start')
    .description('Start a verification session: browser, recording, error capture')
    .option('--description <text>', 'What is being verified (included in the proof report)')
    .option('--port <port>', 'Override detected port', parseInt)
    .option('--run <command>', 'Start this command and capture its logs')
    .option('--headed', 'Show browser window for debugging')
    .option('--output <dir>', 'Custom output directory')
    .option('--url <url>', 'Open this URL instead of the root')
    .option('--force', 'Override a stale session without running stop first')
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
    .description('Upload session artifacts and post a ProofShot comment on a GitHub PR')
    .argument('[pr-number]', 'PR number (auto-detects from current branch if omitted)')
    .option('--dry-run', 'Generate the comment markdown without posting')
    .action(async (prNumber, options) => {
      await prCommand({ prNumber, ...options });
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
