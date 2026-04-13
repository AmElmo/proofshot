import { describe, expect, it } from 'vitest';
import { buildAgentBrowserCommand } from './exec.js';

describe('buildAgentBrowserCommand', () => {
  it('builds a plain agent-browser command when no session is provided', () => {
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
});
