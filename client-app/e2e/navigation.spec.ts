import { test, expect } from '@playwright/test';
import { setupTelegramEnv, completeOnboarding, clickTab } from './helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupTelegramEnv(page);
    await completeOnboarding(page);
  });

  test('tab bar is visible on home', async ({ page }) => {
    await expect(page.locator('text=Привет')).toBeVisible();
  });

  test('navigate to Games tab', async ({ page }) => {
    await clickTab(page, 'Игры');
    await expect(page.locator('text=Ближайшие игры')).toBeVisible();
  });

  test('navigate to Profile tab', async ({ page }) => {
    await clickTab(page, 'Профиль');
    await expect(page.locator('text=Редактировать профиль')).toBeVisible();
  });

  test('navigate to Leaderboard tab', async ({ page }) => {
    await clickTab(page, 'Рейтинг');
    await expect(page.locator('text=Таблица лидеров')).toBeVisible();
  });

  test('navigate to Rules from Home', async ({ page }) => {
    await page.click('button:has-text("Правила и роли")');
    await expect(page.locator('text=Нажми на роль')).toBeVisible();
  });
});
