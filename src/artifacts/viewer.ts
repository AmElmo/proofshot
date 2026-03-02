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
 * Serialize session log entries to a JSON string safe for embedding in HTML <script>.
 */
function serializeEntries(entries: SessionLogEntry[]): string {
  return JSON.stringify(entries).replace(/<\//g, '<\\/');
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

  const consoleErrorsHtml =
    data.consoleErrorCount === 0
      ? '<p class="no-errors">No console errors detected.</p>'
      : `<p class="has-errors">${data.consoleErrorCount} error(s) detected — see SUMMARY.md for details.</p>`;

  const serverErrorsHtml =
    data.serverErrorCount === 0
      ? '<p class="no-errors">No server errors detected.</p>'
      : `<p class="has-errors">${data.serverErrorCount} error(s) detected — see SUMMARY.md for details.</p>`;

  const hasVideo = !!data.videoFilename;

  // Wrap video in a container for overlay positioning
  const videoPanelHtml = hasVideo
    ? `<div class="video-container">
        <video src="./${escapeHtml(data.videoFilename!)}" controls></video>
        <div class="video-overlay"></div>
      </div>`
    : `<div class="no-video"><p>No video recorded</p><p class="no-video-hint">Screenshots are available in the timeline</p></div>`;

  const entriesJson = serializeEntries(data.entries);

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

    /* Overlay toggle controls */
    .overlay-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      user-select: none;
      position: relative;
      font-weight: 400;
      text-transform: none;
      letter-spacing: 0;
      font-size: 12px;
    }

    .overlay-toggle .tooltip {
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 6px;
      background: #1c2128;
      color: #c9d1d9;
      font-size: 11px;
      padding: 6px 10px;
      border-radius: 6px;
      white-space: nowrap;
      pointer-events: none;
      border: 1px solid #30363d;
      z-index: 10;
    }

    .overlay-toggle:hover .tooltip {
      display: block;
    }

    .overlay-toggle input[type="checkbox"] {
      display: none;
    }

    .toggle-track {
      position: relative;
      width: 34px;
      height: 18px;
      background: #30363d;
      border-radius: 9px;
      transition: background 0.2s;
      flex-shrink: 0;
    }

    .toggle-track::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 14px;
      height: 14px;
      background: #8b949e;
      border-radius: 50%;
      transition: transform 0.2s, background 0.2s;
    }

    .overlay-toggle input:checked + .toggle-track {
      background: #1f6feb;
    }

    .overlay-toggle input:checked + .toggle-track::after {
      transform: translateX(16px);
      background: #fff;
    }

    .viewer {
      display: flex;
      height: calc(100vh - 180px);
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

    .video-container {
      position: relative;
      width: 100%;
      max-height: 100%;
    }

    .video-container video {
      width: 100%;
      max-height: 100%;
      border-radius: 8px;
      background: #000;
      display: block;
    }

    .video-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: hidden;
      border-radius: 8px;
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
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
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

    .errors-section {
      padding: 20px 32px;
      border-top: 1px solid #21262d;
      background: #161b22;
      display: flex;
      gap: 40px;
    }

    .errors-section h2 {
      font-size: 13px;
      font-weight: 600;
      color: #8b949e;
      margin-bottom: 6px;
    }

    .no-errors {
      font-size: 13px;
      color: #3fb950;
    }

    .has-errors {
      font-size: 13px;
      color: #f85149;
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

    /* Overlay animations */
    .ripple {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      transform: translate(-50%, -50%);
      animation: ripple-expand 600ms ease-out forwards;
    }

    @keyframes ripple-expand {
      0%   { width: 12px; height: 12px; opacity: 0.7; }
      100% { width: 60px; height: 60px; opacity: 0; }
    }

    .ripple-click  { background: rgba(56, 132, 255, 0.5); }
    .ripple-fill   { background: rgba(255, 152, 56, 0.5); }

    .scroll-indicator {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      font-size: 32px;
      opacity: 0.6;
      pointer-events: none;
      animation: fade-out 800ms ease-out forwards;
    }

    @keyframes fade-out {
      0%   { opacity: 0.6; }
      100% { opacity: 0; }
    }

    .toast {
      position: absolute;
      bottom: 32px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.85);
      color: #fff;
      padding: 10px 20px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 500;
      pointer-events: none;
      animation: toast-in 200ms ease-out;
      white-space: nowrap;
      letter-spacing: 0.2px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    @keyframes toast-in {
      0%   { opacity: 0; transform: translateX(-50%) translateY(8px); }
      100% { opacity: 1; transform: translateX(-50%) translateY(0); }
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
      .errors-section {
        flex-direction: column;
        gap: 16px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>ProofShot Verification</h1>
    ${descriptionHtml}
    <p class="meta">${escapeHtml(date)} &middot; ${escapeHtml(data.framework)} &middot; ${data.durationSec}s</p>
  </div>
  <div class="viewer">
    <div class="video-panel">
      ${videoPanelHtml}
    </div>
    <div class="timeline-panel">
      <div class="timeline-header">
        <span>Timeline &middot; ${data.entries.length} actions</span>
        <label class="overlay-toggle"><input type="checkbox" id="toggle-overlays" checked><span class="toggle-track"></span> Action overlays<span class="tooltip">Show ripple animations and action labels on the video as each step plays.</span></label>
      </div>
${stepsHtml}
    </div>
  </div>
  <div class="errors-section">
    <div>
      <h2>Console Errors</h2>
      ${consoleErrorsHtml}
    </div>
    <div>
      <h2>Server Errors</h2>
      ${serverErrorsHtml}
    </div>
  </div>
  <script>
    const video = document.querySelector('video');
    const steps = document.querySelectorAll('.step');
    const timelinePanel = document.querySelector('.timeline-panel');
    const overlay = document.querySelector('.video-overlay');
    const entries = ${entriesJson};

    // --- Toggle state ---
    const toggleOverlays = document.getElementById('toggle-overlays');

    function loadToggleState() {
      try {
        const saved = JSON.parse(localStorage.getItem('proofshot-overlays') || '{}');
        if (saved.overlays === false) toggleOverlays.checked = false;
      } catch {}
    }
    function saveToggleState() {
      try {
        localStorage.setItem('proofshot-overlays', JSON.stringify({
          overlays: toggleOverlays.checked,
        }));
      } catch {}
    }
    loadToggleState();

    toggleOverlays.addEventListener('change', () => {
      if (!toggleOverlays.checked) clearOverlays();
      saveToggleState();
    });

    function clearOverlays() {
      if (!overlay) return;
      overlay.querySelectorAll('.ripple, .scroll-indicator, .toast').forEach(el => el.remove());
    }

    // --- Action icon (mirrors server-side getActionIcon) ---
    function getActionIcon(action) {
      const cmd = action.split(' ')[0].toLowerCase();
      switch (cmd) {
        case 'open': case 'navigate': return '\u{1F9ED}';
        case 'click': return '\u{1F5B1}';
        case 'fill': case 'type': return '\u2328';
        case 'screenshot': return '\u{1F4F7}';
        case 'snapshot': return '\u{1F441}';
        case 'scroll': return '\u2195';
        case 'press': case 'keyboard': return '\u2318';
        default: return '\u25B6';
      }
    }

    // --- Toast text generation ---
    function getToastText(entry) {
      const action = entry.action;
      const parts = action.split(' ');
      const cmd = parts[0].toLowerCase();
      const label = entry.element ? entry.element.label : '';
      const icon = getActionIcon(action);

      switch (cmd) {
        case 'click':
          return icon + '  Click' + (label ? ': ' + label : '');
        case 'fill': {
          const valMatch = action.match(/"([^"]*)"/);
          const val = valMatch ? valMatch[1] : '';
          const target = label || '';
          return icon + '  Type: ' + val + (target ? ' into ' + target : '');
        }
        case 'type': {
          const valMatch2 = action.match(/"([^"]*)"/);
          const val2 = valMatch2 ? valMatch2[1] : '';
          const target2 = label || '';
          return icon + '  Type: ' + val2 + (target2 ? ' into ' + target2 : '');
        }
        case 'scroll': {
          const dir = parts[1] || '';
          return icon + '  Scroll ' + dir;
        }
        case 'open': {
          const url = parts.slice(1).join(' ');
          try {
            return icon + '  Navigate: ' + new URL(url).pathname;
          } catch {
            return icon + '  Navigate: ' + url;
          }
        }
        case 'press':
          return icon + '  Press: ' + parts.slice(1).join(' ');
        case 'screenshot':
          return icon + '  Screenshot';
        default:
          return icon + '  ' + action;
      }
    }

    // --- Scroll direction arrows ---
    function getScrollArrow(action) {
      const parts = action.split(' ');
      const dir = (parts[1] || '').toLowerCase();
      switch (dir) {
        case 'up': return '\\u2191';
        case 'down': return '\\u2193';
        case 'left': return '\\u2190';
        case 'right': return '\\u2192';
        default: return '\\u2195';
      }
    }

    // --- Overlay scheduling ---
    // Precompute overlay windows for each entry
    const overlayWindows = entries.map((entry, i) => {
      const cmd = entry.action.split(' ')[0].toLowerCase();
      const nextTime = i + 1 < entries.length ? entries[i + 1].relativeTimeSec : entry.relativeTimeSec + 3;
      const rippleEnd = entry.relativeTimeSec + 0.6;
      const toastEnd = Math.min(nextTime, entry.relativeTimeSec + 3);
      // Scroll gets 800ms for its indicator
      const scrollEnd = entry.relativeTimeSec + 0.8;

      return {
        entry,
        cmd,
        rippleStart: entry.relativeTimeSec,
        rippleEnd: cmd === 'scroll' ? scrollEnd : rippleEnd,
        toastStart: entry.relativeTimeSec,
        toastEnd,
      };
    });

    // Track which overlays are currently rendered (by entry index)
    const activeRipples = new Map();
    const activeToasts = new Map();
    let rafId = null;

    function renderOverlays() {
      if (!video || !overlay) return;
      const t = video.currentTime;
      const videoEl = video;

      overlayWindows.forEach((win, idx) => {
        const enabled = toggleOverlays.checked;

        // --- Ripple / scroll indicator ---
        if (enabled) {
          if (t >= win.rippleStart && t < win.rippleEnd && !activeRipples.has(idx)) {
            const el = document.createElement('div');

            if (win.cmd === 'scroll') {
              el.className = 'scroll-indicator';
              el.textContent = getScrollArrow(win.entry.action);
              overlay.appendChild(el);
              activeRipples.set(idx, el);
            } else if ((win.cmd === 'click' || win.cmd === 'fill' || win.cmd === 'type') && win.entry.element) {
              const elem = win.entry.element;
              const scaleX = videoEl.clientWidth / elem.viewport.width;
              const scaleY = videoEl.clientHeight / elem.viewport.height;
              const cx = (elem.bbox.x + elem.bbox.width / 2) * scaleX;
              const cy = (elem.bbox.y + elem.bbox.height / 2) * scaleY;

              el.className = 'ripple ' + (win.cmd === 'click' ? 'ripple-click' : 'ripple-fill');
              el.style.left = cx + 'px';
              el.style.top = cy + 'px';
              overlay.appendChild(el);
              activeRipples.set(idx, el);
            }
          }
          if (t >= win.rippleEnd && activeRipples.has(idx)) {
            activeRipples.get(idx).remove();
            activeRipples.delete(idx);
          }
        } else if (activeRipples.has(idx)) {
          activeRipples.get(idx).remove();
          activeRipples.delete(idx);
        }

        // --- Toast ---
        if (enabled) {
          if (t >= win.toastStart && t < win.toastEnd && !activeToasts.has(idx)) {
            activeToasts.forEach((el) => el.remove());
            activeToasts.clear();

            const el = document.createElement('div');
            el.className = 'toast';
            el.textContent = getToastText(win.entry);
            overlay.appendChild(el);
            activeToasts.set(idx, el);
          }
          if (t >= win.toastEnd && activeToasts.has(idx)) {
            activeToasts.get(idx).remove();
            activeToasts.delete(idx);
          }
        } else if (activeToasts.has(idx)) {
          activeToasts.get(idx).remove();
          activeToasts.delete(idx);
        }
      });

      rafId = requestAnimationFrame(renderOverlays);
    }

    function startOverlayLoop() {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(renderOverlays);
    }

    function stopOverlayLoop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    // --- Seek handler: clear overlays on seek so they re-trigger correctly ---
    function onSeeked() {
      activeRipples.forEach(el => el.remove());
      activeRipples.clear();
      activeToasts.forEach(el => el.remove());
      activeToasts.clear();
    }

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

      // Start/stop rAF overlay loop with video play state
      video.addEventListener('play', startOverlayLoop);
      video.addEventListener('pause', stopOverlayLoop);
      video.addEventListener('ended', stopOverlayLoop);
      video.addEventListener('seeked', onSeeked);
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
