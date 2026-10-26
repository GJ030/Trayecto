/** Íconos SVG y etiquetas visuales. */
import { esc } from '@/shared/utils/format';

const ICONS: Record<string, string> = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-5h4v5"/>',
  route:
    '<circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="5" r="2.2"/><path d="M8.2 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.8"/>',
  fuel: '<path d="M4 21V5.5A2.5 2.5 0 0 1 6.5 3h6A2.5 2.5 0 0 1 15 5.5V21"/><path d="M3 21h13"/><path d="M7 8h5"/><path d="M15 10h1.5a2 2 0 0 1 2 2v4.5a1.5 1.5 0 0 0 3 0V8.5L18.5 5.5"/>',
  pin: '<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  car: '<path d="M5 17H4a1 1 0 0 1-1-1v-3.2a2 2 0 0 1 .4-1.2L6 8a2 2 0 0 1 1.6-.8h8.8A2 2 0 0 1 18 8l2.6 3.6a2 2 0 0 1 .4 1.2V16a1 1 0 0 1-1 1h-1"/><path d="M9.5 17h5"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M4 12h16"/>',
  sliders:
    '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  archive:
    '<rect x="3" y="4" width="18" height="4" rx="1.5"/><path d="M5 8v10.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V8"/><path d="M10 12h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevDown: '<path d="m6 9 6 6 6-6"/>',
  panel:
    '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/><path d="m15.5 10-2 2 2 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  play: '<path d="M8 5.5v13l11-6.5z"/>',
  pause:
    '<rect x="6.5" y="5.5" width="4" height="13" rx="1"/><rect x="13.5" y="5.5" width="4" height="13" rx="1"/>',
  edit: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="m14 7 3 3"/>',
  trash:
    '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  upload: '<path d="M12 20V9"/><path d="m7 14 5-5 5 5"/><path d="M5 4h14"/>',
  swap: '<path d="M7 20V4"/><path d="m3 8 4-4 4 4"/><path d="M17 4v16"/><path d="m21 16-4 4-4-4"/>',
  swapH:
    '<path d="M4 7h16"/><path d="m16 3 4 4-4 4"/><path d="M20 17H4"/><path d="m8 13-4 4 4 4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  gauge:
    '<path d="M4.5 17a8.5 8.5 0 1 1 15 0"/><path d="m12 13 4-4"/><circle cx="12" cy="13" r="1.3"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  briefcase:
    '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M3 13h18"/>',
  dumbbell: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  heart:
    '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  refresh:
    '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  speed: '<path d="M3.5 16a8.5 8.5 0 0 1 17 0"/><path d="m12 16 5-5"/>',
  wallet:
    '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18"/><circle cx="16.5" cy="15" r="1.2"/>',
  shield:
    '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
  drop: '<path d="M12 3.5s6 6.4 6 10.8a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/>',
  keyboard:
    '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9"/>',
  dots: '<circle cx="12" cy="5.5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="18.5" r="1.4" fill="currentColor"/>',
  folder:
    '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2.2 2.5h7.3A2.5 2.5 0 0 1 21 10v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18z"/>',
};
export const icon = (n: string, s = 18) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
export const kindIcon = (k: string) =>
  ({ home: 'home', work: 'briefcase', gym: 'dumbbell', family: 'heart' })[k] || 'pin';
export const tagHTML = (t: string) =>
  `<span class="tag ${t === 'Personal' ? 'personal' : 'trabajo'}">${esc(t)}</span>`;
