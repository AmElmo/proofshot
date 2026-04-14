import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildOpenBrowserCommand, getViewport, urlsMatch, verifyBrowserState } from './session.js';

const { abMock } = vi.hoisted(() => ({
  abMock: vi.fn(),
}));

vi.mock('../utils/exec.js', async () => {
  const actual = await vi.importActual<typeof import('../utils/exec.js')>('../utils/exec.js');
  return {
    ...actual,
    ab: abMock,
  };
});

describe('buildOpenBrowserCommand', () => {
  it('builds a default open command without extra flags', () => {
    expect(buildOpenBrowserCommand('http://localhost:3000')).toBe('open http://localhost:3000');
  });

  it('includes headed mode when headless is disabled', () => {
    expect(buildOpenBrowserCommand('http://localhost:3000', false)).toBe(
      'open http://localhost:3000 --headed',
    );
  });

  it('includes configurable browser flags from ProofShot config', () => {
    expect(
      buildOpenBrowserCommand('https://localhost:3000', true, {
        ignoreHttpsErrors: true,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      }),
    ).toBe(
      'open https://localhost:3000 --ignore-https-errors --executable-path "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"',
    );
  });
});

describe('urlsMatch', () => {
  it('treats trailing slashes as equivalent', () => {
    expect(urlsMatch('http://localhost:3000', 'http://localhost:3000/')).toBe(true);
  });

  it('keeps query strings significant', () => {
    expect(urlsMatch('http://localhost:3000/users?tab=open', 'http://localhost:3000/users?tab=closed')).toBe(
      false,
    );
  });
});

describe('getViewport', () => {
  beforeEach(() => {
    abMock.mockReset();
  });

  it('returns viewport dimensions from the page context', () => {
    abMock.mockReturnValueOnce(JSON.stringify({ width: 1280, height: 720 }));

    expect(getViewport()).toEqual({ width: 1280, height: 720 });
  });

  it('parses double-encoded viewport payloads from agent-browser eval', () => {
    abMock.mockReturnValueOnce(JSON.stringify(JSON.stringify({ width: 1920, height: 1080 })));

    expect(getViewport()).toEqual({ width: 1920, height: 1080 });
    expect(abMock).toHaveBeenCalledWith(
      "eval 'JSON.stringify({width: window.innerWidth, height: window.innerHeight})'",
      { session: undefined },
    );
  });
});

describe('verifyBrowserState', () => {
  beforeEach(() => {
    abMock.mockReset();
  });

  it('returns the observed state when URL and viewport match', () => {
    abMock
      .mockReturnValueOnce('http://localhost:3000/')
      .mockReturnValueOnce(JSON.stringify({ width: 1280, height: 720 }));

    expect(verifyBrowserState('http://localhost:3000', { width: 1280, height: 720 })).toEqual({
      url: 'http://localhost:3000/',
      viewport: { width: 1280, height: 720 },
    });
  });

  it('throws a targeted error when the browser is on the wrong page', () => {
    abMock
      .mockReturnValueOnce('http://localhost:3000/about')
      .mockReturnValueOnce(JSON.stringify({ width: 1280, height: 720 }));

    expect(() => verifyBrowserState('http://localhost:3000', { width: 1280, height: 720 })).toThrow(
      /attached to the wrong page or session/i,
    );
  });

  it('throws a targeted error when the viewport does not match', () => {
    abMock
      .mockReturnValueOnce('http://localhost:3000/')
      .mockReturnValueOnce(JSON.stringify({ width: 1600, height: 914 }));

    expect(() => verifyBrowserState('http://localhost:3000', { width: 1280, height: 720 })).toThrow(
      /viewport is 1600x914, expected 1280x720/i,
    );
  });
});
