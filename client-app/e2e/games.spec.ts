import { test, expect } from '@playwright/test';
import { setupTelegramEnv, completeOnboarding, clickTab } from './helpers';

test.describe('Games', () => {
  test.beforeEach(async ({ page }) => {
    await setupTelegramEnv(page);
    await completeOnboarding(page);
  });

  test('game list shows all games', async ({ page }) => {
    await clickTab(page, 'Игры');
    await expect(page.locator('text=Пятничная мафия')).toBeVisible();
    await expect(page.locator('text=Воскресный балаган')).toBeVisible();
    await expect(page.locator('text=Новички welcome')).toBeVisible();
    await expect(page.locator('text=Турнир Opium')).toBeVisible();
  });

  test('clicking a game shows game details', async ({ page }) => {
    await clickTab(page, 'Игры');
    await page.locator('text=Воскресный балаган').click();
    await expect(page.locator('text=Кофейня')).toBeVisible();
    await expect(page.locator('button:has-text("Записаться на игру")')).toBeVisible();
    await expect(page.locator('text=Участники')).toBeVisible();
  });

  test('join game flow works', async ({ page }) => {
    await clickTab(page, 'Игры');
    await page.locator('text=Воскресный балаган').click();

    await page.click('button:has-text("Записаться на игру")');
    await expect(page.locator('text=Со мной придут')).toBeVisible();

    await page.click('button:has-text("Подтвердить")');
    await expect(page.locator('div.text-success:has-text("Ты записан")')).toBeVisible();
  });

  test('leave game after joining', async ({ page }) => {
    await clickTab(page, 'Игры');
    await page.locator('text=Воскресный балаган').click();

    await page.click('button:has-text("Записаться на игру")');
    await page.click('button:has-text("Подтвердить")');
    await expect(page.locator('div.text-success')).toBeVisible();

    await page.click('button:has-text("Отменить")');
    await expect(page.locator('button:has-text("Записаться на игру")')).toBeVisible();
  });

  test('player profile is shown when clicking participant', async ({ page }) => {
    await clickTab(page, 'Игры');
    await page.locator('text=Пятничная мафия').click();

    await page.locator('text=@alex_mafia').click();
    await expect(page.locator('text=нажми на аватар')).toBeVisible();
  });
});
