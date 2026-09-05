import { Page } from '@playwright/test';

export async function setupTelegramEnv(page: Page) {
  await page.addInitScript(() => {
    (window as any).Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A12345678%2C%22first_name%22%3A%22Test%22%2C%22last_name%22%3A%22User%22%2C%22username%22%3A%22testuser%22%2C%22language_code%22%3A%22ru%22%7D&auth_date=1709640000&hash=mock_hash',
        initDataUnsafe: {
          user: {
            id: 12345678,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser',
            language_code: 'ru',
          },
        },
        version: '7.0',
        platform: 'tdesktop',
        colorScheme: 'dark',
        themeParams: {
          bg_color: '#0D0D12',
          text_color: '#E8E8F0',
          hint_color: '#8888A0',
          link_color: '#60A5FA',
          button_color: '#EF4444',
          button_text_color: '#FFFFFF',
        },
        isExpanded: true,
        viewportHeight: 800,
        viewportStableHeight: 800,
        ready: () => {},
        expand: () => {},
        close: () => {},
        MainButton: {
          text: '', isVisible: false, isActive: true,
          setText: function() {}, show: function() { this.isVisible = true; },
          hide: function() { this.isVisible = false; },
          onClick: () => {}, offClick: () => {},
          enable: function() {}, disable: function() {},
          showProgress: function() {}, hideProgress: function() {},
          setParams: function() {},
        },
        BackButton: {
          isVisible: false,
          show: function() { this.isVisible = true; },
          hide: function() { this.isVisible = false; },
          onClick: () => {}, offClick: () => {},
        },
        HapticFeedback: {
          impactOccurred: () => {},
          notificationOccurred: () => {},
          selectionChanged: () => {},
        },
        setHeaderColor: () => {},
        setBackgroundColor: () => {},
        setBottomBarColor: () => {},
        onEvent: () => {},
        offEvent: () => {},
        sendData: () => {},
        isVersionAtLeast: () => true,
      },
    };
  });
}

export async function clickTab(page: Page, label: string) {
  await page.locator(`span.text-\\[10px\\]:has-text("${label}")`).click();
}

export async function completeOnboarding(page: Page) {
  await page.goto('/welcome');
  await page.click('button:has-text("Создать аккаунт")');
  await page.waitForSelector('text=Создай профиль');
  const nameInput = page.locator('input').first();
  const value = await nameInput.inputValue();
  if (!value) {
    await nameInput.fill('Тестовый');
  }
  await page.click('button:has-text("Готово")');
  await page.waitForSelector('text=Привет');
}

export async function clearStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
  });
}
