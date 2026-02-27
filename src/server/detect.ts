import * as fs from 'fs';
import * as path from 'path';

export interface FrameworkInfo {
  name: string;
  command: string;
  port: number;
  waitForText: string | null;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

interface FrameworkDetector {
  name: string;
  detect: (pkg: PackageJson) => boolean;
  command: string;
  port: number;
  waitForText: string | null;
}

const FRAMEWORK_DETECTORS: FrameworkDetector[] = [
  {
    name: 'Next.js',
    detect: (pkg) =>
      !!(pkg.dependencies?.['next'] || pkg.devDependencies?.['next']),
    command: 'npm run dev',
    port: 3000,
    waitForText: 'ready on',
  },
  {
    name: 'Vite',
    detect: (pkg) => !!pkg.devDependencies?.['vite'],
    command: 'npm run dev',
    port: 5173,
    waitForText: 'Local:',
  },
  {
    name: 'Remix',
    detect: (pkg) => !!pkg.dependencies?.['@remix-run/node'],
    command: 'npm run dev',
    port: 3000,
    waitForText: 'started',
  },
  {
    name: 'Astro',
    detect: (pkg) =>
      !!(pkg.dependencies?.['astro'] || pkg.devDependencies?.['astro']),
    command: 'npm run dev',
    port: 4321,
    waitForText: 'watching for file changes',
  },
  {
    name: 'Create React App',
    detect: (pkg) => !!pkg.dependencies?.['react-scripts'],
    command: 'npm start',
    port: 3000,
    waitForText: 'Compiled',
  },
  {
    name: 'Nuxt',
    detect: (pkg) =>
      !!(pkg.dependencies?.['nuxt'] || pkg.devDependencies?.['nuxt']),
    command: 'npm run dev',
    port: 3000,
    waitForText: 'Listening on',
  },
  {
    name: 'SvelteKit',
    detect: (pkg) => !!pkg.devDependencies?.['@sveltejs/kit'],
    command: 'npm run dev',
    port: 5173,
    waitForText: 'Local:',
  },
  {
    name: 'Angular',
    detect: (pkg) => !!pkg.dependencies?.['@angular/core'],
    command: 'npm start',
    port: 4200,
    waitForText: 'Compiled successfully',
  },
  {
    name: 'Unknown (has dev script)',
    detect: (pkg) => !!pkg.scripts?.dev,
    command: 'npm run dev',
    port: 3000,
    waitForText: null,
  },
];

/**
 * Read and parse package.json from a directory.
 */
function readPackageJson(dir: string): PackageJson | null {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Detect the framework used in the given project directory.
 */
export function detectFramework(dir?: string): FrameworkInfo | null {
  const projectDir = dir || process.cwd();
  const pkg = readPackageJson(projectDir);
  if (!pkg) return null;

  for (const detector of FRAMEWORK_DETECTORS) {
    if (detector.detect(pkg)) {
      return {
        name: detector.name,
        command: detector.command,
        port: detector.port,
        waitForText: detector.waitForText,
      };
    }
  }

  return null;
}

/**
 * Check if a package.json exists in the directory.
 */
export function hasPackageJson(dir?: string): boolean {
  return fs.existsSync(path.join(dir || process.cwd(), 'package.json'));
}
