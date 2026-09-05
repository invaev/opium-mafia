import { test, expect } from '@playwright/test';
import { setupTelegramEnv, clearStorage } from './helpers';

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupTelegramEnv(page);
    await page.goto('/');
    await clearStorage(page);
    await page.reload();
  });

  test('shows welcome screen for unauthenticated users', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page.locator('text=OPIUM').first()).toBeVisible();
    await expect(page.locator('button:has-text("Создать аккаунт")')).toBeVisible();
  });

  test('navigates from welcome to register', async ({ page }) => {
    await page.goto('/welcome');
    await page.click('button:has-text("Создать аккаунт")');
    await expect(page.locator('text=Создай профиль')).toBeVisible();
    await expect(page.locator('text=Шаг 1 из 2')).toBeVisible();
  });

  test('register form allows name and nickname input', async ({ page }) => {
    await page.goto('/register');
    const nameInput = page.locator('input').first();
    const nicknameInput = page.locator('input').nth(1);

    await nameInput.clear();
    await nameInput.fill('Тестовый Игрок');
    await expect(nameInput).toHaveValue('Тестовый Игрок');

    await nicknameInput.clear();
    await nicknameInput.fill('test_player');
    await expect(nicknameInput).toHaveValue('test_player');
  });

  test('completing registration navigates to home', async ({ page }) => {
    await page.goto('/register');
    const nameInput = page.locator('input').first();
    await nameInput.clear();
    await nameInput.fill('Тестовый Игрок');

    await page.click('button:has-text("Готово")');
    await expect(page.locator('text=Привет')).toBeVisible();
  });

  test('avatar picker shows emoji grid', async ({ page }) => {
    await page.goto('/avatar-picker');
    await page.waitForTimeout(500);
    if (await page.locator('text=OPIUM').first().isVisible().catch(() => false)) {
      await page.goto('/register');
      const nameInput = page.locator('input').first();
      await nameInput.fill('Test');
      await page.click('button:has-text("Готово")');
      await page.goto('/avatar-picker');
    }
    await expect(page.locator('text=Аватар').first()).toBeVisible();
  });

  test('avatar picker tabs work', async ({ page }) => {
    await page.goto('/register');
    const nameInput = page.locator('input').first();
    await nameInput.fill('Test');
    await page.click('button:has-text("Готово")');
    await page.goto('/avatar-picker');

    await page.click('button:has-text("Фото")');
    await expect(page.locator('text=Нажми чтобы загрузить')).toBeVisible();

    await page.click('button:has-text("Эмодзи")');
    await expect(page.locator('text=Выбери иконку')).toBeVisible();
  });

  test('full onboarding flow: welcome -> register -> home', async ({ page }) => {
    await page.goto('/welcome');

    await page.click('button:has-text("Создать аккаунт")');

    await expect(page.locator('text=Создай профиль')).toBeVisible();
    const nameInput = page.locator('input').first();
    await nameInput.clear();
    await nameInput.fill('Алексей');
    await page.click('button:has-text("Готово")');

    await expect(page.locator('text=Привет, Алексей')).toBeVisible();
  });
});
