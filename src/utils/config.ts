import * as fs from 'fs';
import * as path from 'path';

export interface DevServerConfig {
  port: number;
  startupTimeout: number;
}

export interface ViewportConfig {
  width: number;
  height: number;
}

export interface BrowserConfig {
  configPath?: string;
  executablePath?: string;
  ignoreHttpsErrors: boolean;
}
export interface TimeoutConfig {
  browserOpenMs: number;
  recordingStartMs: number;
  recordingStopMs: number;
  screenshotMs: number;
  execPassthroughMs: number;
  videoTrimMs: number;
}

// Keep timeout defaults named and centralized so operational tuning does not
// rely on unexplained literals spread across the command flow.
export const DEFAULT_BROWSER_OPEN_TIMEOUT_MS = 60_000;
export const DEFAULT_RECORDING_START_TIMEOUT_MS = 10_000;
export const DEFAULT_RECORDING_STOP_TIMEOUT_MS = 15_000;
export const DEFAULT_SCREENSHOT_TIMEOUT_MS = 15_000;
export const DEFAULT_EXEC_PASSTHROUGH_TIMEOUT_MS = 60_000;
export const DEFAULT_VIDEO_TRIM_TIMEOUT_MS = 60_000;
export interface ProofShotConfig {
  devServer: DevServerConfig;
  output: string;
  defaultPages: string[];
  viewport: ViewportConfig;
  headless: boolean;
  browser: BrowserConfig;
  timeouts: TimeoutConfig;
}

const CONFIG_FILENAME = 'proofshot.config.json';

const DEFAULT_CONFIG: ProofShotConfig = {
  devServer: {
    port: 3000,
    startupTimeout: 30000,
  },
  output: './proofshot-artifacts',
  defaultPages: ['/'],
  viewport: { width: 1280, height: 720 },
  headless: true,
  browser: {
    ignoreHttpsErrors: false,
  },
  timeouts: {
    browserOpenMs: DEFAULT_BROWSER_OPEN_TIMEOUT_MS,
    recordingStartMs: DEFAULT_RECORDING_START_TIMEOUT_MS,
    recordingStopMs: DEFAULT_RECORDING_STOP_TIMEOUT_MS,
    screenshotMs: DEFAULT_SCREENSHOT_TIMEOUT_MS,
    execPassthroughMs: DEFAULT_EXEC_PASSTHROUGH_TIMEOUT_MS,
    videoTrimMs: DEFAULT_VIDEO_TRIM_TIMEOUT_MS,
  },
};

export function findConfigPath(startDir?: string): string | null {
  let dir = startDir || process.cwd();
  while (true) {
    const configPath = path.join(dir, CONFIG_FILENAME);
    if (fs.existsSync(configPath)) return configPath;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadConfig(startDir?: string): ProofShotConfig {
  const configPath = findConfigPath(startDir);
  if (!configPath) return { ...DEFAULT_CONFIG };

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const configDir = path.dirname(configPath);
    const resolvedBrowser = {
      ...DEFAULT_CONFIG.browser,
      ...parsed.browser,
    };
    if (resolvedBrowser.configPath) {
      resolvedBrowser.configPath = path.resolve(configDir, resolvedBrowser.configPath);
    }
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      devServer: { ...DEFAULT_CONFIG.devServer, ...parsed.devServer },
      viewport: { ...DEFAULT_CONFIG.viewport, ...parsed.viewport },
      browser: resolvedBrowser,
      timeouts: { ...DEFAULT_CONFIG.timeouts, ...parsed.timeouts },
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function writeConfig(
  config: ProofShotConfig,
  dir?: string,
): string {
  const configPath = path.join(dir || process.cwd(), CONFIG_FILENAME);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  return configPath;
}

export function configExists(dir?: string): boolean {
  return findConfigPath(dir) !== null;
}
