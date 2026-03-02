import * as fs from 'fs';
import { spawn } from 'child_process';
import { isPortOpen, waitForPort } from '../utils/port.js';

export interface ServerStartResult {
  alreadyRunning: boolean;
  port: number;
}

/**
 * Start a dev server command and wait for it to be ready.
 * Only called when the agent provides a --run command.
 * Pipes stdout/stderr to logPath for server error capture.
 */
export async function ensureDevServer(
  command: string,
  port: number,
  startupTimeout: number,
  logPath: string,
): Promise<ServerStartResult> {
  // Fail fast if something is already listening on the port
  if (await isPortOpen(port)) {
    throw new Error(
      `Port ${port} is already in use. Either stop the existing server ` +
        `or omit --run to use the running server.`,
    );
  }

  const proc = spawn('sh', ['-c', command], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  proc.stdout?.pipe(logStream);
  proc.stderr?.pipe(logStream);

  proc.unref();

  try {
    await waitForPort(port, startupTimeout);
  } catch (error) {
    throw new Error(
      `Failed to start dev server with "${command}" on port ${port}.\n` +
        `Make sure the command is correct and the port is available.\n` +
        `Original error: ${error instanceof Error ? error.message : error}`,
    );
  }

  // Small delay for stability
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return { alreadyRunning: false, port };
}
