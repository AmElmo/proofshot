import { describe, expect, it } from 'vitest';
import { buildShellCommand } from './exec.js';

describe('buildShellCommand', () => {
  it('routes regular commands through the active ProofShot session', () => {
    expect(buildShellCommand(['click', '@e2'], 'proofshot-2026-04-07_22-30-00')).toBe(
      "agent-browser --session 'proofshot-2026-04-07_22-30-00' click @e2",
    );
  });

  it('preserves eval shell quoting while adding the session flag', () => {
    expect(buildShellCommand(['eval', "console.log('hello')"], 'proofshot-dev')).toBe(
      "agent-browser --session 'proofshot-dev' eval 'console.log('\\''hello'\\'')'",
    );
  });

  it('quotes regular arguments that contain shell metacharacters', () => {
    expect(buildShellCommand(['screenshot', 'step (1).png'], 'proofshot-dev')).toBe(
      "agent-browser --session 'proofshot-dev' screenshot 'step (1).png'",
    );
  });
});
