import * as fs from 'fs';
import { execSync, spawn, type ChildProcess } from 'child_process';
import { Transform } from 'stream';
import { isPortOpen, waitForPort } from '../utils/port.js';

export interface ServerStartResult {
  alreadyRunning: boolean;
  port: number;
}

/**
 * Kill whatever process is listening on the given port.
 * Retries up to 3 times to ensure the port is actually freed.
 * Returns true if something was killed.
 */
async function killPort(port: number): Promise<boolean> {
  let killed = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const pids = execSync(`lsof -ti:${port}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      if (pids) {
        execSync(`kill -9 ${pids.split('\n').join(' ')}`, { stdio: 'pipe' });
        killed = true;
      }
    } catch {
      // No process found or kill failed
    }
    // Wait for the OS to release the port
    await new Promise((r) => setTimeout(r, 1000));
    if (!(await isPortOpen(port))) return killed;
  }
  return killed;
}

/**
 * Create a Transform stream that prepends an epoch-ms timestamp to each line.
 * Format: "1720612345678\toriginal line\n"
 */
function createTimestampTransform(): Transform {
  let buffer = '';
  return new Transform({
    transform(chunk, _encoding, callback) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop()!;
      for (const line of lines) {
        this.push(`${Date.now()}\t${line}\n`);
      }
      callback();
    },
    flush(callback) {
      if (buffer) this.push(`${Date.now()}\t${buffer}\n`);
      callback();
    },
  });
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
  // If port is occupied, kill the existing process — the user explicitly
  // asked proofshot to own the server via --run.
  if (await isPortOpen(port)) {
    const killed = await killPort(port);
    if (killed) {
      process.stderr.write(`Port ${port} was in use — killed existing process\n`);
    }
    // Final check — if still occupied, fail fast with a clear message
    if (await isPortOpen(port)) {
      throw new Error(
        `Port ${port} is still in use after attempting to kill the process.\n` +
          `Manually stop whatever is running on port ${port} and retry.`,
      );
    }
  }

  const proc = spawn('sh', ['-c', command], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  const tsOut = createTimestampTransform();
  const tsErr = createTimestampTransform();
  proc.stdout?.pipe(tsOut).pipe(logStream, { end: false });
  proc.stderr?.pipe(tsErr).pipe(logStream, { end: false });

  proc.unref();

  try {
    await waitForPort(port, startupTimeout);
  } catch (error) {
    // Clean up the spawned process if it failed to start on the expected port
    try {
      if (proc.pid) process.kill(-proc.pid, 'SIGKILL');
    } catch {
      // Already exited
    }
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
