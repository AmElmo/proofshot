import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  model: string;
  source: 'claude-logs' | 'estimated' | 'unavailable';
}

/**
 * Attempt to estimate token usage for a ProofShot session.
 * Tries Claude Code logs first, falls back to content-based estimation.
 */
export function estimateTokenUsage(
  sessionDir: string,
  startTimeMs: number,
  endTimeMs: number,
): TokenUsage | null {
  const claudeUsage = tryClaudeCodeLogs(startTimeMs, endTimeMs);
  if (claudeUsage) return claudeUsage;

  return estimateFromContent(sessionDir);
}

function tryClaudeCodeLogs(startTimeMs: number, endTimeMs: number): TokenUsage | null {
  const claudeDir = path.join(os.homedir(), '.claude', 'sessions');
  if (!fs.existsSync(claudeDir)) return null;

  try {
    const files = fs.readdirSync(claudeDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(claudeDir, file), 'utf-8'));
      const sessionStart = new Date(data.startedAt).getTime();
      if (sessionStart >= startTimeMs - 60000 && sessionStart <= endTimeMs + 60000) {
        if (data.totalInputTokens || data.usage) {
          return {
            inputTokens: data.totalInputTokens || data.usage?.inputTokens || 0,
            outputTokens: data.totalOutputTokens || data.usage?.outputTokens || 0,
            totalTokens: (data.totalInputTokens || 0) + (data.totalOutputTokens || 0),
            estimatedCost: 0,
            model: data.model || 'claude',
            source: 'claude-logs',
          };
        }
      }
    }
  } catch {
    // Silent fallback
  }

  return null;
}

function estimateFromContent(sessionDir: string): TokenUsage | null {
  const logPath = path.join(sessionDir, 'session-log.json');
  if (!fs.existsSync(logPath)) return null;

  try {
    const entries = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
    if (!Array.isArray(entries) || entries.length === 0) return null;

    const actionCount = entries.length;
    const inputTokens = actionCount * 500;
    const outputTokens = actionCount * 300;
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
      model: 'estimated',
      source: 'estimated',
    };
  } catch {
    return null;
  }
}

export function formatTokenUsage(usage: TokenUsage): string {
  const fmt = (n: number) => n.toLocaleString();
  let result = '';
  result += `- Input tokens: ~${fmt(usage.inputTokens)}\n`;
  result += `- Output tokens: ~${fmt(usage.outputTokens)}\n`;
  result += `- Total tokens: ~${fmt(usage.totalTokens)}\n`;
  if (usage.estimatedCost > 0) {
    result += `- Estimated cost: ~$${usage.estimatedCost.toFixed(4)}\n`;
  }
  if (usage.source === 'estimated') {
    result += `- Source: estimated from ${usage.model === 'estimated' ? 'session activity' : usage.model}\n`;
  }
  return result;
}
