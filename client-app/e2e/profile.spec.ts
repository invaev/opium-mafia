import { test, expect } from '@playwright/test';
import { setupTelegramEnv, completeOnboarding, clickTab } from './helpers';

test.describe('Profile', () => {
  test.beforeEach(async ({ page }) => {
    await setupTelegramEnv(page);
    await completeOnboarding(page);
  });

  test('profile shows user stats', async ({ page }) => {
    await clickTab(page, 'Профиль');
    await expect(page.locator('text=Игр сыграно')).toBeVisible();
    await expect(page.locator('text=Лучшие роли')).toBeVisible();
  });

  test('edit profile and save changes', async ({ page }) => {
    await clickTab(page, 'Профиль');
    await page.click('text=Редактировать профиль');
    await expect(page.locator('text=Редактировать').first()).toBeVisible();

    const nameInput = page.locator('input').first();
    await nameInput.clear();
    await nameInput.fill('Новое Имя');

    await page.click('button:has-text("Сохранить изменения")');
    await expect(page.locator('text=Сохранено')).toBeVisible();
  });

  test('view game history', async ({ page }) => {
    await clickTab(page, 'Профиль');
    await page.click('button:has-text("История игр")');
    await expect(page.locator('text=Комиссар').first()).toBeVisible();
  });

  test('leaderboard filters change data', async ({ page }) => {
    await clickTab(page, 'Рейтинг');
    await expect(page.locator('text=Таблица лидеров')).toBeVisible();
    await expect(page.locator('text=Дмитрий').first()).toBeVisible();

    await page.click('button:has-text("Неделя")');
    await expect(page.locator('text=Алексей (ты)').first()).toBeVisible();
  });
});
