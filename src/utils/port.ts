import * as net from 'net';

/**
 * Check if a port is currently open (something is listening on it).
 * Checks both IPv4 and IPv6 to handle servers that listen on either.
 */
export async function isPortOpen(port: number, host = 'localhost'): Promise<boolean> {
  // Try the specified host first
  if (await tryConnect(port, host)) return true;
  // If host is localhost, also explicitly try both address families
  if (host === 'localhost') {
    const results = await Promise.all([
      tryConnect(port, '127.0.0.1'),
      tryConnect(port, '::1'),
    ]);
    return results.some(Boolean);
  }
  return false;
}

function tryConnect(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Wait for a port to become open, polling every intervalMs.
 */
export async function waitForPort(
  port: number,
  timeoutMs = 30000,
  intervalMs = 500,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port)) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for port ${port} after ${timeoutMs}ms`);
}
