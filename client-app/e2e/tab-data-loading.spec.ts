import { test, expect, Page } from '@playwright/test';
import { setupTelegramEnv } from './helpers';

const MOCK_AUTH_RESPONSE = {
  token: 'mock-jwt-token',
  isNewUser: false,
  registered: true,
  user: {
    id: 42,
    telegramId: 12345678,
    username: 'testuser',
    displayName: 'Test User',
    avatarUrl: null,
    avatarEmoji: null,
    avatarColorIndex: 0,
    instagramUsername: null,
    dateOfBirth: null,
    gender: null,
    bio: null,
    totalRating: 1200,
    gamesPlayed: 5,
    gamesWon: 3,
  },
};

const MOCK_GAMES = [
  {
    id: 1,
    title: 'Friday Night Mafia',
    date: '28.03.2026',
    time: '19:00',
    place: 'Coffee House',
    placeUrl: null,
    price: '50 PLN',
    spots: 10,
    taken: 3,
    rated: true,
    status: 'lobby',
    host: { name: 'GM Alex', nick: 'alex_gm' },
    players: [
      { name: 'Alice', nick: 'alice', userId: 100, guests: 0, avatarEmoji: null, avatarColorIndex: 0, avatarUrl: null, games: 2, winRate: '50%', rating: 1100, insta: '', bio: '' },
      { name: 'Bob', nick: 'bob', userId: 101, guests: 1, avatarEmoji: null, avatarColorIndex: 1, avatarUrl: null, games: 4, winRate: '75%', rating: 1300, insta: '', bio: '' },
    ],
  },
  {
    id: 2,
    title: 'Sunday Special',
    date: '30.03.2026',
    time: '15:00',
    place: 'Game Club',
    placeUrl: null,
    price: '40 PLN',
    spots: 12,
    taken: 1,
    rated: false,
    status: 'lobby',
    host: { name: 'GM Maria', nick: 'maria_gm' },
    players: [
      { name: 'Charlie', nick: 'charlie', userId: 102, guests: 0, avatarEmoji: null, avatarColorIndex: 2, avatarUrl: null, games: 1, winRate: '0%', rating: 1000, insta: '', bio: '' },
    ],
  },
];

const MOCK_PROFILE = {
  id: 42,
  displayName: 'Test User',
  username: 'testuser',
  bio: 'Mafia enthusiast',
  instagramUsername: 'test_insta',
  dateOfBirth: '15.06.1995',
  gender: 'male',
  avatarUrl: null,
  avatarEmoji: null,
  avatarColorIndex: 0,
  totalRating: 1200,
  gamesPlayed: 5,
  gamesWon: 3,
  winRate: 60,
  avgPointsPerGame: 2.5,
  bestGameRating: 8,
  totalFouls: 1,
};

const MOCK_LEADERBOARD = [
  { displayName: 'Top Player', rating: 1500, gamesPlayed: 20, winRate: 70, avatarUrl: null, isMe: false },
  { displayName: 'Test User', rating: 1200, gamesPlayed: 5, winRate: 60, avatarUrl: null, isMe: true },
  { displayName: 'New Player', rating: 1000, gamesPlayed: 2, winRate: 50, avatarUrl: null, isMe: false },
];

const MOCK_HISTORY = {
  games: [
    {
      id: 10,
      status: 'finished',
      title: 'Past Game',
      date: '20.03.2026',
      winner: 'peaceful',
      myRole: 'sheriff',
      myTeam: 'peaceful',
      ratingChange: 5,
      players: [],
    },
  ],
  total: 1,
};

async function setupApiMocks(page: Page) {
  const API = 'https://opium-server-production.up.railway.app';

  await page.route(`${API}/auth/telegram`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_AUTH_RESPONSE) })
  );

  await page.route(`${API}/games`, (route, request) => {
    if (request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_GAMES) });
    }
    return route.continue();
  });

  await page.route(`${API}/games/*/join`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  );

  await page.route(`${API}/games/*/leave`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  );

  await page.route(`${API}/games/*/my-role`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assigned: false }) })
  );

  await page.route(`${API}/users/me`, (route, request) => {
    if (request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROFILE) });
    }
    if (request.method() === 'PATCH') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    }
    return route.continue();
  });

  await page.route(`${API}/users/me/games*`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_HISTORY) })
  );

  await page.route(`${API}/users/leaderboard*`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_LEADERBOARD) })
  );
}

async function clickTab(page: Page, label: string) {
  await page.locator(`span.text-\\[10px\\]:has-text("${label}")`).click();
}

async function setupAuthenticatedApp(page: Page) {
  await setupTelegramEnv(page);
  await setupApiMocks(page);

  await page.addInitScript(() => {
    const authState = {
      state: {
        isAuthenticated: true,
        isRegistered: true,
        isBanned: false,
        banReason: null,
        token: 'mock-jwt-token',
        telegramUser: {
          id: 12345678,
          firstName: 'Test',
          lastName: 'User',
          username: 'testuser',
        },
      },
      version: 0,
    };
    const userState = {
      state: {
        profile: {
          id: 42,
          name: 'Test User',
          nickname: 'testuser',
          bio: 'Mafia enthusiast',
          telegramUsername: '@testuser',
          instagramUsername: 'test_insta',
          dateOfBirth: '15.06.1995',
          gender: 'male',
          avatar: { type: 'emoji', emoji: '😎', colorIndex: 0 },
          rating: 1200,
          stats: { gamesPlayed: 5, winRate: '60%', avgPoints: '2.5', bestPoints: '8', totalFouls: 1 },
          topRoles: [],
          ratingHistory: [],
        },
      },
      version: 0,
    };
    localStorage.setItem('opium-auth-v2', JSON.stringify(authState));
    localStorage.setItem('opium-user', JSON.stringify(userState));
  });
}

test.describe('Tab Data Loading - Games tab loads independently', () => {
  test('games tab shows games when navigated to directly (without visiting Home first)', async ({ page }) => {
    await setupAuthenticatedApp(page);

    await page.goto('/games');

    await expect(page.locator('text=Friday Night Mafia')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Sunday Special')).toBeVisible();
  });

  test('games tab shows game details (location, price)', async ({ page }) => {
    await setupAuthenticatedApp(page);
    await page.goto('/games');

    await expect(page.locator('text=Coffee House')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=50 PLN')).toBeVisible();
    await expect(page.locator('text=Game Club')).toBeVisible();
  });

  test('games tab shows spots left', async ({ page }) => {
    await setupAuthenticatedApp(page);
    await page.goto('/games');

    await expect(page.locator('text=Friday Night Mafia')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=7 мест')).toBeVisible();
    await expect(page.locator('text=11 мест')).toBeVisible();
  });

  test('clicking a game navigates to game details', async ({ page }) => {
    await setupAuthenticatedApp(page);
    await page.goto('/games');

    await expect(page.locator('text=Friday Night Mafia')).toBeVisible({ timeout: 5000 });
    await page.locator('text=Friday Night Mafia').click();
    await expect(page).toHaveURL(/\/game\/1/, { timeout: 5000 });
  });
});

test.describe('Tab Data Loading - Home tab', () => {
  test('home shows greeting and next game', async ({ page }) => {
    await setupAuthenticatedApp(page);
    await page.goto('/');

    await expect(page.locator('text=Привет, Test User')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Friday Night Mafia')).toBeVisible();
  });

  test('home shows game details in next game card', async ({ page }) => {
    await setupAuthenticatedApp(page);
    await page.goto('/');

    await expect(page.locator('text=БЛИЖАЙШАЯ ИГРА')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Coffee House')).toBeVisible();
  });
});

test.describe('Tab Data Loading - Profile tab', () => {
  test('profile loads user data independently', async ({ page }) => {
    await setupAuthenticatedApp(page);

    await page.goto('/profile');

    await expect(page.locator('text=Test User')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Игр сыграно')).toBeVisible();
  });

  test('profile shows stats from server', async ({ page }) => {
    await setupAuthenticatedApp(page);
    await page.goto('/profile');

    await expect(page.locator('text=Игр сыграно')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=1200')).toBeVisible();
  });
});

test.describe('Tab Data Loading - Leaderboard tab', () => {
  test('leaderboard loads data independently', async ({ page }) => {
    await setupAuthenticatedApp(page);

    await page.goto('/leaderboard');

    await expect(page.locator('text=Таблица лидеров')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Top Player')).toBeVisible();
    await expect(page.locator('text=Test User')).toBeVisible();
  });

  test('leaderboard filter changes data', async ({ page }) => {
    await setupAuthenticatedApp(page);
    await page.goto('/leaderboard');

    await expect(page.locator('text=Таблица лидеров')).toBeVisible({ timeout: 5000 });

    await page.click('button:has-text("Неделя")');

    await expect(page.locator('text=Top Player')).toBeVisible();
  });
});

test.describe('Tab Navigation - switching between all tabs', () => {
  test('can switch between all tabs and each shows correct content', async ({ page }) => {
    await setupAuthenticatedApp(page);
    await page.goto('/');

    await expect(page.locator('text=Привет, Test User')).toBeVisible({ timeout: 5000 });

    await clickTab(page, 'Игры');
    await expect(page.locator('text=Ближайшие игры')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Friday Night Mafia')).toBeVisible();

    await clickTab(page, 'Профиль');
    await expect(page.locator('text=Игр сыграно')).toBeVisible({ timeout: 5000 });

    await clickTab(page, 'Рейтинг');
    await expect(page.locator('text=Таблица лидеров')).toBeVisible({ timeout: 5000 });

    await clickTab(page, 'Главная');
    await expect(page.locator('text=Привет, Test User')).toBeVisible({ timeout: 5000 });
  });

  test('games tab shows data when visited after leaderboard (not just after home)', async ({ page }) => {
    await setupAuthenticatedApp(page);

    await page.goto('/leaderboard');
    await expect(page.locator('text=Таблица лидеров')).toBeVisible({ timeout: 5000 });

    await clickTab(page, 'Игры');
    await expect(page.locator('text=Friday Night Mafia')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Sunday Special')).toBeVisible();
  });

  test('games tab shows data when visited after profile (not just after home)', async ({ page }) => {
    await setupAuthenticatedApp(page);

    await page.goto('/profile');
    await expect(page.locator('text=Игр сыграно')).toBeVisible({ timeout: 5000 });

    await clickTab(page, 'Игры');
    await expect(page.locator('text=Friday Night Mafia')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Game Details - direct navigation', () => {
  test('game details loads when navigated to directly', async ({ page }) => {
    await setupAuthenticatedApp(page);

    await page.goto('/game/1');

    await expect(page.locator('text=Friday Night Mafia')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Участники')).toBeVisible();
  });

  test('game details shows join button for non-joined user', async ({ page }) => {
    await setupAuthenticatedApp(page);
    await page.goto('/game/1');

    await expect(page.locator('button:has-text("Записаться на игру")')).toBeVisible({ timeout: 5000 });
  });
});
