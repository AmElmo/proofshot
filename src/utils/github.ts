import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ProofShotError } from './exec.js';

// ─── Types ───

export interface GitHubRepo {
  owner: string;
  repo: string;
  id: number;
}

export interface UploadedAsset {
  url: string;
  name: string;
}

// ─── Authentication ───

/**
 * Get GitHub auth token via gh CLI.
 */
export function getGitHubToken(): string {
  try {
    return execSync('gh auth token', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    throw new ProofShotError(
      'GitHub CLI (gh) is not installed or not authenticated.\n' +
        'Install: https://cli.github.com\n' +
        'Then run: gh auth login',
      error,
    );
  }
}

// ─── Repository Info ───

/**
 * Get the current repo's owner, name, and numeric ID.
 */
export function getRepoInfo(): GitHubRepo {
  let nwo: string;
  try {
    nwo = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    throw new ProofShotError(
      'Could not determine GitHub repository. Are you in a git repo with a GitHub remote?',
      error,
    );
  }

  const [owner, repo] = nwo.split('/');

  let id: number;
  try {
    const idStr = execSync(`gh api repos/${owner}/${repo} --jq .id`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    id = parseInt(idStr, 10);
  } catch (error) {
    throw new ProofShotError(`Could not fetch repository ID for ${owner}/${repo}`, error);
  }

  return { owner, repo, id };
}

// ─── PR Detection ───

/**
 * Find the PR number for the current branch, or validate an explicit PR number.
 */
export function getPRNumber(explicitPR?: string): number {
  if (explicitPR) {
    if (!/^\d+$/.test(explicitPR)) {
      throw new ProofShotError(`Invalid PR number: ${explicitPR}`);
    }
    const num = parseInt(explicitPR, 10);
    try {
      execSync(`gh pr view ${num} --json number -q .number`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      throw new ProofShotError(`PR #${num} not found or not accessible.`);
    }
    return num;
  }

  try {
    const numStr = execSync('gh pr view --json number -q .number', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return parseInt(numStr, 10);
  } catch {
    throw new ProofShotError(
      'No PR found for the current branch.\n' +
        'Either specify a PR number: proofshot pr 42\n' +
        'Or create a PR first: gh pr create',
    );
  }
}

// ─── File Upload (GitHub User Attachments) ───

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.webm':
      return 'video/webm';
    case '.mp4':
      return 'video/mp4';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Upload a single file to GitHub's user-attachments endpoint.
 *
 * This is the same mechanism the GitHub web UI uses for drag-and-drop uploads.
 * Flow:
 * 1. POST to /upload/policies/assets with file metadata → get S3 upload form
 * 2. POST file to S3 using the returned form fields
 * 3. Return the permanent github.com/user-attachments/assets/UUID URL
 */
export async function uploadAsset(
  filePath: string,
  token: string,
  repoId: number,
): Promise<UploadedAsset> {
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;
  const contentType = getContentType(filePath);

  // Step 1: Request upload policy
  const policyResponse = await fetch('https://github.com/upload/policies/assets', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `token ${token}`,
    },
    body: JSON.stringify({
      name: fileName,
      size: fileSize,
      content_type: contentType,
      repository_id: repoId,
    }),
  });

  if (!policyResponse.ok) {
    const body = await policyResponse.text();
    throw new ProofShotError(
      `GitHub upload policy request failed (${policyResponse.status}): ${body}`,
    );
  }

  const policy = (await policyResponse.json()) as {
    upload_url: string;
    form: Record<string, string>;
    asset: { id: number; href: string };
  };

  // Step 2: Upload file to S3 using the form fields
  const fileBuffer = fs.readFileSync(filePath);
  const formData = new FormData();

  for (const [key, value] of Object.entries(policy.form)) {
    formData.append(key, value);
  }

  // File must be the last field
  const blob = new Blob([fileBuffer], { type: contentType });
  formData.append('file', blob, fileName);

  const uploadResponse = await fetch(policy.upload_url, {
    method: 'POST',
    body: formData,
  });

  if (!uploadResponse.ok && uploadResponse.status !== 204 && uploadResponse.status !== 201) {
    throw new ProofShotError(
      `File upload failed (${uploadResponse.status}): ${await uploadResponse.text()}`,
    );
  }

  return {
    url: policy.asset.href,
    name: fileName,
  };
}

/**
 * Upload multiple files sequentially with progress reporting.
 * Continues past individual failures. Map is keyed by full file path
 * to avoid collisions when files from different sessions share a basename.
 */
export async function uploadAssets(
  filePaths: string[],
  token: string,
  repoId: number,
  onProgress?: (current: number, total: number, fileName: string) => void,
): Promise<Map<string, UploadedAsset>> {
  const results = new Map<string, UploadedAsset>();

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    const fileName = path.basename(filePath);
    onProgress?.(i + 1, filePaths.length, fileName);

    try {
      const asset = await uploadAsset(filePath, token, repoId);
      results.set(filePath, asset);
    } catch (error) {
      console.error(`  Failed to upload ${fileName}: ${(error as Error).message}`);
    }
  }

  return results;
}

// ─── PR Comment ───

/**
 * Post a comment on a GitHub PR.
 * Pipes markdown body via stdin to avoid shell quoting issues.
 */
export function postPRComment(prNumber: number, body: string): void {
  try {
    execSync(`gh pr comment ${prNumber} --body-file -`, {
      input: body,
      encoding: 'utf-8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error: any) {
    const stderr = error?.stderr?.toString?.() || '';
    throw new ProofShotError(`Failed to post PR comment: ${stderr}`, error);
  }
}
