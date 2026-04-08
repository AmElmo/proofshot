import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startCommand } from './start.js';

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  ensureDevServer: vi.fn(),
  openBrowser: vi.fn(),
  applyViewport: vi.fn(),
  closeBrowser: vi.fn(),
  verifyBrowserState: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  ensureOutputDir: vi.fn(),
  generateTimestamp: vi.fn(),
  generateSessionDirName: vi.fn(),
  saveSession: vi.fn(),
  hasActiveSession: vi.fn(),
  clearSession: vi.fn(),
  generateAgentBrowserSessionName: vi.fn(),
  writeMetadata: vi.fn(),
  execSync: vi.fn(),
}));

vi.mock('../utils/config.js', () => ({
  loadConfig: mocks.loadConfig,
}));

vi.mock('../server/start.js', () => ({
  ensureDevServer: mocks.ensureDevServer,
}));

vi.mock('../browser/session.js', () => ({
  openBrowser: mocks.openBrowser,
  applyViewport: mocks.applyViewport,
  closeBrowser: mocks.closeBrowser,
  verifyBrowserState: mocks.verifyBrowserState,
}));

vi.mock('../browser/capture.js', () => ({
  startRecording: mocks.startRecording,
  stopRecording: mocks.stopRecording,
}));

vi.mock('../artifacts/bundle.js', () => ({
  ensureOutputDir: mocks.ensureOutputDir,
  generateTimestamp: mocks.generateTimestamp,
  generateSessionDirName: mocks.generateSessionDirName,
}));

vi.mock('../session/state.js', () => ({
  saveSession: mocks.saveSession,
  hasActiveSession: mocks.hasActiveSession,
  clearSession: mocks.clearSession,
  generateAgentBrowserSessionName: mocks.generateAgentBrowserSessionName,
}));

vi.mock('../session/metadata.js', () => ({
  writeMetadata: mocks.writeMetadata,
}));

vi.mock('child_process', () => ({
  execSync: mocks.execSync,
}));

describe('startCommand', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);

    mocks.loadConfig.mockReturnValue({
      output: './proofshot-artifacts',
      headless: true,
      viewport: { width: 1280, height: 720 },
      browser: {},
      devServer: {
        port: 3000,
        startupTimeout: 1000,
      },
    });
    mocks.hasActiveSession.mockReturnValue(false);
    mocks.generateTimestamp.mockReturnValue('2026-04-08_07-28-00');
    mocks.generateSessionDirName.mockReturnValue('2026-04-08_07-28-00_test');
    mocks.generateAgentBrowserSessionName.mockReturnValue('proofshot-2026-04-08_07-28-00');
    mocks.execSync.mockImplementation((command: string) => {
      if (command === 'git branch --show-current') return 'main';
      if (command === 'git rev-parse HEAD') return 'deadbeef';
      throw new Error(`unexpected command: ${command}`);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it('stops the active recording session and closes the browser when verification keeps failing', async () => {
    mocks.verifyBrowserState.mockImplementation(() => {
      throw new Error('Browser viewport is 800x535, expected 1280x720.');
    });

    const commandPromise = startCommand({}).catch((error) => error);
    await vi.runAllTimersAsync();

    await expect(commandPromise).resolves.toMatchObject({ message: 'process.exit:1' });
    expect(mocks.startRecording).toHaveBeenCalledTimes(3);
    expect(mocks.stopRecording).toHaveBeenCalledTimes(3);
    expect(mocks.closeBrowser).toHaveBeenCalledTimes(1);
    expect(mocks.saveSession).not.toHaveBeenCalled();
  });

  it('reapplies the configured viewport after recording starts before verification', async () => {
    mocks.verifyBrowserState.mockReturnValue({
      url: 'http://localhost:3000/',
      viewport: { width: 1280, height: 720 },
    });

    await startCommand({});

    expect(mocks.startRecording).toHaveBeenCalledWith(
      expect.stringContaining('session.webm'),
      'proofshot-2026-04-08_07-28-00',
    );
    expect(mocks.applyViewport).toHaveBeenCalledWith(
      { width: 1280, height: 720 },
      'proofshot-2026-04-08_07-28-00',
    );
    expect(mocks.verifyBrowserState).toHaveBeenCalledWith(
      'http://localhost:3000',
      { width: 1280, height: 720 },
      'proofshot-2026-04-08_07-28-00',
    );
    expect(mocks.applyViewport.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.startRecording.mock.invocationCallOrder[0],
    );
    expect(mocks.verifyBrowserState.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.applyViewport.mock.invocationCallOrder[0],
    );
  });

  it('does not try to stop recording when recording never started', async () => {
    mocks.startRecording.mockImplementation(() => {
      throw new Error('Recording already active');
    });

    const commandPromise = startCommand({}).catch((error) => error);
    await vi.runAllTimersAsync();

    await expect(commandPromise).resolves.toMatchObject({ message: 'process.exit:1' });
    expect(mocks.startRecording).toHaveBeenCalledTimes(3);
    expect(mocks.stopRecording).not.toHaveBeenCalled();
    expect(mocks.closeBrowser).toHaveBeenCalledTimes(1);
  });

  it('closes the browser when browser open fails', async () => {
    mocks.openBrowser.mockImplementation(() => {
      throw new Error('Chrome exited early without writing DevToolsActivePort');
    });

    const commandPromise = startCommand({}).catch((error) => error);

    await expect(commandPromise).resolves.toMatchObject({ message: 'process.exit:1' });
    expect(mocks.closeBrowser).toHaveBeenCalledTimes(1);
    expect(mocks.startRecording).not.toHaveBeenCalled();
    expect(mocks.saveSession).not.toHaveBeenCalled();
  });
});
