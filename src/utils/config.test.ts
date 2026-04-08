import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('merges nested browser config with defaults', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proofshot-config-test-'));
    fs.writeFileSync(
      path.join(tempDir, 'proofshot.config.json'),
      JSON.stringify({
        browser: {
          executablePath: '/tmp/chrome',
        },
      }),
    );

    expect(loadConfig(tempDir).browser).toEqual({
      configPath: undefined,
      executablePath: '/tmp/chrome',
      ignoreHttpsErrors: false,
    });
  });

  it('resolves browser config paths relative to proofshot.config.json', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proofshot-browser-config-path-'));
    fs.writeFileSync(
      path.join(tempDir, 'proofshot.config.json'),
      JSON.stringify({
        browser: {
          configPath: './agent-browser.local.json',
        },
      }),
    );

    expect(loadConfig(tempDir).browser).toEqual({
      configPath: path.join(tempDir, 'agent-browser.local.json'),
      executablePath: undefined,
      ignoreHttpsErrors: false,
    });
  });

  it('merges nested timeout config with defaults', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proofshot-timeout-config-'));
    fs.writeFileSync(
      path.join(tempDir, 'proofshot.config.json'),
      JSON.stringify({
        timeouts: {
          browserOpenMs: 120000,
          execPassthroughMs: 90000,
        },
      }),
    );

    expect(loadConfig(tempDir).timeouts).toEqual({
      browserOpenMs: 120000,
      recordingStartMs: 10000,
      recordingStopMs: 15000,
      screenshotMs: 15000,
      execPassthroughMs: 90000,
      videoTrimMs: 60000,
    });
  });
});
