import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findConfigPathMock, loadConfigMock, loadSessionMock, findExecutablePathMock, readCommandVersionMock } =
  vi.hoisted(() => ({
    findConfigPathMock: vi.fn(),
    loadConfigMock: vi.fn(),
    loadSessionMock: vi.fn(),
    findExecutablePathMock: vi.fn(),
    readCommandVersionMock: vi.fn(),
  }));

vi.mock('../utils/config.js', () => ({
  findConfigPath: findConfigPathMock,
  loadConfig: loadConfigMock,
}));

vi.mock('../session/state.js', () => ({
  loadSession: loadSessionMock,
}));

vi.mock('../utils/process.js', () => ({
  findExecutablePath: findExecutablePathMock,
  readCommandVersion: readCommandVersionMock,
}));

import { doctorCommand } from './doctor.js';

describe('doctorCommand', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    findConfigPathMock.mockReturnValue('/tmp/proofshot.config.json');
    loadConfigMock.mockReturnValue({
      output: './proofshot-artifacts',
      headless: true,
      viewport: { width: 1280, height: 720 },
      devServer: { port: 3000, startupTimeout: 30000 },
      defaultPages: ['/'],
    });
    loadSessionMock.mockReturnValue(null);
    findExecutablePathMock.mockImplementation((name: string) =>
      name === 'agent-browser' ? '/usr/local/bin/agent-browser' : '/opt/homebrew/bin/ffmpeg',
    );
    readCommandVersionMock.mockImplementation((name: string) =>
      name === 'agent-browser' ? 'agent-browser 0.25.3' : 'ffmpeg version 7.0',
    );
  });

  it('prints a diagnostic summary for the current environment', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await doctorCommand();

    const output = logSpy.mock.calls.map(([line]) => String(line)).join('\n');
    expect(output).toContain('ProofShot Doctor');
    expect(output).toContain('agent-browser');
    expect(output).toContain('ffmpeg');
    expect(output).toContain('1280x720');
    expect(output).toContain('proofshot-artifacts');
  });
});
