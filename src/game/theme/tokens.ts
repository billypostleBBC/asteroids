export type ThemeTokens = {
  colors: {
    accent: string;
    background: string;
    backgroundSoft: string;
    laser: string;
    lifeEmpty: string;
    panel: string;
    panelBorder: string;
    ship: string;
    text: string;
    textDim: string;
    warning: string;
  };
  fonts: {
    body: string;
    display: string;
  };
  motion: {
    overlayMs: number;
    pulseMs: number;
  };
  stroke: {
    main: number;
  };
};

export const themeTokens: ThemeTokens = {
  colors: {
    accent: '#67b4ff',
    background: '#010205',
    backgroundSoft: '#050913',
    laser: '#f5f7ff',
    lifeEmpty: '#213247',
    panel: 'rgba(7, 12, 21, 0.8)',
    panelBorder: 'rgba(103, 180, 255, 0.24)',
    ship: '#f8fbff',
    text: '#edf4ff',
    textDim: '#91a4bd',
    warning: '#ff8a5b',
  },
  fonts: {
    body: "'Rajdhani', 'Trebuchet MS', sans-serif",
    display: "'Orbitron', 'Rajdhani', sans-serif",
  },
  motion: {
    overlayMs: 180,
    pulseMs: 1600,
  },
  stroke: {
    main: 3,
  },
};
