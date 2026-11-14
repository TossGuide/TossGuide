/** Inline SVG icons (no network, no icon font). Each destination has text + icon, never colour alone. */
import type { Destination } from '@tossguide/shared/rules/types';

const svg = (body: string, size = 24) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS: Record<Destination['icon'] | 'camera' | 'upload' | 'keyboard' | 'info' | 'chart' | 'back' | 'check' | 'lock' | 'sound' | 'mute', string> = {
  recycle: '<path d="M7 19H4.8a1.8 1.8 0 0 1-1.6-2.7L5.5 12"/><path d="m11 19 2 2-2 2"/><path d="M13 21h4.2a1.8 1.8 0 0 0 1.6-2.7L17.3 15"/><path d="m14 5.6-1.2-2a1.8 1.8 0 0 0-3.1 0L7.3 7.7"/><path d="m4.6 9.5 2.7-1.8 1.8 2.7"/><path d="m16.4 9.3 2.7 1.8-.6-3.2"/>',
  food: '<path d="M12 7c-1.5-2.5-6-2.5-7 1.5S6.5 18 9 19.5c1.2.7 2 .2 3 .2s1.8.5 3-.2c2.5-1.5 5-7 4-11S13.5 4.5 12 7Z"/><path d="M12 7c0-2 1-3.5 3-4"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M5 6l1.2 14a2 2 0 0 0 2 1.8h7.6a2 2 0 0 0 2-1.8L19 6"/>',
  bottle: '<path d="M10 2h4v3l1.5 2.5V20a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V7.5L10 5Z"/><path d="M8.5 11h7"/><path d="M8.5 16h7"/>',
  hazard: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  paper: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/>',
  battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2"/><path d="m10 9-2 3h4l-2 3"/>',
  question: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  camera: '<path d="M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5Z"/><circle cx="12" cy="13" r="3.5"/>',
  upload: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M8 16h8"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16v-5"/><path d="M12 16V8"/><path d="M17 16v-8"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  sound: '<path d="M11 5 6 9H2v6h4l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4Z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
};

export const icon = (name: keyof typeof ICONS, size = 24) => svg(ICONS[name], size);
