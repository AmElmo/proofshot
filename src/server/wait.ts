import type { ChildProcess } from 'child_process';

/**
 * Wait for a specific text pattern in a process's stdout/stderr.
 */
export function waitForText(
  proc: ChildProcess,
  text: string,
  timeoutMs = 30000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for "${text}" after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (data: Buffer) => {
      const output = data.toString();
      if (output.includes(text)) {
        clearTimeout(timer);
        resolve();
      }
    };

    proc.stdout?.on('data', handler);
    proc.stderr?.on('data', handler);

    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Process exited with code ${code} while waiting for "${text}"`));
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Simple sleep utility.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
