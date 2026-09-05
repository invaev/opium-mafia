export const theme = {
  bg: {
    primary: '#0D0D12',
    secondary: '#111118',
    tertiary: '#0A0A10',
    card: 'rgba(255,255,255,0.03)',
    cardHover: 'rgba(255,255,255,0.06)',
    elevated: 'linear-gradient(135deg,#1A1A28,#151520)',
  },

  border: {
    subtle: 'rgba(255,255,255,0.04)',
    default: 'rgba(255,255,255,0.06)',
    medium: 'rgba(255,255,255,0.08)',
    strong: 'rgba(255,255,255,0.12)',
  },

  text: {
    primary: '#E8E8F0',
    secondary: '#C0C0D0',
    muted: '#8888A0',
    dim: '#5A5A70',
    dark: '#3A3A4A',
    dead: '#4A4A5A',
  },

  team: {
    peaceful: '#3B82F6',
    mafia: '#EF4444',
  },

  role: {
    don: '#991B1B',
    mafia: '#EF4444',
    framer: '#EA580C',
    enforcer: '#7F1D1D',
    sheriff: '#3B82F6',
    doctor: '#22C55E',
    hooker: '#EC4899',
    maniac: '#F97316',
    bodyguard: '#D97706',
    seer: '#06B6D4',
    werewolf: '#8B5CF6',
    civilian: '#64748B',
  },

  accent: {
    orange: '#F59E0B',
    purple: '#A78BFA',
    indigo: '#6366F1',
    red: '#EF4444',
    green: '#22C55E',
    blue: '#60A5FA',
    pink: '#EC4899',
    cyan: '#06B6D4',
  },

  gradient: {
    mafia: 'linear-gradient(135deg,#EF4444,#DC2626)',
    peaceful: 'linear-gradient(135deg,#3B82F6,#2563EB)',
    indigo: 'linear-gradient(135deg,#6366F1,#4338CA)',
    green: 'linear-gradient(135deg,#22C55E,#16A34A)',
    orange: 'linear-gradient(135deg,#F59E0B,#D97706)',
    omLogo: 'linear-gradient(135deg,#FF4444,#FF8844)',
    sidebar: 'linear-gradient(180deg,#111118,#0A0A10)',
  },

  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
    full: 999,
  },

  font: "'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif",

  shadow: {
    popup: '0 12px 40px rgba(0,0,0,0.7)',
    card: '0 4px 16px rgba(0,0,0,0.3)',
    glow: (color: string) => `0 0 20px ${color}50`,
    glowSm: (color: string) => `0 0 12px ${color}30`,
  },
} as const;

export const ADMIN_NAV = [
  { id: 'dashboard' as const, icon: '\u{1F3E0}', label: '\u0414\u0430\u0448\u0431\u043E\u0440\u0434' },
  { id: 'gameSetup' as const, icon: '\u2795', label: '\u041D\u043E\u0432\u0430\u044F \u0438\u0433\u0440\u0430' },
  { id: 'players' as const, icon: '\u{1F465}', label: '\u0418\u0433\u0440\u043E\u043A\u0438' },
  { id: 'stats' as const, icon: '\u{1F4CA}', label: '\u0421\u0442\u0430\u0442' },
  { id: 'settings' as const, icon: '\u2699\uFE0F', label: '\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438' },
];

export const GAME_NAV = [
  { id: 'lobby' as const, icon: '\u{1FA91}', label: '\u041B\u043E\u0431\u0431\u0438' },
  { id: 'night0' as const, icon: '\u{1F91D}', label: '\u041D\u043E\u0447\u044C 0' },
  { id: 'nightPhase' as const, icon: '\u{1F319}', label: '\u041D\u043E\u0447\u044C' },
  { id: 'dayAnnounce' as const, icon: '\u{1F4E2}', label: '\u041E\u0431\u044A\u044F\u0432\u043B.' },
  { id: 'dayOpium' as const, icon: '\u{1F525}', label: 'Opium' },
  { id: 'dayDefense' as const, icon: '\u{1F6E1}\uFE0F', label: '\u0417\u0430\u0449\u0438\u0442\u0430' },
  { id: 'voting' as const, icon: '\u{1F5F3}\uFE0F', label: '\u0413\u043E\u043B\u043E\u0441.' },
  { id: 'lastWord' as const, icon: '\u{1F4AC}', label: '\u041F\u043E\u0441\u043B.\u0441\u043B.' },
  { id: 'gameEnd' as const, icon: '\u{1F3C1}', label: '\u0424\u0438\u043D\u0430\u043B' },
];

export type ScreenId =
  | 'dashboard' | 'gameSetup' | 'gameDetails' | 'players' | 'stats' | 'settings'
  | 'lobby' | 'night0' | 'nightPhase' | 'dayAnnounce' | 'dayOpium'
  | 'dayDefense' | 'voting' | 'lastWord' | 'gameEnd';
