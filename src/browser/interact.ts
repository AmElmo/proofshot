import { ab } from '../utils/exec.js';

/**
 * Click an element by its ref (e.g., @e3).
 */
export function click(ref: string): void {
  ab(`click ${ref}`, 10000);
}

/**
 * Fill a form field by its ref.
 */
export function fill(ref: string, value: string): void {
  ab(`fill ${ref} "${value.replace(/"/g, '\\"')}"`, 10000);
}

/**
 * Type text (keyboard input, not targeting a specific element).
 */
export function type(text: string): void {
  ab(`type "${text.replace(/"/g, '\\"')}"`, 10000);
}

/**
 * Press a key (e.g., Enter, Tab, Escape).
 */
export function press(key: string): void {
  ab(`press ${key}`, 5000);
}

/**
 * Scroll the page in a direction.
 */
export function scroll(direction: 'up' | 'down' = 'down', amount = 3): void {
  ab(`scroll ${direction} ${amount}`, 5000);
}
