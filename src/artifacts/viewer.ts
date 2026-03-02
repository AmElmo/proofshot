import * as fs from 'fs';
import * as path from 'path';
import type { SessionLogEntry } from '../commands/exec.js';

interface ViewerData {
  description: string | null;
  framework: string;
  durationSec: number;
  videoFilename: string | null;
  entries: SessionLogEntry[];
  consoleErrorCount: number;
  serverErrorCount: number;
}

/**
 * Map an action string to an icon character for the timeline.
 */
function getActionIcon(action: string): string {
  const cmd = action.split(' ')[0].toLowerCase();
  switch (cmd) {
    case 'open':
    case 'navigate':
      return '\u{1F9ED}'; // compass
    case 'click':
      return '\u{1F5B1}'; // mouse
    case 'fill':
    case 'type':
      return '\u2328'; // keyboard
    case 'screenshot':
      return '\u{1F4F7}'; // camera
    case 'snapshot':
      return '\u{1F441}'; // eye
    case 'scroll':
      return '\u2195'; // scroll arrows
    case 'press':
      return '\u2318'; // key
    default:
      return '\u25B6'; // play
  }
}

/**
 * Format seconds as m:ss string.
 */
function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generate a standalone HTML viewer file from session data.
 */
export function generateViewer(data: ViewerData): string {
  const date = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const stepsHtml = data.entries
    .map((entry, i) => {
      const icon = getActionIcon(entry.action);
      const time = formatTime(entry.relativeTimeSec);
      const action = escapeHtml(entry.action);
      return `      <div class="step" data-time="${entry.relativeTimeSec}" data-index="${i}" onclick="seekTo(${entry.relativeTimeSec})">
        <span class="step-number">${i + 1}</span>
        <span class="icon">${icon}</span>
        <div class="step-content">
          <span class="action">${action}</span>
        </div>
        <span class="time">${time}</span>
      </div>`;
    })
    .join('\n');

  const descriptionHtml = data.description
    ? `<p class="description">${escapeHtml(data.description)}</p>`
    : '';

  const consoleBadgeClass = data.consoleErrorCount === 0 ? 'clean' : 'has-errors';
  const consoleBadgeText =
    data.consoleErrorCount === 0
      ? 'Console: clean'
      : `Console: ${data.consoleErrorCount} error(s)`;

  const serverBadgeClass = data.serverErrorCount === 0 ? 'clean' : 'has-errors';
  const serverBadgeText =
    data.serverErrorCount === 0
      ? 'Server: clean'
      : `Server: ${data.serverErrorCount} error(s)`;

  const hasVideo = !!data.videoFilename;

  const videoPanelHtml = hasVideo
    ? `<video src="./${escapeHtml(data.videoFilename!)}" controls></video>`
    : `<div class="no-video"><p>No video recorded</p><p class="no-video-hint">Screenshots are available in the timeline</p></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ProofShot — Verification Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      min-height: 100vh;
    }

    .header {
      padding: 24px 32px;
      border-bottom: 1px solid #21262d;
      background: #161b22;
    }

    .header h1 {
      font-size: 20px;
      font-weight: 600;
      color: #f0f6fc;
      margin-bottom: 8px;
    }

    .header .description {
      font-size: 14px;
      color: #8b949e;
      margin-bottom: 6px;
    }

    .header .meta {
      font-size: 12px;
      color: #484f58;
    }

    .error-badges {
      display: flex;
      gap: 12px;
      margin-top: 10px;
    }

    .error-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
    }

    .error-badge.clean {
      background: rgba(63, 185, 80, 0.12);
      color: #3fb950;
      border: 1px solid rgba(63, 185, 80, 0.25);
    }

    .error-badge.has-errors {
      background: rgba(248, 81, 73, 0.12);
      color: #f85149;
      border: 1px solid rgba(248, 81, 73, 0.25);
    }

    .error-badge .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .error-badge.clean .badge-dot {
      background: #3fb950;
    }

    .error-badge.has-errors .badge-dot {
      background: #f85149;
    }

    .viewer {
      display: flex;
      height: calc(100vh - 140px);
      min-height: 400px;
    }

    .video-panel {
      flex: 0 0 62%;
      padding: 16px;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      background: #0d1117;
    }

    .video-panel video {
      width: 100%;
      max-height: 100%;
      border-radius: 8px;
      background: #000;
    }

    .no-video {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 300px;
      border: 1px dashed #30363d;
      border-radius: 8px;
      color: #484f58;
      font-size: 15px;
    }

    .no-video-hint {
      font-size: 12px;
      margin-top: 8px;
      color: #30363d;
    }

    .timeline-panel {
      flex: 0 0 38%;
      border-left: 1px solid #21262d;
      overflow-y: auto;
      background: #161b22;
    }

    .timeline-header {
      padding: 16px 20px 12px;
      font-size: 13px;
      font-weight: 600;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #21262d;
      position: sticky;
      top: 0;
      background: #161b22;
      z-index: 10;
    }

    .step {
      display: flex;
      align-items: center;
      padding: 10px 20px;
      cursor: pointer;
      border-bottom: 1px solid #21262d;
      transition: background 0.15s;
      gap: 10px;
    }

    .step:hover {
      background: #1c2128;
    }

    .step.active {
      background: #1f2a37;
      border-left: 3px solid #58a6ff;
      padding-left: 17px;
    }

    .step-number {
      font-size: 11px;
      color: #484f58;
      min-width: 20px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .icon {
      font-size: 16px;
      min-width: 24px;
      text-align: center;
    }

    .step-content {
      flex: 1;
      min-width: 0;
    }

    .action {
      font-size: 13px;
      font-family: 'SF Mono', SFMono-Regular, 'Consolas', 'Liberation Mono', Menlo, monospace;
      color: #c9d1d9;
      word-break: break-all;
    }

    .step.active .action {
      color: #f0f6fc;
    }

    .time {
      font-size: 12px;
      color: #484f58;
      font-variant-numeric: tabular-nums;
      min-width: 36px;
      text-align: right;
    }

    .step.active .time {
      color: #58a6ff;
    }


    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: #484f58;
      font-size: 14px;
    }

    /* Scrollbar styling */
    .timeline-panel::-webkit-scrollbar { width: 6px; }
    .timeline-panel::-webkit-scrollbar-track { background: transparent; }
    .timeline-panel::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
    .timeline-panel::-webkit-scrollbar-thumb:hover { background: #484f58; }

    @media (max-width: 768px) {
      .viewer {
        flex-direction: column;
        height: auto;
      }
      .video-panel, .timeline-panel {
        flex: none;
        width: 100%;
      }
      .timeline-panel {
        border-left: none;
        border-top: 1px solid #21262d;
        max-height: 50vh;
      }
      .error-badges {
        flex-wrap: wrap;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1><svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style="width:24px;height:24px;vertical-align:middle;margin-right:8px"><path d="M8,24 L8,12 C8,8 12,8 12,8 L24,8" fill="none" stroke="#6366F1" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M40,8 L52,8 C56,8 56,12 56,12 L56,24" fill="none" stroke="#6366F1" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8,40 L8,52 C8,56 12,56 12,56 L24,56" fill="none" stroke="#6366F1" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M40,56 L52,56 C56,56 56,52 56,52 L56,40" fill="none" stroke="#6366F1" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20,34 L28,42 L44,22" fill="none" stroke="#22D3EE" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>ProofShot Verification</h1>
    ${descriptionHtml}
    <p class="meta">${escapeHtml(date)} &middot; ${escapeHtml(data.framework)} &middot; ${data.durationSec}s</p>
    <div class="error-badges">
      <span class="error-badge ${consoleBadgeClass}"><span class="badge-dot"></span>${consoleBadgeText}</span>
      <span class="error-badge ${serverBadgeClass}"><span class="badge-dot"></span>${serverBadgeText}</span>
    </div>
  </div>
  <div class="viewer">
    <div class="video-panel">
      ${videoPanelHtml}
    </div>
    <div class="timeline-panel">
      <div class="timeline-header">Timeline &middot; ${data.entries.length} actions</div>
${stepsHtml}
    </div>
  </div>
  <script>
    const video = document.querySelector('video');
    const steps = document.querySelectorAll('.step');
    const timelinePanel = document.querySelector('.timeline-panel');

    function seekTo(time) {
      if (video) {
        video.currentTime = time;
        video.play();
      }
    }

    // Highlight active step as video plays (only if video exists)
    if (video) {
      video.addEventListener('timeupdate', () => {
        const t = video.currentTime;
        let activeStep = null;

        steps.forEach(step => {
          const stepTime = parseFloat(step.dataset.time);
          const nextStep = step.nextElementSibling;
          const isLastStep = !nextStep || !nextStep.classList.contains('step');
          const nextTime = isLastStep ? Infinity : parseFloat(nextStep.dataset.time);
          const isActive = t >= stepTime && t < nextTime;
          step.classList.toggle('active', isActive);
          if (isActive) activeStep = step;
        });

        // Auto-scroll the active step into view
        if (activeStep) {
          const panelRect = timelinePanel.getBoundingClientRect();
          const stepRect = activeStep.getBoundingClientRect();
          if (stepRect.top < panelRect.top || stepRect.bottom > panelRect.bottom) {
            activeStep.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }
      });
    }
  </script>
</body>
</html>`;
}

/**
 * Write the viewer HTML file to the output directory.
 * Returns the path to the generated file, or null if no session log exists.
 */
export function writeViewer(
  outputDir: string,
  data: Omit<ViewerData, 'entries'> & { entries?: SessionLogEntry[] },
): string | null {
  // Load session log if entries not provided
  let entries = data.entries;
  if (!entries) {
    const logPath = path.join(outputDir, 'session-log.json');
    if (!fs.existsSync(logPath)) return null;
    try {
      entries = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
    } catch {
      return null;
    }
  }

  if (!entries || entries.length === 0) return null;

  const html = generateViewer({ ...data, entries });
  const viewerPath = path.join(outputDir, 'viewer.html');
  fs.writeFileSync(viewerPath, html);
  return viewerPath;
}
