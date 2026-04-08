import { afterEach, describe, expect, it } from 'vitest';
import { buildAgentBrowserCommand, setAgentBrowserDefaults } from './exec.js';

describe('buildAgentBrowserCommand', () => {
  afterEach(() => {
    setAgentBrowserDefaults({});
  });

  it('builds a plain agent-browser command when no options are provided', () => {
    expect(buildAgentBrowserCommand('open http://localhost:3000')).toBe(
      'agent-browser open http://localhost:3000',
    );
  });

  it('prepends the configured session flag before the command', () => {
    expect(buildAgentBrowserCommand('snapshot -i', { session: 'proofshot-2026-04-07_22-30-00' })).toBe(
      "agent-browser --session 'proofshot-2026-04-07_22-30-00' snapshot -i",
    );
  });

  it('shell-quotes session names safely', () => {
    expect(buildAgentBrowserCommand('console', { session: "proofshot-o'connor" })).toBe(
      "agent-browser --session 'proofshot-o'\\''connor' console",
    );
  });

  it('prepends the configured agent-browser config path before the command', () => {
    expect(buildAgentBrowserCommand('open http://localhost:3000', { configPath: '/tmp/agent-browser.json' })).toBe(
      "agent-browser --config '/tmp/agent-browser.json' open http://localhost:3000",
    );
  });

  it('applies default config path options to later commands', () => {
    setAgentBrowserDefaults({ configPath: '/tmp/project-agent-browser.json' });

    expect(buildAgentBrowserCommand('snapshot -i')).toBe(
      "agent-browser --config '/tmp/project-agent-browser.json' snapshot -i",
    );
  });
});
