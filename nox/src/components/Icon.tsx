const paths: Record<string, string> = {
  home: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z',
  list: 'M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01',
  plus: 'M12 5v14M5 12h14',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12h.01',
  grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 4.5v5M8 14.5v5',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5z',
  eyeOff: 'M4 4l16 16M10.4 6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 7.2C4 8.9 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.4-1.1M9.9 10a2.75 2.75 0 0 0 4 3.9',
  chevronRight: 'M9.5 6l6 6-6 6',
  chevronLeft: 'M14.5 6l-6 6 6 6',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  trash: 'M5 7h14M10 4h4M7 7l.8 12a1 1 0 0 0 1 1h6.4a1 1 0 0 0 1-1L17 7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  backspace: 'M9 5h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7zM12 9.5l5 5M17 9.5l-5 5',
  repeat: 'M17 3.5l3 3-3 3M4 11.5v-1a4 4 0 0 1 4-4h12M7 20.5l-3-3 3-3M20 12.5v1a4 4 0 0 1-4 4H4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  percent: 'M18.5 5.5l-13 13M7 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14a6.5 6.5 0 0 1 3 6',
  shield: 'M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z',
  trend: 'M3.5 17.5l6-6 4 4 7-8M15 7.5h5.5V13',
  card: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h3',
  pie: 'M12 3v9h9M20.5 15.5A9 9 0 1 1 8.5 3.7',
  wallet: 'M4 7.5V18a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-3M4 7.5A2.5 2.5 0 0 1 6.5 5H17v2.5M4 7.5h15a1 1 0 0 1 1 1V12M20 12h-4a2 2 0 0 0 0 4h4z',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
  arrowDownLeft: 'M17 7 7 17M7 8v9h9',
  arrowUpRight: 'M7 17 17 7M8 7h9v9',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  shoppingCart: 'M3 4h2l2.2 11h10.6l2-8H6M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  utensils: 'M7 3v7M4 3v4a3 3 0 0 0 6 0V3M7 10v11M16 3v18M16 3c3 2 4 5 4 9h-4',
  car: 'M5 11l1.5-5h11l1.5 5M3 11h18v7H3zM6 18v2M18 18v2M6 14h.01M18 14h.01',
  heart: 'M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11a4.8 4.8 0 0 1 8.8-2.5 4.8 4.8 0 0 1 8.8 2.5z',
  clapperboard: 'M4 7h16v13H4zM4 7l2-4 5 2-2 4M11 7l2-4 5 2-2 4M18 7l2-4',
  shoppingBag: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2',
  graduationCap: 'm2 10 10-5 10 5-10 5-10-5zM6 12v5c4 3 8 3 12 0v-5M22 10v6',
  briefcase: 'M3 8h18v12H3zM8 8V5h8v3M3 12c5 3 13 3 18 0',
  download: 'M12 4v11M7 10.5l5 5 5-5M5 20h14',
  upload: 'M12 15.5V4.5M7 9l5-5 5 5M5 20h14',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
};

export function Icon({ name, size = 22, stroke = 1.8 }: { name: keyof typeof paths | string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={paths[name] ?? ''} />
    </svg>
  );
}
