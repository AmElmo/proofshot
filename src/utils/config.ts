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

export interface ProofShotConfig {
  devServer: DevServerConfig;
  output: string;
  defaultPages: string[];
  viewport: ViewportConfig;
  headless: boolean;
  browser: BrowserConfig;
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
};

/**
 * Find the config file by walking up from cwd.
 */
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

/**
 * Load config from disk, merging with defaults.
 */
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
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Write config to disk.
 */
export function writeConfig(
  config: ProofShotConfig,
  dir?: string,
): string {
  const configPath = path.join(dir || process.cwd(), CONFIG_FILENAME);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  return configPath;
}

/**
 * Check if a config file exists in the current project.
 */
export function configExists(dir?: string): boolean {
  return findConfigPath(dir) !== null;
}
