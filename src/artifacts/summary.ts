import * as fs from 'fs';
import * as path from 'path';
import {
  type VerificationResult,
  countInteractiveElements,
  countErrors,
  countWarnings,
} from './bundle.js';

/**
 * Generate a SUMMARY.md file from verification results.
 */
export function generateSummary(result: VerificationResult): string {
  const date = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const projectName = path.basename(process.cwd());
  const durationSec = Math.round(result.durationMs / 1000);

  let totalErrors = 0;
  let totalWarnings = 0;

  let md = `# ProofShot Visual Verification Report

**Date:** ${date}
**Project:** ${projectName}
**Framework:** ${result.framework}
**Dev Server:** localhost:${result.port}

## Pages Verified

`;

  for (const page of result.pageResults) {
    const errors = countErrors(page.errors);
    const warnings = countWarnings(page.consoleOutput);
    const elements = countInteractiveElements(page.snapshot);
    totalErrors += errors;
    totalWarnings += warnings;

    const relativeSS = path.basename(page.screenshotPath);
    const status = errors > 0 ? 'Loaded with errors' : 'Loaded successfully';
    const statusIcon = errors > 0 ? '⚠️' : '✅';

    md += `### ${page.page} (${page.title || 'Untitled'})
- Status: ${statusIcon} ${status}
- Screenshot: ![${page.page}](./${relativeSS})
- Interactive elements: ${elements.buttons} buttons, ${elements.links} links, ${elements.inputs} inputs, ${elements.forms} forms
- Console errors: ${errors}`;

    if (warnings > 0) {
      md += `\n- Console warnings: ${warnings}`;
    }

    md += '\n\n';
  }

  if (result.videoPath) {
    const relativeVideo = path.basename(result.videoPath);
    md += `## Video Recording
Full session recording: [${relativeVideo}](./${relativeVideo})

`;
  }

  md += `## Environment
- Browser: Chromium (headless)
- Viewport: 1280x720
- Duration: ${durationSec} seconds
- Total errors: ${totalErrors}
- Total warnings: ${totalWarnings}
`;

  return md;
}

/**
 * Write the summary to disk and return the file path.
 */
export function writeSummary(
  result: VerificationResult,
  outputDir: string,
): string {
  const md = generateSummary(result);
  const summaryPath = path.join(outputDir, 'SUMMARY.md');
  fs.writeFileSync(summaryPath, md);
  return summaryPath;
}
