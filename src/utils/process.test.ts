import { describe, expect, it } from 'vitest';
import { getShellExecutable, parseWindowsNetstatOutput } from './process.js';

describe('getShellExecutable', () => {
  it('uses cmd.exe on Windows when ComSpec is missing', () => {
    expect(getShellExecutable('win32', {})).toBe('cmd.exe');
  });

  it('prefers ComSpec on Windows', () => {
    expect(getShellExecutable('win32', { ComSpec: 'C:\\Windows\\System32\\cmd.exe' })).toBe(
      'C:\\Windows\\System32\\cmd.exe',
    );
  });

  it('falls back to /bin/sh on Unix when SHELL is missing', () => {
    expect(getShellExecutable('linux', {})).toBe('/bin/sh');
  });
});

describe('parseWindowsNetstatOutput', () => {
  it('returns unique listening pids for the requested port', () => {
    const output = `
Proto  Local Address          Foreign Address        State           PID
TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
TCP    [::]:3000              [::]:0                 LISTENING       5678
TCP    127.0.0.1:3000         127.0.0.1:51722        ESTABLISHED     9999
TCP    0.0.0.0:4000           0.0.0.0:0              LISTENING       4321
TCP    [::]:3000              [::]:0                 LISTENING       5678
`;

    expect(parseWindowsNetstatOutput(output, 3000)).toEqual([1234, 5678]);
  });
});
