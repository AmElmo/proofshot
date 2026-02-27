import * as fs from 'fs';
import { spawn } from 'child_process';
import type { DevServerConfig } from '../utils/config.js';
import { isPortOpen, waitForPort } from '../utils/port.js';
import { waitForText, sleep } from './wait.js';

export interface ServerStartResult {
  alreadyRunning: boolean;
  port: number;
}

/**
 * Ensure the dev server is running.
 * - If already running on the configured port, returns immediately.
 * - Otherwise, starts it as a detached background process.
 * - Pipes stdout/stderr to errorLogPath for server error capture.
 * - Does NOT kill the server on exit — the agent may want to keep using it.
 */
export async function ensureDevServer(
  config: DevServerConfig,
  errorLogPath?: string,
): Promise<ServerStartResult> {
  // Check if server is already running
  if (await isPortOpen(config.port)) {
    return { alreadyRunning: true, port: config.port };
  }

  // Start the dev server as a background process
  const proc = spawn('sh', ['-c', config.command], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  // Pipe server output to error log for capture
  if (errorLogPath) {
    const logStream = fs.createWriteStream(errorLogPath, { flags: 'a' });
    proc.stdout?.pipe(logStream);
    proc.stderr?.pipe(logStream);
  }

  proc.unref();

  // Wait for server to be ready using either text detection or port polling
  const waiters: Promise<void>[] = [];

  if (config.waitForText) {
    waiters.push(waitForText(proc, config.waitForText, config.startupTimeout));
  }

  waiters.push(waitForPort(config.port, config.startupTimeout));

  try {
    await Promise.race(waiters);
  } catch (error) {
    throw new Error(
      `Failed to start dev server with "${config.command}" on port ${config.port}.\n` +
        `Make sure the command is correct and the port is available.\n` +
        `Original error: ${error instanceof Error ? error.message : error}`,
    );
  }

  // Small delay for stability
  await sleep(1000);

  return { alreadyRunning: false, port: config.port };
}
