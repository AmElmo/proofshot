import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { loadConfig } from '../utils/config.js';
import {
  getGitHubToken,
  getRepoInfo,
  getPRNumber,
  uploadAssets,
  postPRComment,
} from '../utils/github.js';
import { findSessionsForBranch, loadMetadata } from '../session/metadata.js';
import { formatPRComment, type PRCommentData } from '../artifacts/pr-format.js';

interface PROptions {
  prNumber?: string;
  dryRun?: boolean;
}

export async function prCommand(options: PROptions): Promise<void> {
  const config = loadConfig();
  const outputDir = path.resolve(config.output);

  // 1. Determine current branch
  let branch: string;
  try {
    branch = execSync('git branch --show-current', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    console.error(chalk.red('✗') + ' Not in a git repository.');
    process.exit(1);
  }

  if (!branch) {
    console.error(chalk.red('✗') + ' Detached HEAD — cannot determine branch.');
    process.exit(1);
  }

  console.log(chalk.dim(`Branch: ${branch}`));

  // 2. Find session folders for this branch
  const sessionDirs = findSessionsForBranch(outputDir, branch);

  if (sessionDirs.length === 0) {
    console.error(
      chalk.red('✗') +
        ` No ProofShot sessions found for branch "${branch}".\n` +
        chalk.dim('Run "proofshot start" and "proofshot stop" first.'),
    );
    process.exit(1);
  }

  console.log(chalk.dim(`Found ${sessionDirs.length} session(s) for this branch`));

  // 3. Gather artifacts from all sessions (sorted newest first)
  const screenshotPaths: string[] = [];
  let videoPath: string | null = null;
  let errorCount = 0;
  let latestCommitSha = '';
  let description: string | null = null;

  for (const sessionDir of sessionDirs) {
    const metadata = loadMetadata(sessionDir);
    if (metadata) {
      if (!description && metadata.description) description = metadata.description;
      if (metadata.commitSha) latestCommitSha = metadata.commitSha;
    }

    const files = fs.readdirSync(sessionDir);

    // Collect screenshots
    for (const f of files) {
      if (f.endsWith('.png')) {
        screenshotPaths.push(path.join(sessionDir, f));
      }
    }

    // Use the most recent video (sessions are newest-first, so only take the first)
    if (!videoPath) {
      for (const f of files) {
        if (f === 'session.webm' || f === 'session.mp4') {
          videoPath = path.join(sessionDir, f);
          break;
        }
      }
    }

    // Count errors from SUMMARY.md
    const summaryPath = path.join(sessionDir, 'SUMMARY.md');
    if (fs.existsSync(summaryPath)) {
      const summary = fs.readFileSync(summaryPath, 'utf-8');
      const errorMatch = summary.match(/(\d+)\s+error/gi);
      if (errorMatch) {
        for (const m of errorMatch) {
          const num = parseInt(m, 10);
          if (!isNaN(num)) errorCount += num;
        }
      }
    }
  }

  // 4. Convert .webm → .mp4 if ffmpeg is available
  if (videoPath && videoPath.endsWith('.webm')) {
    const mp4Path = videoPath.replace(/\.webm$/, '.mp4');
    if (fs.existsSync(mp4Path)) {
      videoPath = mp4Path;
    } else {
      try {
        execSync('ffmpeg -version', { stdio: 'pipe' });
        console.log(chalk.dim('Converting video to .mp4...'));
        execSync(
          `ffmpeg -i "${videoPath}" -c:v libx264 -preset fast -crf 23 -an "${mp4Path}"`,
          { stdio: 'pipe', timeout: 120000 },
        );
        videoPath = mp4Path;
        console.log(chalk.green('✓') + ' Video converted to .mp4');
      } catch {
        console.log(chalk.dim('ffmpeg not available — uploading .webm directly'));
      }
    }
  }

  // 5. For --dry-run, generate markdown with placeholder URLs (no GitHub dependency)
  if (options.dryRun) {
    const screenshotMap = new Map<string, string>();
    for (const ssPath of screenshotPaths) {
      const label = screenshotLabel(ssPath);
      screenshotMap.set(label, `https://github.com/user-attachments/assets/<${label}>`);
    }

    const commentData: PRCommentData = {
      description,
      sessionCount: sessionDirs.length,
      screenshots: screenshotMap,
      videoUrl: videoPath
        ? `https://github.com/user-attachments/assets/<${path.basename(videoPath)}>`
        : null,
      errorCount,
      branch,
      commitSha: latestCommitSha,
    };

    console.log('');
    console.log(chalk.yellow('--- Dry run (not posted) ---'));
    console.log(formatPRComment(commentData));
    return;
  }

  // 6. Resolve PR number (requires gh CLI)
  const prNumber = getPRNumber(options.prNumber);
  console.log(chalk.dim(`Target PR: #${prNumber}`));

  // 7. Authenticate and get repo info
  const token = getGitHubToken();
  const repoInfo = getRepoInfo();

  // 8. Upload artifacts
  const filesToUpload = [...screenshotPaths];
  if (videoPath) filesToUpload.push(videoPath);

  console.log(chalk.dim(`Uploading ${filesToUpload.length} artifact(s)...`));

  const uploaded = await uploadAssets(filesToUpload, token, repoInfo.id, (current, total, fileName) => {
    console.log(chalk.dim(`  [${current}/${total}] ${fileName}`));
  });

  // Build screenshot URL map using full path as upload key
  const screenshotMap = new Map<string, string>();
  let failedUploads = 0;
  for (const ssPath of screenshotPaths) {
    const asset = uploaded.get(ssPath);
    if (asset) {
      screenshotMap.set(screenshotLabel(ssPath), asset.url);
    } else {
      failedUploads++;
    }
  }

  // Get video URL
  let videoUrl: string | null = null;
  if (videoPath) {
    const videoAsset = uploaded.get(videoPath);
    if (videoAsset) videoUrl = videoAsset.url;
    else failedUploads++;
  }

  if (failedUploads > 0) {
    console.log(chalk.yellow(`⚠ ${failedUploads} artifact(s) failed to upload`));
  }

  // 9. Generate and post PR comment
  const commentData: PRCommentData = {
    description,
    sessionCount: sessionDirs.length,
    screenshots: screenshotMap,
    videoUrl,
    errorCount,
    branch,
    commitSha: latestCommitSha,
  };

  const commentBody = formatPRComment(commentData);

  console.log(chalk.dim('Posting PR comment...'));
  postPRComment(prNumber, commentBody);

  console.log('');
  console.log(chalk.green.bold(`✅ Posted ProofShot verification to PR #${prNumber}`));
  console.log(
    chalk.dim(`  ${screenshotMap.size} screenshot(s), ${videoUrl ? '1 video' : 'no video'}`),
  );
}

/**
 * Create a unique label for a screenshot using session folder + filename.
 * Avoids collisions when multiple sessions have identically-named files.
 */
function screenshotLabel(ssPath: string): string {
  const sessionDir = path.basename(path.dirname(ssPath));
  const fileName = path.basename(ssPath);
  return `${sessionDir}/${fileName}`;
}
