# Visual Overlays Spec

## Problem

Agent recordings show a page that changes magically — elements get clicked, fields get filled, pages scroll — but there's no cursor, no visible intent. It doesn't look like a screen recording; it looks like a haunted browser.

## Solution

Two visual layers rendered in the viewer on top of the video, synced to action timestamps. Both toggleable.

### 1. Ripple

A circular pulse animation at the position of the element being interacted with. Appears for all ref-targeted actions: `click`, `fill`, `type`.

- Renders as a colored circle that expands and fades out (~600ms)
- Positioned at the center of the target element's bounding box
- Triggered at the action's timestamp (no anticipation offset — see timing section)
- Different colors by action type:
  - `click` → blue ripple
  - `fill` / `type` → orange ripple (input-focused)
- For `scroll`, show a directional arrow indicator at center of viewport:
  - `scroll up` → `↑`  `scroll down` → `↓`  `scroll left` → `←`  `scroll right` → `→`
  - Arrow fades out over 800ms, same as `scroll-indicator` CSS class
- For `press` — toast only, no ripple (targets the focused element, no ref)

### 2. Toast

A small text label describing the current action. Shows at the bottom-center of the video.

- Semi-transparent dark background, white text, rounded corners
- Shows a human-readable description of the action:
  - `click @e3` → "Click: Submit" (using captured element label)
  - `fill @e5 "hello"` → "Type: hello into Email" (label from capture)
  - `scroll down 3` → "Scroll down"
  - `open http://localhost:3000/dashboard` → "Navigate: /dashboard"
  - `type @e4 "hello"` → "Type: hello into Search" (label from capture)
  - `press Enter` → "Press: Enter"
  - `screenshot step-1.png` → "Screenshot"
- Appears at the action timestamp, stays visible until the next action (or 3s, whichever is shorter)
- Fades in/out smoothly

## Data capture: element bounding boxes

Current `session-log.json` entries only store the action string. We need to also capture element position data at action time.

### Enriched SessionLogEntry

```typescript
interface SessionLogEntry {
  action: string;
  relativeTimeSec: number;
  timestamp: string;
  // New optional fields:
  element?: {
    label: string;           // From `agent-browser get text @e3`
    bbox: {                  // From `agent-browser get box @e3 --json`
      x: number;
      y: number;
      width: number;
      height: number;
    };
    viewport: {              // From `agent-browser eval` querying window dimensions
      width: number;
      height: number;
    };
  };
}
```

### How to capture it

agent-browser has built-in commands for this:

- **`agent-browser get box @e3 --json`** → returns `{ x, y, width, height }` bounding box
- **`agent-browser get text @e3`** → returns the element's text content (for the label). Fallback chain for empty text: `get attr @eN placeholder` → `get attr @eN aria-label` → `get attr @eN name` → omit label (toast uses raw action string)
- **`agent-browser eval 'JSON.stringify({width: window.innerWidth, height: window.innerHeight})'`** → viewport size

#### Capture sequence in `execCommand()`

For ref-targeted actions (`click @e3`, `fill @e5 "text"`, `type @e4 "hello"`):

```
1. Parse args to detect element ref (regex: /@e\d+/)
2. Capture element data BEFORE execution:
   a. `agent-browser get box @eN --json` → bbox
   b. `agent-browser get text @eN` → label
   c. viewport from session state cache
3. Log the action with relativeTimeSec and element data
4. Execute the action: `agent-browser click @e3`
```

**Why capture BEFORE execution:**
- `click` actions frequently trigger navigation — the element is gone after execution
- `fill`/`type` are safe either way, but consistent ordering is simpler
- The timing cost is small (~50-100ms for two `get` calls) and acceptable

**Timing model:** `relativeTimeSec` is recorded after bbox capture but before action execution. This means the timestamp is ~50-100ms before the visual change appears in the video. In practice this is fine — the ripple should appear slightly before or right as the change happens.

- If capture fails (element not found, timeout), catch the error, log the entry without `element`, and proceed with execution. Toast falls back to raw action string, ripple skips.

**For non-ref actions** (`press`, `scroll`, `open`, `screenshot`):
- No element capture needed
- Toast works from the action string alone
- No ripple rendered (except scroll arrow for `scroll`)

**Viewport caching:** Query viewport once at session start (in `startCommand`) and store in session state. In `execCommand()`, if the action starts with `set viewport`, re-query viewport via eval after execution and update the cached value in session state (call `saveSession()` with the new viewport).

### Failure handling

Element data capture is best-effort. If any `get box` / `get text` call throws:
- Catch the error, log a debug warning
- Write the session-log entry without the `element` field
- The viewer handles missing `element` gracefully: toast uses raw action string, ripple doesn't render

## Viewer implementation

### Overlay rendering approach

The viewer already has a `<video>` element and a `timeupdate` listener. We add:

1. A `<div class="video-overlay">` positioned absolutely over the video panel, matching the video's rendered dimensions
2. A scheduling loop (see below) that pre-computes overlay windows and triggers animations at the right time
3. Scale bbox coordinates from the original viewport size to the video's current rendered size

### Overlay scheduling

`timeupdate` fires roughly every 250ms — too coarse for tight animation timing. Instead:

1. **On video play**, start a `requestAnimationFrame` loop
2. Each frame, read `video.currentTime` and check against a precomputed list of overlay windows
3. Each entry generates two windows:
   - **Ripple window:** `[entry.relativeTimeSec, entry.relativeTimeSec + 0.6]` (600ms animation)
   - **Toast window:** `[entry.relativeTimeSec, min(nextEntry.relativeTimeSec, entry.relativeTimeSec + 3)]`
4. When `currentTime` enters a window, create the overlay DOM element (if not already created for this entry)
5. When `currentTime` exits a window, remove it
6. **On video pause/end**, cancel the rAF loop

Keep the existing `timeupdate` listener for timeline step highlighting (that's coarse enough for 250ms). Use rAF only for the overlay layer.

### Coordinate scaling

The video might render at a different size than the original viewport. We scale:

```
scaleX = videoElement.clientWidth / entry.element.viewport.width
scaleY = videoElement.clientHeight / entry.element.viewport.height
renderX = (entry.element.bbox.x + entry.element.bbox.width / 2) * scaleX
renderY = (entry.element.bbox.y + entry.element.bbox.height / 2) * scaleY
```

Re-calculate on window resize (debounced).

### Toggle UI

Add a small toggle bar between the header and the viewer:

```
[Overlays: ON/OFF]  [Ripples ✓] [Toasts ✓]
```

- Master toggle turns both on/off
- Individual toggles for ripples and toasts separately
- State saved in localStorage so it persists across reloads
- Default: both ON
- When toggled off mid-playback, immediately remove any active overlay elements

### CSS animations

```css
.ripple {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  transform: translate(-50%, -50%);  /* center on point */
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

.toast {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  pointer-events: none;
  animation: toast-in 200ms ease-out;
  white-space: nowrap;
}

@keyframes toast-in {
  0%   { opacity: 0; transform: translateX(-50%) translateY(8px); }
  100% { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

## Files to change

| File | Change |
|---|---|
| `src/commands/exec.ts` | Before executing ref-targeted actions, capture bbox + label via `ab()` calls. Extend `SessionLogEntry` interface with optional `element` field. |
| `src/commands/start.ts` | Capture initial viewport size and store in session state. |
| `src/session/state.ts` | Add `viewport?: { width: number; height: number }` to `SessionState`. |
| `src/artifacts/viewer.ts` | Add overlay container div, toggle controls bar, rAF-based overlay scheduler, ripple/toast rendering, CSS animations, coordinate scaling logic. |

## Scope

This is a viewer-only feature. The raw video stays clean. All visuals are HTML/CSS overlays rendered on top of the video in the viewer, driven by enriched session-log data.

## Out of scope (future)

- Synthetic mouse cursor with movement animation
- Character-by-character typing visualization
- Baking overlays directly into the video file
