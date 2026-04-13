import { ab } from '../utils/exec.js';

/**
 * Click an element by its ref (e.g., @e3).
 */
export function click(ref: string, sessionName?: string): void {
  ab(`click ${ref}`, { timeoutMs: 10000, session: sessionName });
}

/**
 * Fill a form field by its ref.
 */
export function fill(ref: string, value: string, sessionName?: string): void {
  ab(`fill ${ref} "${value.replace(/"/g, '\\"')}"`, { timeoutMs: 10000, session: sessionName });
}

/**
 * Type text (keyboard input, not targeting a specific element).
 */
export function type(text: string, sessionName?: string): void {
  ab(`type "${text.replace(/"/g, '\\"')}"`, { timeoutMs: 10000, session: sessionName });
}

/**
 * Press a key (e.g., Enter, Tab, Escape).
 */
export function press(key: string, sessionName?: string): void {
  ab(`press ${key}`, { timeoutMs: 5000, session: sessionName });
}

/**
 * Scroll the page in a direction.
 */
export function scroll(direction: 'up' | 'down' = 'down', amount = 3, sessionName?: string): void {
  ab(`scroll ${direction} ${amount}`, { timeoutMs: 5000, session: sessionName });
}
