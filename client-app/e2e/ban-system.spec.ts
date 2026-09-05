import { test, expect } from '@playwright/test';
import { generateInitData, createTestUser, TestApiClient } from './api-helpers';

test.afterAll(async ({ request }) => {
  const gm = new TestApiClient(request);
  await gm.authenticateIpad(800000001, 'Cleanup GM');
  await gm.testCleanup();
});

async function createRegisteredUser(request: any, suffix: string) {
  const api = new TestApiClient(request);
  const user = createTestUser(suffix);
  const auth = await api.authenticate(generateInitData(user));
  await api.completeRegistration();
  return { api, user, userId: auth.user.id as number };
}

async function joinGameWithRetry(api: TestApiClient, gameId: number, seat: number, name: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const result = await api.joinGame(gameId, seat, name);
    if (result.status !== 500) return result;
    await new Promise((r) => setTimeout(r, 300 * (i + 1)));
  }
  return api.joinGame(gameId, seat, name);
}

async function createGM(request: any) {
  const gm = new TestApiClient(request);
  const gmTelegramId = 900000000 + Math.floor(Math.random() * 99999999);
  await gm.authenticateIpad(gmTelegramId, 'BanTest GM');
  return gm;
}

test.describe('Global Ban — iPad GM Actions', () => {
  test('ban user with reason', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'BanReason');

    const ban = await gm.banUser(userId, 'Cheating in game #42');
    expect(ban.status).toBe(200);
    expect(ban.body.success).toBe(true);

    const users = await gm.listUsers();
    const banned = users.body.find((u: any) => u.id === userId);
    expect(banned).toBeTruthy();
    expect(banned.banned).toBe(true);
    expect(banned.banReason).toBe('Cheating in game #42');

    await gm.unbanUser(userId);
    await playerApi.deleteAccount();
  });

  test('ban user without reason', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'BanNoReason');

    const ban = await gm.banUser(userId);
    expect(ban.status).toBe(200);

    const users = await gm.listUsers();
    const banned = users.body.find((u: any) => u.id === userId);
    expect(banned.banned).toBe(true);
    expect(banned.banReason).toBeNull();

    await gm.unbanUser(userId);
    await playerApi.deleteAccount();
  });

  test('cannot ban already-banned user', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'DoubleBan');

    await gm.banUser(userId, 'First ban');
    const secondBan = await gm.banUser(userId, 'Second ban');
    expect(secondBan.status).toBe(400);
    expect(secondBan.body.error).toContain('already banned');

    await gm.unbanUser(userId);
    await playerApi.deleteAccount();
  });

  test('cannot ban non-existent user', async ({ request }) => {
    const gm = await createGM(request);
    const ban = await gm.banUser(999999999);
    expect(ban.status).toBe(404);
    expect(ban.body.error).toContain('not found');
  });

  test('cannot ban with invalid user ID', async ({ request }) => {
    const gm = await createGM(request);
    const res = await request.post('https://opium-server-production.up.railway.app/users/abc/ban', {
      data: { reason: 'test' },
      headers: { Authorization: `Bearer ${gm.token}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(400);
  });

  test('non-iPad user cannot ban', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'BanForbid');
    const { api: otherPlayer } = await createRegisteredUser(request, 'BanForbid2');

    const ban = await otherPlayer.banUser(userId);
    expect(ban.status).toBe(403);
    expect(ban.body.error).toContain('iPad only');

    await playerApi.deleteAccount();
    await otherPlayer.deleteAccount();
  });
});

test.describe('Unban Flow', () => {
  test('unban a banned user', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'Unban');

    await gm.banUser(userId, 'Temporary ban');
    const unban = await gm.unbanUser(userId);
    expect(unban.status).toBe(200);
    expect(unban.body.success).toBe(true);

    const users = await gm.listUsers();
    const user = users.body.find((u: any) => u.id === userId);
    expect(user.banned).toBe(false);
    expect(user.banReason).toBeNull();

    await playerApi.deleteAccount();
  });

  test('cannot unban a non-banned user', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'UnbanClean');

    const unban = await gm.unbanUser(userId);
    expect(unban.status).toBe(400);
    expect(unban.body.error).toContain('not banned');

    await playerApi.deleteAccount();
  });

  test('non-iPad user cannot unban', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'UnbanForbid');
    const { api: regularPlayer } = await createRegisteredUser(request, 'UnbanForbid2');

    await gm.banUser(userId);
    const unban = await regularPlayer.unbanUser(userId);
    expect(unban.status).toBe(403);

    await gm.unbanUser(userId);
    await playerApi.deleteAccount();
    await regularPlayer.deleteAccount();
  });
});

test.describe('Auth Blocking for Banned Users', () => {
  test('banned user gets 403 with ban reason on auth', async ({ request }) => {
    const gm = await createGM(request);
    const user = createTestUser('AuthBlock');
    const playerApi = new TestApiClient(request);

    await playerApi.authenticate(generateInitData(user));
    await playerApi.completeRegistration();
    const userId = playerApi.userId!;

    await gm.banUser(userId, 'Bad behavior');

    const authResult = await playerApi.authenticateRaw(generateInitData(user));
    expect(authResult.status).toBe(403);
    expect(authResult.body.banned).toBe(true);
    expect(authResult.body.banReason).toBe('Bad behavior');
    expect(authResult.body.error).toContain('banned');

    await gm.unbanUser(userId);
    await playerApi.authenticate(generateInitData(user));
    await playerApi.deleteAccount();
  });

  test('unbanned user can auth again normally', async ({ request }) => {
    const gm = await createGM(request);
    const user = createTestUser('AuthUnban');
    const playerApi = new TestApiClient(request);

    await playerApi.authenticate(generateInitData(user));
    await playerApi.completeRegistration();
    const userId = playerApi.userId!;

    await gm.banUser(userId, 'Temp');
    await gm.unbanUser(userId);

    const auth = await playerApi.authenticate(generateInitData(user));
    expect(auth.registered).toBe(true);
    expect(auth.token).toBeTruthy();

    const profile = await playerApi.getProfile();
    expect(profile.status).toBe(200);

    await playerApi.deleteAccount();
  });

  test('banned user auth returns no token', async ({ request }) => {
    const gm = await createGM(request);
    const user = createTestUser('AuthNoToken');
    const playerApi = new TestApiClient(request);

    await playerApi.authenticate(generateInitData(user));
    await playerApi.completeRegistration();
    const userId = playerApi.userId!;

    await gm.banUser(userId);

    const authResult = await playerApi.authenticateRaw(generateInitData(user));
    expect(authResult.status).toBe(403);
    expect(authResult.body.token).toBeUndefined();

    await gm.unbanUser(userId);
    await playerApi.authenticate(generateInitData(user));
    await playerApi.deleteAccount();
  });
});

test.describe('Profile Restrictions for Banned Users', () => {
  test('banned user cannot update profile', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'ProfileBlock');

    const tokenBefore = playerApi.token;

    await gm.banUser(userId, 'Profile test');

    const update = await playerApi.updateProfile({ displayName: 'Hacked Name' });
    expect(update.status).toBe(403);
    expect(update.body.error).toContain('banned');

    await gm.unbanUser(userId);
    await playerApi.deleteAccount();
  });

  test('banned user cannot delete account', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'DeleteBlock');

    await gm.banUser(userId, 'Delete test');

    const del = await playerApi.deleteAccount();
    expect(del.status).toBe(403);
    expect(del.body.error.toLowerCase()).toContain('banned');

    await gm.unbanUser(userId);
    await playerApi.deleteAccount();
  });

  test('banned user CAN still read profile (valid token)', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'ProfileRead');

    await gm.banUser(userId);

    const profile = await playerApi.getProfile();
    expect(profile.status).toBe(200);
    expect(profile.body.displayName).toBeTruthy();

    await gm.unbanUser(userId);
    await playerApi.deleteAccount();
  });

  test('after unban, profile update works again', async ({ request }) => {
    const gm = await createGM(request);
    const user = createTestUser('ProfileRestore');
    const playerApi = new TestApiClient(request);

    await playerApi.authenticate(generateInitData(user));
    await playerApi.completeRegistration();
    const userId = playerApi.userId!;

    await gm.banUser(userId);

    const blocked = await playerApi.updateProfile({ bio: 'Should fail' });
    expect(blocked.status).toBe(403);

    await gm.unbanUser(userId);

    await playerApi.authenticate(generateInitData(user));

    const update = await playerApi.updateProfile({ bio: 'I am back!' });
    expect(update.status).toBe(200);
    expect(update.body.bio).toBe('I am back!');

    await playerApi.deleteAccount();
  });
});

test.describe('Game Restrictions for Banned Users', () => {
  test('banned user cannot join games', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'JoinBlock');

    const game = await gm.createGame({
      name: 'Ban Join Test',
      date: '25/12/2026',
      location: 'Test Location',
      maxPlayers: 10,
      isRanked: false,
    });
    expect(game.status).toBe(201);
    const gameId = game.body.id;

    await gm.banUser(userId, 'Join test');

    const join = await playerApi.joinGame(gameId, 1, 'BannedPlayer');
    expect(join.status).toBe(403);
    expect(join.body.error).toContain('banned');

    await gm.unbanUser(userId);
    await gm.deleteGame(gameId);
    await playerApi.deleteAccount();
  });

  test('banned user sees empty game list', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'GameList');

    const game = await gm.createGame({
      name: 'Ban List Test',
      date: '25/12/2026',
      location: 'Test',
      maxPlayers: 10,
      isRanked: false,
    });
    const gameId = game.body.id;

    await gm.banUser(userId);

    const games = await playerApi.getGames();
    expect(games.status).toBe(200);
    expect(games.body).toEqual([]);

    await gm.unbanUser(userId);
    await gm.deleteGame(gameId);
    await playerApi.deleteAccount();
  });

  test('banned user excluded from leaderboard', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'Leaderboard');

    await gm.banUser(userId);

    const lb = await playerApi.getLeaderboard();
    expect(lb.status).toBe(200);
    const found = lb.body.find((u: any) => u.id === userId);
    expect(found).toBeUndefined();

    await gm.unbanUser(userId);
    await playerApi.deleteAccount();
  });

  test('after unban, user can join games again', async ({ request }) => {
    const gm = await createGM(request);
    const user = createTestUser('JoinRestore');
    const playerApi = new TestApiClient(request);

    await playerApi.authenticate(generateInitData(user));
    await playerApi.completeRegistration();
    const userId = playerApi.userId!;

    const game = await gm.createGame({
      name: 'Ban Restore Join Test',
      date: '25/12/2026',
      location: 'Test',
      maxPlayers: 10,
      isRanked: false,
    });
    const gameId = game.body.id;

    await gm.banUser(userId);
    const blocked = await playerApi.joinGame(gameId, 1, 'Blocked');
    expect(blocked.status).toBe(403);

    await gm.unbanUser(userId);
    const join = await joinGameWithRetry(playerApi, gameId, 1, user.first_name);
    expect([200, 201]).toContain(join.status);

    await gm.deleteGame(gameId);
    await playerApi.deleteAccount();
  });
});

test.describe('iPad User List — Ban Visibility', () => {
  test('banned users show banned=true with reason in user list', async ({ request }) => {
    const gm = await createGM(request);
    const { api: p1, userId: uid1 } = await createRegisteredUser(request, 'ListBan1');
    const { api: p2, userId: uid2 } = await createRegisteredUser(request, 'ListBan2');

    await gm.banUser(uid1, 'Reason A');

    const users = await gm.listUsers();
    expect(users.status).toBe(200);

    const u1 = users.body.find((u: any) => u.id === uid1);
    const u2 = users.body.find((u: any) => u.id === uid2);

    expect(u1.banned).toBe(true);
    expect(u1.banReason).toBe('Reason A');
    expect(u2.banned).toBe(false);
    expect(u2.banReason).toBeNull();

    await gm.unbanUser(uid1);
    await p1.deleteAccount();
    await p2.deleteAccount();
  });
});

test.describe('Game-Level Ban (remove + ban from game)', () => {
  test('removed+banned player cannot rejoin that game', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'GameBan');

    const game = await gm.createGame({
      name: 'Game-Level Ban Test',
      date: '25/12/2026',
      location: 'Test',
      maxPlayers: 10,
      isRanked: false,
    });
    const gameId = game.body.id;

    const join = await joinGameWithRetry(playerApi, gameId, 1, 'GameBanPlayer');
    expect([200, 201]).toContain(join.status);

    const remove = await gm.removePlayer(gameId, userId, true);
    expect(remove.status).toBe(200);

    const rejoin = await playerApi.joinGame(gameId, 1, 'GameBanPlayer');
    expect(rejoin.status).toBe(403);
    expect(rejoin.body.error).toContain('banned');

    await gm.deleteGame(gameId);
    await playerApi.deleteAccount();
  });

  test('game-ban does not affect other games', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'GameBanOther');

    const game1 = await gm.createGame({
      name: 'Game Ban Test 1',
      date: '25/12/2026',
      location: 'Test',
      maxPlayers: 10,
      isRanked: false,
    });
    const game2 = await gm.createGame({
      name: 'Game Ban Test 2',
      date: '26/12/2026',
      location: 'Test',
      maxPlayers: 10,
      isRanked: false,
    });

    const joinG1 = await joinGameWithRetry(playerApi, game1.body.id, 1, 'Player');
    expect([200, 201]).toContain(joinG1.status);

    await new Promise((r) => setTimeout(r, 300));

    const rem = await gm.removePlayer(game1.body.id, userId, true);
    expect(rem.status).toBe(200);

    await new Promise((r) => setTimeout(r, 500));

    const join2 = await joinGameWithRetry(playerApi, game2.body.id, 1, 'Player');
    expect([200, 201]).toContain(join2.status);

    await gm.deleteGame(game1.body.id);
    await gm.deleteGame(game2.body.id);
    await playerApi.deleteAccount();
  });

  test('removed without ban CAN rejoin', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'RemoveNoBan');

    const game = await gm.createGame({
      name: 'Remove No Ban Test',
      date: '25/12/2026',
      location: 'Test',
      maxPlayers: 10,
      isRanked: false,
    });
    const gameId = game.body.id;

    await joinGameWithRetry(playerApi, gameId, 1, 'Player');
    await gm.removePlayer(gameId, userId, false);

    await new Promise((r) => setTimeout(r, 500));

    const rejoin = await joinGameWithRetry(playerApi, gameId, 1, 'Player');
    expect([200, 201]).toContain(rejoin.status);

    await gm.deleteGame(gameId);
    await playerApi.deleteAccount();
  });
});

test.describe('Full Ban Lifecycle', () => {
  test('complete lifecycle: register → game → ban → blocked → unban → game again', async ({ request }) => {
    const gm = await createGM(request);
    const user = createTestUser('Lifecycle');
    const playerApi = new TestApiClient(request);

    const auth = await playerApi.authenticate(generateInitData(user));
    expect(auth.isNewUser).toBe(true);
    await playerApi.completeRegistration();
    const userId = playerApi.userId!;

    await playerApi.updateProfile({ bio: 'Hello world', displayName: 'Lifecycle Player' });
    const profile = await playerApi.getProfile();
    expect(profile.body.bio).toBe('Hello world');

    const game1 = await gm.createGame({
      name: 'Lifecycle Game 1',
      date: '25/12/2026',
      location: 'Test',
      maxPlayers: 10,
      isRanked: false,
    });
    const gameId1 = game1.body.id;
    const join1 = await joinGameWithRetry(playerApi, gameId1, 1, 'Lifecycle Player');
    expect([200, 201]).toContain(join1.status);

    const ban = await gm.banUser(userId, 'Lifecycle ban test');
    expect(ban.status).toBe(200);

    const authBlocked = await playerApi.authenticateRaw(generateInitData(user));
    expect(authBlocked.status).toBe(403);
    expect(authBlocked.body.banned).toBe(true);

    const updateBlocked = await playerApi.updateProfile({ bio: 'Hacked' });
    expect(updateBlocked.status).toBe(403);

    const deleteBlocked = await playerApi.deleteAccount();
    expect(deleteBlocked.status).toBe(403);

    const game2 = await gm.createGame({
      name: 'Lifecycle Game 2',
      date: '26/12/2026',
      location: 'Test',
      maxPlayers: 10,
      isRanked: false,
    });
    const joinBlocked = await playerApi.joinGame(game2.body.id, 2, 'Blocked');
    expect(joinBlocked.status).toBe(403);

    const gamesBlocked = await playerApi.getGames();
    expect(gamesBlocked.body).toEqual([]);

    const lb = await playerApi.getLeaderboard();
    const onLb = lb.body.find((u: any) => u.id === userId);
    expect(onLb).toBeUndefined();

    const profileStill = await playerApi.getProfile();
    expect(profileStill.status).toBe(200);
    expect(profileStill.body.bio).toBe('Hello world');

    const unban = await gm.unbanUser(userId);
    expect(unban.status).toBe(200);

    const authRestored = await playerApi.authenticate(generateInitData(user));
    expect(authRestored.registered).toBe(true);
    expect(authRestored.token).toBeTruthy();

    const updateRestored = await playerApi.updateProfile({ bio: 'I am free!' });
    expect(updateRestored.status).toBe(200);

    const gamesRestored = await playerApi.getGames();
    expect(gamesRestored.body.length).toBeGreaterThan(0);

    const joinRestored = await joinGameWithRetry(playerApi, game2.body.id, 1, 'Free Player');
    expect([200, 201]).toContain(joinRestored.status);

    const lbRestored = await playerApi.getLeaderboard();
    const onLbNow = lbRestored.body.find((u: any) => u.id === userId);
    expect(onLbNow).toBeTruthy();

    await gm.deleteGame(gameId1);
    await gm.deleteGame(game2.body.id);
    await playerApi.deleteAccount();
  });
});

test.describe('Ban Metrics', () => {
  test('ban/unban operations are tracked in metrics', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'Metrics');

    const metricsBefore = await gm.getMetrics();
    const bansBefore = metricsBefore.body?.counters?.['user.bans'] || 0;
    const unbansBefore = metricsBefore.body?.counters?.['user.unbans'] || 0;

    await gm.banUser(userId, 'Metrics test');

    await gm.unbanUser(userId);

    await new Promise((r) => setTimeout(r, 1000));

    const metricsAfter = await gm.getMetrics();
    const bansAfter = metricsAfter.body?.counters?.['user.bans'] || 0;
    const unbansAfter = metricsAfter.body?.counters?.['user.unbans'] || 0;

    expect(bansAfter).toBeGreaterThan(bansBefore);
    expect(unbansAfter).toBeGreaterThan(unbansBefore);

    await playerApi.deleteAccount();
  });
});

test.describe('Ban Edge Cases', () => {
  test('ban reason with special characters', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'SpecialChars');

    const reason = 'Нарушение правил <script>alert("xss")</script> & "quotes"';
    await gm.banUser(userId, reason);

    const users = await gm.listUsers();
    const u = users.body.find((u: any) => u.id === userId);
    expect(u.banReason).toBe(reason);

    await gm.unbanUser(userId);
    await playerApi.deleteAccount();
  });

  test('ban reason with max length (500 chars)', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'MaxLen');

    const reason = 'A'.repeat(500);
    await gm.banUser(userId, reason);

    const users = await gm.listUsers();
    const u = users.body.find((u: any) => u.id === userId);
    expect(u.banReason).toBe(reason);

    await gm.unbanUser(userId);
    await playerApi.deleteAccount();
  });

  test('rapid ban/unban cycles', async ({ request }) => {
    const gm = await createGM(request);
    const user = createTestUser('RapidCycle');
    const playerApi = new TestApiClient(request);

    await playerApi.authenticate(generateInitData(user));
    await playerApi.completeRegistration();
    const userId = playerApi.userId!;

    for (let i = 0; i < 3; i++) {
      await gm.banUser(userId, `Cycle ${i}`);
      await gm.unbanUser(userId);
    }

    const auth = await playerApi.authenticate(generateInitData(user));
    expect(auth.registered).toBe(true);

    const users = await gm.listUsers();
    const u = users.body.find((u: any) => u.id === userId);
    expect(u.banned).toBe(false);
    expect(u.banReason).toBeNull();

    await playerApi.deleteAccount();
  });

  test('game history still accessible while banned', async ({ request }) => {
    const gm = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'History');

    await gm.banUser(userId);

    const history = await playerApi.getGameHistory();
    expect(history.status).toBe(200);
    expect(history.body.games).toBeDefined();

    await gm.unbanUser(userId);
    await playerApi.deleteAccount();
  });

  test('multiple GMs can ban/unban the same user', async ({ request }) => {
    const gm1 = await createGM(request);
    const gm2 = await createGM(request);
    const { api: playerApi, userId } = await createRegisteredUser(request, 'MultiGM');

    await gm1.banUser(userId, 'GM1 ban');

    const unban = await gm2.unbanUser(userId);
    expect(unban.status).toBe(200);

    const users = await gm1.listUsers();
    const u = users.body.find((u: any) => u.id === userId);
    expect(u.banned).toBe(false);

    await playerApi.deleteAccount();
  });
});
