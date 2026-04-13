import { describe, expect, it } from 'vitest';
import { generateAgentBrowserSessionName } from './state.js';

describe('generateAgentBrowserSessionName', () => {
  it('prefixes ProofShot session names consistently', () => {
    expect(generateAgentBrowserSessionName('2026-04-07_22-30-00')).toBe(
      'proofshot-2026-04-07_22-30-00',
    );
  });

  it('normalizes unsafe characters', () => {
    expect(generateAgentBrowserSessionName("April 7 review / O'Connor")).toBe(
      'proofshot-april-7-review-o-connor',
    );
  });
});
