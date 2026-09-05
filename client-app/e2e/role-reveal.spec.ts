import { test, expect } from '@playwright/test';
import { setupTelegramEnv, completeOnboarding } from './helpers';

test.describe('Role Reveal & Game End', () => {
  test.beforeEach(async ({ page }) => {
    await setupTelegramEnv(page);
    await completeOnboarding(page);
  });

  test('role reveal shows hidden card first', async ({ page }) => {
    await page.goto('/role-reveal');
    await expect(page.locator('text=Нажми чтобы увидеть роль')).toBeVisible();
    await expect(page.locator('text=Не показывай другим!')).toBeVisible();
  });

  test('clicking card reveals the role', async ({ page }) => {
    await page.goto('/role-reveal');
    await page.locator('text=Нажми чтобы увидеть роль').click();
    await expect(page.locator('text=КОМИССАР')).toBeVisible();
    await expect(page.locator('text=Ночью:')).toBeVisible();
    await expect(page.locator('text=Особенность:')).toBeVisible();
  });

  test('game end shows results', async ({ page }) => {
    await page.goto('/game-end');
    await expect(page.locator('text=МИРНЫЕ ПОБЕДИЛИ!')).toBeVisible();
    await expect(page.locator('text=ИТОГО')).toBeVisible();
    await expect(page.locator('text=Раскрытие ролей')).toBeVisible();
  });

  test('game end shows player seats', async ({ page }) => {
    await page.goto('/game-end');
    await expect(page.locator('text=№1').first()).toBeVisible();
    await expect(page.locator('text=№12')).toBeVisible();
  });

  test('active game card on home leads to role reveal', async ({ page }) => {
    await expect(page.locator('text=СЕЙЧАС ИДЁТ')).toBeVisible();
    await page.locator('text=СЕЙЧАС ИДЁТ').click();
    await expect(page.locator('text=Нажми чтобы увидеть роль')).toBeVisible();
  });
});
