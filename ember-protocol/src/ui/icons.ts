const paths: Record<string, string> = {
  bolt: '<path d="m13 2-8 12h6l-1 8 9-13h-7z"/>',
  arrow: '<path d="M3 12h17m-6-6 6 6-6 6M3 7h5M3 17h5"/>',
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M8 4l4 4 4-4M8 20l4-4 4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  plus: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  fast: '<path d="m3 5 7 7-7 7m10-14 7 7-7 7"/>',
  volume: '<path d="M11 4 6 8H2v8h4l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 4 6 8H2v8h4l5 4zM16 9l6 6m0-6-6 6"/>',
  pause: '<path d="M7 4v16M17 4v16"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  full: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  target:
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
  shield: '<path d="m12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5z"/><path d="m8 12 3 3 5-6"/>',
  people:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3"/>',
  skull:
    '<path d="M6 16a9 9 0 1 1 12 0v5H6z"/><circle cx="8" cy="11" r="1"/><circle cx="16" cy="11" r="1"/><path d="M10 21v-3m4 3v-3"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  flag: '<path d="M5 22V3h14l-3 5 3 5H5"/>',
  reset: '<path d="M3 11a9 9 0 1 1 2 7M3 3v8h8"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v8M6 10h12"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
};
export function icon(name: string, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.bolt}</svg>`;
}
export function gunIcon(id: string) {
  return `<svg viewBox="0 0 150 55" fill="none" aria-hidden="true"><path d="M15 20h75v17H59l-5 13H43l3-13H24l-9-5H5v-9h10z" fill="${id === 'arc' ? '#b9a2da' : id === 'shotgun' ? '#dfa178' : '#b8c6b7'}"/><path d="M89 23h49v9H89zM33 14h37v5H33zM70 34l12 15H69L59 34z" fill="#617771"/><path d="M22 23h23v5H22zM58 23h5v10h-5zM68 23h5v10h-5zM78 23h5v10h-5z" fill="#293f3c"/>${id === 'shotgun' ? '<path d="M92 33h43v6H92z" fill="#bf966e"/>' : ''}${id === 'arc' ? '<path d="M96 19h5v18h-5zm12 0h5v18h-5zm12 0h5v18h-5z" fill="#cfbafb"/>' : ''}</svg>`;
}
