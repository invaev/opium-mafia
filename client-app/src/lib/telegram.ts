import {
  init,
  backButton,
  mainButton,
  initData,
  hapticFeedback,
  mountBackButton,
  mountMainButton,
  mountMiniApp,
  mountThemeParams,
  mountViewport,
  miniAppReady,
  expandViewport,
  bindMiniAppCssVars,
  bindThemeParamsCssVars,
  bindViewportCssVars,
  setMiniAppHeaderColor,
  setMiniAppBackgroundColor,
  restoreInitData,
  isTMA,
  mockTelegramEnv,
  type User,
} from '@telegram-apps/sdk-react';

let _isTelegram = false;

function detectTelegramEnvironment(): boolean {
  try {
    if (isTMA('simple')) return true;
  } catch {}

  try {
    const tg = (window as unknown as Record<string, unknown>).Telegram as
      | { WebApp?: { initData?: string } }
      | undefined;
    if (tg?.WebApp?.initData) return true;
  } catch {}

  if (window.location.hash.includes('tgWebAppData')) return true;

  return false;
}

export function initTelegramSDK(): boolean {
  try {
    if (detectTelegramEnvironment()) {
      _isTelegram = true;
      init();

      try { mountBackButton(); } catch {}
      try { mountMainButton(); } catch {}
      try { mountMiniApp(); } catch {}
      try { mountThemeParams(); } catch {}
      try { mountViewport(); } catch {}

      try { bindMiniAppCssVars(); } catch {}
      try { bindThemeParamsCssVars(); } catch {}
      try { bindViewportCssVars(); } catch {}

      try { miniAppReady(); } catch {}
      try { expandViewport(); } catch {}

      try { setMiniAppHeaderColor('#0D0D12'); } catch {}
      try { setMiniAppBackgroundColor('#0D0D12'); } catch {}

      try { restoreInitData(); } catch {}

      return true;
    } else {
      _isTelegram = false;
      if (import.meta.env.DEV) {
        setupMockEnvironment();
      }
      return false;
    }
  } catch {
    _isTelegram = false;
    if (import.meta.env.DEV) {
      setupMockEnvironment();
    }
    return false;
  }
}

function getDevUser() {
  const n = Math.max(1, parseInt(new URLSearchParams(window.location.search).get('dev') || '1', 10) || 1);
  return {
    id: 90000000 + n,
    first_name: 'Dev',
    last_name: `Tester ${n}`,
    username: `dev_user_${n}`,
    language_code: 'ru',
  };
}

function setupMockEnvironment() {
  try {
    const params = new URLSearchParams([
      ['tgWebAppVersion', '7.0'],
      ['tgWebAppPlatform', 'tdesktop'],
      ['tgWebAppThemeParams', JSON.stringify({
        bg_color: '#0D0D12',
        text_color: '#E8E8F0',
        hint_color: '#8888A0',
        link_color: '#60A5FA',
        button_color: '#EF4444',
        button_text_color: '#FFFFFF',
        secondary_bg_color: '#111118',
        header_bg_color: '#0D0D12',
        accent_text_color: '#F59E0B',
        section_bg_color: '#111118',
        section_header_text_color: '#8888A0',
        subtitle_text_color: '#6A6A80',
        destructive_text_color: '#EF4444',
      })],
      ['tgWebAppData', new URLSearchParams([
        ['user', JSON.stringify(getDevUser())],
        ['auth_date', String(Math.floor(Date.now() / 1000))],
        ['hash', 'mock_hash_for_dev'],
      ]).toString()],
    ]);

    mockTelegramEnv(`?${params.toString()}`);

    init();
    try { restoreInitData(); } catch {}
  } catch {
  }
}

export function isTelegramApp(): boolean {
  if (_isTelegram) return true;
  try {
    return !!(window as any).Telegram?.WebApp?.initData;
  } catch {}
  return false;
}

export function getTelegramUser(): User | undefined {
  try {
    const user = initData.user();
    if (user) return user;
  } catch {}

  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      const u = tg.initDataUnsafe.user;
      return {
        id: u.id,
        firstName: u.first_name || '',
        lastName: u.last_name,
        username: u.username,
        photoUrl: u.photo_url,
        languageCode: u.language_code,
        isPremium: u.is_premium,
      } as User;
    }
  } catch {}

  return undefined;
}

export function getInitDataRaw(): string | undefined {
  try {
    const raw = initData.raw();
    if (raw) return raw;
  } catch {}

  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initData) return tg.initData;
  } catch {}

  try {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const tgWebAppData = params.get('tgWebAppData');
    if (tgWebAppData) return tgWebAppData;
  } catch {}

  if (import.meta.env.DEV) {
    const mockParams = new URLSearchParams([
      ['user', JSON.stringify(getDevUser())],
      ['auth_date', String(Math.floor(Date.now() / 1000))],
      ['hash', 'mock_hash_for_dev'],
    ]);
    return mockParams.toString();
  }

  return undefined;
}

export function getTelegramPlatform(): string | undefined {
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.platform) return tg.platform;
  } catch {}

  try {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const platform = params.get('tgWebAppPlatform');
    if (platform) return platform;
  } catch {}

  return undefined;
}

export {
  backButton,
  mainButton,
  initData,
  hapticFeedback,
};
