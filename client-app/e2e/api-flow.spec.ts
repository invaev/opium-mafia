import { test, expect } from '@playwright/test';
import { generateInitData, createTestUser, TestApiClient } from './api-helpers';

test.afterAll(async ({ request }) => {
  const gm = new TestApiClient(request);
  await gm.authenticateIpad(800000001, 'Cleanup GM');
  await gm.testCleanup();
});

test.describe('Server Health', () => {
  test('GET /health returns ok', async ({ request }) => {
    const api = new TestApiClient(request);
    const { status, body } = await api.getHealth();
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeTruthy();
  });
});

test.describe('Telegram Authentication', () => {
  test('authenticates with valid initData and creates new user', async ({ request }) => {
    const api = new TestApiClient(request);
    const user = createTestUser('Auth');
    const result = await api.authenticate(generateInitData(user));

    expect(result.token).toBeTruthy();
    expect(result.isNewUser).toBe(true);
    expect(result.registered).toBe(false);
    expect(result.user).toBeDefined();
    expect(result.user.telegramId).toBe(user.id);
    expect(result.user.displayName).toContain(user.first_name);

    await api.deleteAccount();
  });

  test('returns isNewUser=false on second login', async ({ request }) => {
    const api = new TestApiClient(request);
    const user = createTestUser('Repeat');

    const first = await api.authenticate(generateInitData(user));
    expect(first.isNewUser).toBe(true);

    const second = await api.authenticate(generateInitData(user));
    expect(second.isNewUser).toBe(false);
    expect(second.user.id).toBe(first.user.id);

    await api.deleteAccount();
  });

  test('saves photo_url as avatarUrl', async ({ request }) => {
    const api = new TestApiClient(request);
    const user = { ...createTestUser('Photo'), photo_url: 'https://example.com/photo.jpg' };

    await api.authenticate(generateInitData(user));
    const { body } = await api.getProfile();
    expect(body.avatarUrl).toBe('https://example.com/photo.jpg');

    await api.deleteAccount();
  });

  test('rejects empty initData', async ({ request }) => {
    const res = await request.post('https://opium-server-production.up.railway.app/auth/telegram', {
      data: { initData: '' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(400);
  });

  test('rejects invalid hash', async ({ request }) => {
    const user = createTestUser('BadHash');
    const initData = generateInitData(user);
    const corrupted = initData.replace(/hash=[^&]+/, 'hash=invalidhash123');

    const res = await request.post('https://opium-server-production.up.railway.app/auth/telegram', {
      data: { initData: corrupted },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('iPad Authentication', () => {
  test('authenticates with valid API key', async ({ request }) => {
    const api = new TestApiClient(request);
    const result = await api.authenticateIpad(700000099, 'E2E GM');
    expect(result.token).toBeTruthy();
    expect(result.user).toBeDefined();

    await api.deleteAccount();
  });

  test('rejects invalid API key', async ({ request }) => {
    const res = await request.post('https://opium-server-production.up.railway.app/auth/ipad', {
      data: { apiKey: 'wrong-key', telegramId: 700000098, displayName: 'Bad GM' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('Registration Flow', () => {
  test('full registration: auth -> update profile -> register -> verify', async ({ request }) => {
    const api = new TestApiClient(request);
    const user = createTestUser('Reg');

    const auth = await api.authenticate(generateInitData(user));
    expect(auth.registered).toBe(false);

    const update = await api.updateProfile({
      displayName: 'Test Player',
      username: `reg_${Date.now()}`,
      dateOfBirth: '15.06.1995',
      gender: 'male',
      bio: 'E2E test player',
      instagramUsername: 'test_insta',
    });
    expect(update.status).toBe(200);
    expect(update.body.displayName).toBe('Test Player');
    expect(update.body.dateOfBirth).toBe('15.06.1995');
    expect(update.body.gender).toBe('male');
    expect(update.body.bio).toBe('E2E test player');
    expect(update.body.instagramUsername).toBe('test_insta');

    const reg = await api.completeRegistration();
    expect(reg.status).toBe(200);
    expect(reg.body.success).toBe(true);

    const reAuth = await api.authenticate(generateInitData(user));
    expect(reAuth.registered).toBe(true);

    const profile = await api.getProfile();
    expect(profile.body.displayName).toBe('Test Player');
    expect(profile.body.dateOfBirth).toBe('15.06.1995');
    expect(profile.body.gender).toBe('male');
    expect(profile.body.bio).toBe('E2E test player');
    expect(profile.body.instagramUsername).toBe('test_insta');

    await api.deleteAccount();
  });
});

test.describe('User Profile', () => {
  test('GET /users/me returns profile with all expected fields', async ({ request }) => {
    const api = new TestApiClient(request);
    await api.authenticate(generateInitData(createTestUser('Prof')));

    const { status, body } = await api.getProfile();
    expect(status).toBe(200);
    expect(body.id).toBeTruthy();
    expect(typeof body.telegramId).toBe('number');
    expect(body.displayName).toBeTruthy();
    expect(typeof body.totalRating).toBe('number');
    expect(typeof body.gamesPlayed).toBe('number');
    expect(typeof body.gamesWon).toBe('number');
    expect(typeof body.winRate).toBe('number');
    expect(typeof body.totalFouls).toBe('number');
    expect(typeof body.avgPointsPerGame).toBe('number');
    expect(typeof body.bestGameRating).toBe('number');
    expect(body).toHaveProperty('favoriteRole');
    expect(body).toHaveProperty('bestRole');
    expect(Array.isArray(body.ratingHistory)).toBe(true);
    expect(body.createdAt).toBeTruthy();

    await api.deleteAccount();
  });

  test('PATCH /users/me updates all profile fields', async ({ request }) => {
    const api = new TestApiClient(request);
    await api.authenticate(generateInitData(createTestUser('PatchAll')));

    const { status, body } = await api.updateProfile({
      displayName: 'Updated Name',
      username: `updated_${Date.now()}`,
      instagramUsername: 'my_insta',
      dateOfBirth: '01.01.2000',
      gender: 'female',
      bio: 'Updated bio text',
    });

    expect(status).toBe(200);
    expect(body.displayName).toBe('Updated Name');
    expect(body.instagramUsername).toBe('my_insta');
    expect(body.dateOfBirth).toBe('01.01.2000');
    expect(body.gender).toBe('female');
    expect(body.bio).toBe('Updated bio text');

    await api.deleteAccount();
  });

  test('PATCH /users/me rejects empty body', async ({ request }) => {
    const api = new TestApiClient(request);
    await api.authenticate(generateInitData(createTestUser('PatchEmpty')));

    const { status } = await api.updateProfile({});
    expect(status).toBe(400);

    await api.deleteAccount();
  });

  test('GET /users/me requires authentication', async ({ request }) => {
    const res = await request.get('https://opium-server-production.up.railway.app/users/me');
    expect(res.status()).toBe(401);
  });
});

test.describe('iPad User List', () => {
  test('GET /users returns registered users (iPad only)', async ({ request }) => {
    const playerApi = new TestApiClient(request);
    const playerUser = createTestUser('ListUser');
    await playerApi.authenticate(generateInitData(playerUser));
    await playerApi.updateProfile({ displayName: 'ListTestPlayer', bio: 'list test' });
    await playerApi.completeRegistration();

    const gmApi = new TestApiClient(request);
    await gmApi.authenticateIpad(700000050, 'List GM');

    const { status, body } = await gmApi.listUsers();
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);

    const found = body.find((u: { displayName: string }) => u.displayName === 'ListTestPlayer');
    expect(found).toBeTruthy();
    expect(found.bio).toBe('list test');
    expect(found).toHaveProperty('totalRating');
    expect(found).toHaveProperty('gamesPlayed');
    expect(found).toHaveProperty('lastGameName');
    expect(found).toHaveProperty('lastGameDate');
    expect(found).toHaveProperty('createdAt');

    await playerApi.deleteAccount();
    await gmApi.deleteAccount();
  });

  test('GET /users rejects non-iPad users', async ({ request }) => {
    const api = new TestApiClient(request);
    await api.authenticate(generateInitData(createTestUser('NonIPad')));

    const { status } = await api.listUsers();
    expect(status).toBe(403);

    await api.deleteAccount();
  });
});

test.describe('Game History', () => {
  test('GET /users/me/games returns paginated history', async ({ request }) => {
    const api = new TestApiClient(request);
    await api.authenticate(generateInitData(createTestUser('Hist')));

    const { status, body } = await api.getGameHistory();
    expect(status).toBe(200);
    expect(Array.isArray(body.games)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);

    await api.deleteAccount();
  });

  test('respects limit and offset params', async ({ request }) => {
    const api = new TestApiClient(request);
    await api.authenticate(generateInitData(createTestUser('HistPage')));

    const { status, body } = await api.getGameHistory(5, 0);
    expect(status).toBe(200);
    expect(body.limit).toBe(5);
    expect(body.offset).toBe(0);

    await api.deleteAccount();
  });
});

test.describe('Game Lifecycle — Peaceful Win', () => {
  test('full game: create -> join -> roles -> night0 -> day1 -> night1 -> finish', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000001, 'E2E GameMaster');

    const player1user = createTestUser('P1');
    const player2user = createTestUser('P2');
    const p1 = new TestApiClient(request);
    const p2 = new TestApiClient(request);
    const p1Auth = await p1.authenticate(generateInitData(player1user));
    const p2Auth = await p2.authenticate(generateInitData(player2user));

    const game = await gm.createGame({
      name: `E2E Peaceful ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E Test',
      maxPlayers: 10,
      isRanked: false,
    });
    expect(game.status).toBe(201);
    expect(game.body.id).toBeTruthy();
    expect(game.body.status).toBe('lobby');
    const gameId = game.body.id;

    const join1 = await p1.joinGame(gameId, 1, player1user.first_name);
    expect(join1.status).toBe(201);
    expect(join1.body.seatNumber).toBe(1);

    const join2 = await p2.joinGame(gameId, 2, player2user.first_name);
    expect(join2.status).toBe(201);

    const dupeJoin = await p1.joinGame(gameId, 3, player1user.first_name);
    expect(dupeJoin.status).toBe(400);

    const state1 = await p1.getGameState(gameId);
    expect(state1.status).toBe(200);
    expect(state1.body.status).toBe('lobby');
    expect(state1.body.players.length).toBeGreaterThanOrEqual(2);

    const roleBeforeAssign = await p1.getMyRole(gameId);
    expect(roleBeforeAssign.status).toBe(200);
    expect(roleBeforeAssign.body.assigned).toBe(false);

    const roles = await gm.assignRoles(gameId, [
      { seat: 1, userId: p1Auth.user.id as string, displayName: player1user.first_name, role: 'sheriff', team: 'peaceful' },
      { seat: 2, userId: p2Auth.user.id as string, displayName: player2user.first_name, role: 'don', team: 'mafia' },
      { seat: 3, displayName: 'NPC1', role: 'civilian', team: 'peaceful' },
      { seat: 4, displayName: 'NPC2', role: 'civilian', team: 'peaceful' },
      { seat: 5, displayName: 'NPC3', role: 'doctor', team: 'peaceful' },
      { seat: 6, displayName: 'NPC4', role: 'mafia', team: 'mafia', teammates: [2] },
      { seat: 7, displayName: 'NPC5', role: 'civilian', team: 'peaceful' },
      { seat: 8, displayName: 'NPC6', role: 'civilian', team: 'peaceful' },
      { seat: 9, displayName: 'NPC7', role: 'mafia', team: 'mafia', teammates: [2, 6] },
      { seat: 10, displayName: 'NPC8', role: 'civilian', team: 'peaceful' },
    ]);
    expect(roles.status).toBe(200);
    expect(roles.body.rolesAssigned).toBe(10);

    const roleP1 = await p1.getMyRole(gameId);
    expect(roleP1.body.assigned).toBe(true);
    expect(roleP1.body.role).toBe('sheriff');
    expect(roleP1.body.team).toBe('peaceful');

    const roleP2 = await p2.getMyRole(gameId);
    expect(roleP2.body.assigned).toBe(true);
    expect(roleP2.body.role).toBe('don');
    expect(roleP2.body.team).toBe('mafia');
    expect(roleP2.body.teammates).toBeTruthy();

    const state2 = await p1.getGameState(gameId);
    expect(state2.body.status).toBe('active');

    const night0 = await gm.sendNight(gameId, {
      nightNumber: 0,
      actions: { enforcerUsed: false },
      results: { deaths: [], saves: [] },
    });
    expect(night0.status).toBe(200);

    const day1Timer = await gm.sendDay(gameId, {
      dayNumber: 1, event: 'timer', data: { phase: 'opium', secondsLeft: 300 },
    });
    expect(day1Timer.status).toBe(200);

    const day1Vote = await gm.sendDay(gameId, {
      dayNumber: 1, event: 'vote',
      data: { candidates: [3, 4], results: { 3: 5, 4: 3 } },
    });
    expect(day1Vote.status).toBe(200);

    const day1Elim = await gm.sendDay(gameId, {
      dayNumber: 1, event: 'elimination',
      data: { seat: 3, reason: 'vote' },
    });
    expect(day1Elim.status).toBe(200);

    const night1 = await gm.sendNight(gameId, {
      nightNumber: 1,
      actions: { mafiaTarget: 7, enforcerUsed: false, sheriffTarget: 2, doctorTarget: 4 },
      results: {
        deaths: [{ seat: 7, cause: 'mafia' }],
        saves: [],
        sheriffCheck: { seat: 2, result: 'Mafia', isFramed: false },
      },
    });
    expect(night1.status).toBe(200);

    await gm.sendDay(gameId, {
      dayNumber: 2, event: 'vote',
      data: { candidates: [2, 9], results: { 2: 5, 9: 2 } },
    });
    await gm.sendDay(gameId, {
      dayNumber: 2, event: 'elimination',
      data: { seat: 2, reason: 'vote' },
    });

    const finish = await gm.finishGame(gameId, {
      winner: 'peaceful',
      gameLog: {},
      players: [
        { seat: 1, userId: p1Auth.user.id, role: 'sheriff', team: 'peaceful', alive: true, fouls: 0, sheriffFoundDon: true },
        { seat: 2, userId: p2Auth.user.id, role: 'don', team: 'mafia', alive: false, fouls: 0, deathReason: 'vote', deathDay: 2 },
        { seat: 3, role: 'civilian', team: 'peaceful', alive: false, fouls: 0, deathReason: 'vote', deathDay: 1 },
        { seat: 4, role: 'civilian', team: 'peaceful', alive: true, fouls: 0 },
        { seat: 5, role: 'doctor', team: 'peaceful', alive: true, fouls: 0 },
        { seat: 6, role: 'mafia', team: 'mafia', alive: false, fouls: 0, deathReason: 'vote', deathDay: 3 },
        { seat: 7, role: 'civilian', team: 'peaceful', alive: false, fouls: 0, deathReason: 'mafia', deathDay: 1 },
        { seat: 8, role: 'civilian', team: 'peaceful', alive: true, fouls: 0 },
        { seat: 9, role: 'mafia', team: 'mafia', alive: false, fouls: 0, deathReason: 'vote', deathDay: 3 },
        { seat: 10, role: 'civilian', team: 'peaceful', alive: true, fouls: 0 },
      ],
    });
    expect(finish.status).toBe(200);
    expect(finish.body.success).toBe(true);
    expect(finish.body.winner).toBe('peaceful');
    expect(Array.isArray(finish.body.ratings)).toBe(true);
    expect(finish.body.ratings.length).toBe(10);

    const p1Profile = await p1.getProfile();
    expect(p1Profile.body.gamesPlayed).toBeGreaterThanOrEqual(1);
    expect(p1Profile.body.totalRating).toBeGreaterThan(0);

    const sheriffRating = finish.body.ratings.find((r: { seat: number }) => r.seat === 1);
    expect(sheriffRating).toBeTruthy();
    expect(sheriffRating.rating).toBe(21);

    const donRating = finish.body.ratings.find((r: { seat: number }) => r.seat === 2);
    expect(donRating).toBeTruthy();
    expect(donRating.rating).toBe(2);

    const history = await p1.getGameHistory();
    expect(history.body.games.length).toBeGreaterThanOrEqual(1);
    const gameInHistory = history.body.games.find((g: { gameId: string }) => g.gameId === gameId);
    expect(gameInHistory).toBeTruthy();
    expect(gameInHistory.role).toBe('sheriff');
    expect(gameInHistory.won).toBe(true);
    expect(gameInHistory.rating).toBeTruthy();
    expect(gameInHistory.rating.total).toBe(21);

    const finalState = await p1.getGameState(gameId);
    expect(finalState.body.status).toBe('finished');
    expect(finalState.body.winner).toBe('peaceful');

    await p1.deleteAccount();
    await p2.deleteAccount();
    await gm.deleteAccount();
  });
});

test.describe('Game Lifecycle — Mafia Win', () => {
  test('mafia wins when they outnumber peaceful', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000002, 'E2E GM Mafia');

    const p1user = createTestUser('MW1');
    const p2user = createTestUser('MW2');
    const p1 = new TestApiClient(request);
    const p2 = new TestApiClient(request);
    const p1Auth = await p1.authenticate(generateInitData(p1user));
    const p2Auth = await p2.authenticate(generateInitData(p2user));

    const game = await gm.createGame({
      name: `E2E Mafia Win ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });
    const gameId = game.body.id;

    await p1.joinGame(gameId, 1, p1user.first_name);
    await p2.joinGame(gameId, 2, p2user.first_name);

    await gm.assignRoles(gameId, [
      { seat: 1, userId: p1Auth.user.id as string, displayName: p1user.first_name, role: 'civilian', team: 'peaceful' },
      { seat: 2, userId: p2Auth.user.id as string, displayName: p2user.first_name, role: 'don', team: 'mafia' },
      { seat: 3, displayName: 'NPC1', role: 'civilian', team: 'peaceful' },
      { seat: 4, displayName: 'NPC2', role: 'sheriff', team: 'peaceful' },
      { seat: 5, displayName: 'NPC3', role: 'doctor', team: 'peaceful' },
      { seat: 6, displayName: 'NPC4', role: 'mafia', team: 'mafia' },
      { seat: 7, displayName: 'NPC5', role: 'civilian', team: 'peaceful' },
      { seat: 8, displayName: 'NPC6', role: 'civilian', team: 'peaceful' },
      { seat: 9, displayName: 'NPC7', role: 'mafia', team: 'mafia' },
      { seat: 10, displayName: 'NPC8', role: 'civilian', team: 'peaceful' },
    ]);

    await gm.sendNight(gameId, {
      nightNumber: 0, actions: { enforcerUsed: false }, results: { deaths: [], saves: [] },
    });

    await gm.sendNight(gameId, {
      nightNumber: 1,
      actions: { mafiaTarget: 4, enforcerUsed: false },
      results: { deaths: [{ seat: 4, cause: 'mafia' }], saves: [] },
    });

    const finish = await gm.finishGame(gameId, {
      winner: 'mafia',
      gameLog: {},
      players: [
        { seat: 1, userId: p1Auth.user.id, role: 'civilian', team: 'peaceful', alive: true, fouls: 0 },
        { seat: 2, userId: p2Auth.user.id, role: 'don', team: 'mafia', alive: true, fouls: 0 },
        { seat: 3, role: 'civilian', team: 'peaceful', alive: false, fouls: 0, deathReason: 'vote', deathDay: 1 },
        { seat: 4, role: 'sheriff', team: 'peaceful', alive: false, fouls: 0, deathReason: 'mafia', deathDay: 1 },
        { seat: 5, role: 'doctor', team: 'peaceful', alive: false, fouls: 0, deathReason: 'mafia', deathDay: 2 },
        { seat: 6, role: 'mafia', team: 'mafia', alive: true, fouls: 0 },
        { seat: 7, role: 'civilian', team: 'peaceful', alive: false, fouls: 0, deathReason: 'vote', deathDay: 2 },
        { seat: 8, role: 'civilian', team: 'peaceful', alive: false, fouls: 0, deathReason: 'mafia', deathDay: 3 },
        { seat: 9, role: 'mafia', team: 'mafia', alive: true, fouls: 0 },
        { seat: 10, role: 'civilian', team: 'peaceful', alive: true, fouls: 0 },
      ],
    });
    expect(finish.body.winner).toBe('mafia');

    const donRating = finish.body.ratings.find((r: { seat: number }) => r.seat === 2);
    expect(donRating.rating).toBe(18);

    const civRating = finish.body.ratings.find((r: { seat: number }) => r.seat === 1);
    expect(civRating.rating).toBe(3);

    await p1.deleteAccount();
    await p2.deleteAccount();
    await gm.deleteAccount();
  });
});

test.describe('Foul System', () => {
  test('3 fouls result in tech kill with rating penalty', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000003, 'E2E GM Foul');

    const p1user = createTestUser('Foul1');
    const p1 = new TestApiClient(request);
    const p1Auth = await p1.authenticate(generateInitData(p1user));

    const game = await gm.createGame({
      name: `E2E Foul Test ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });
    const gameId = game.body.id;

    await p1.joinGame(gameId, 1, p1user.first_name);

    await gm.assignRoles(gameId, [
      { seat: 1, userId: p1Auth.user.id as string, displayName: p1user.first_name, role: 'civilian', team: 'peaceful' },
      { seat: 2, displayName: 'NPC1', role: 'don', team: 'mafia' },
      { seat: 3, displayName: 'NPC2', role: 'civilian', team: 'peaceful' },
      { seat: 4, displayName: 'NPC3', role: 'civilian', team: 'peaceful' },
      { seat: 5, displayName: 'NPC4', role: 'doctor', team: 'peaceful' },
      { seat: 6, displayName: 'NPC5', role: 'mafia', team: 'mafia' },
      { seat: 7, displayName: 'NPC6', role: 'civilian', team: 'peaceful' },
      { seat: 8, displayName: 'NPC7', role: 'sheriff', team: 'peaceful' },
      { seat: 9, displayName: 'NPC8', role: 'mafia', team: 'mafia' },
      { seat: 10, displayName: 'NPC9', role: 'civilian', team: 'peaceful' },
    ]);

    for (let i = 0; i < 3; i++) {
      const foul = await gm.sendDay(gameId, {
        dayNumber: 1, event: 'foul', data: { seat: 1 },
      });
      expect(foul.status).toBe(200);
    }

    const state = await p1.getGameState(gameId);
    const foulPlayer = state.body.players.find((p: { seat: number }) => p.seat === 1);
    expect(foulPlayer.alive).toBe(false);
    expect(foulPlayer.fouls).toBe(3);
    expect(foulPlayer.deathReason).toBe('techKill');

    const finish = await gm.finishGame(gameId, {
      winner: 'peaceful',
      gameLog: {},
      players: [
        { seat: 1, userId: p1Auth.user.id, role: 'civilian', team: 'peaceful', alive: false, fouls: 3, techKill: true, deathReason: 'techKill', deathDay: 1 },
        { seat: 2, role: 'don', team: 'mafia', alive: false, fouls: 0, deathReason: 'vote', deathDay: 2 },
        { seat: 3, role: 'civilian', team: 'peaceful', alive: true, fouls: 0 },
        { seat: 4, role: 'civilian', team: 'peaceful', alive: true, fouls: 0 },
        { seat: 5, role: 'doctor', team: 'peaceful', alive: true, fouls: 0 },
        { seat: 6, role: 'mafia', team: 'mafia', alive: false, fouls: 0, deathReason: 'vote', deathDay: 3 },
        { seat: 7, role: 'civilian', team: 'peaceful', alive: true, fouls: 0 },
        { seat: 8, role: 'sheriff', team: 'peaceful', alive: true, fouls: 0 },
        { seat: 9, role: 'mafia', team: 'mafia', alive: false, fouls: 0, deathReason: 'vote', deathDay: 3 },
        { seat: 10, role: 'civilian', team: 'peaceful', alive: true, fouls: 0 },
      ],
    });

    const foulRating = finish.body.ratings.find((r: { seat: number }) => r.seat === 1);
    expect(foulRating.rating).toBe(3);

    await p1.deleteAccount();
    await gm.deleteAccount();
  });
});

test.describe('Rating Engine — Role Bonuses', () => {
  test('doctor save bonus applied correctly', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000004, 'E2E GM Rating');

    const game = await gm.createGame({
      name: `E2E Doctor ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });
    const gameId = game.body.id;

    await gm.assignRoles(gameId, [
      { seat: 1, displayName: 'Doctor', role: 'doctor', team: 'peaceful' },
      { seat: 2, displayName: 'Don', role: 'don', team: 'mafia' },
      { seat: 3, displayName: 'Civ1', role: 'civilian', team: 'peaceful' },
      { seat: 4, displayName: 'Civ2', role: 'civilian', team: 'peaceful' },
      { seat: 5, displayName: 'Civ3', role: 'civilian', team: 'peaceful' },
      { seat: 6, displayName: 'Mafia1', role: 'mafia', team: 'mafia' },
      { seat: 7, displayName: 'Civ4', role: 'civilian', team: 'peaceful' },
      { seat: 8, displayName: 'Sheriff', role: 'sheriff', team: 'peaceful' },
      { seat: 9, displayName: 'Mafia2', role: 'mafia', team: 'mafia' },
      { seat: 10, displayName: 'Civ5', role: 'civilian', team: 'peaceful' },
    ]);

    const finish = await gm.finishGame(gameId, {
      winner: 'peaceful',
      gameLog: {},
      players: [
        { seat: 1, role: 'doctor', team: 'peaceful', alive: true, fouls: 0, saves: 2 },
        { seat: 2, role: 'don', team: 'mafia', alive: false, fouls: 0, deathReason: 'vote', deathDay: 2 },
        { seat: 3, role: 'civilian', team: 'peaceful', alive: true, fouls: 0 },
        { seat: 4, role: 'civilian', team: 'peaceful', alive: true, fouls: 0 },
        { seat: 5, role: 'civilian', team: 'peaceful', alive: false, fouls: 0, deathReason: 'mafia', deathDay: 1 },
        { seat: 6, role: 'mafia', team: 'mafia', alive: false, fouls: 0, deathReason: 'vote', deathDay: 3 },
        { seat: 7, role: 'civilian', team: 'peaceful', alive: true, fouls: 0 },
        { seat: 8, role: 'sheriff', team: 'peaceful', alive: true, fouls: 0 },
        { seat: 9, role: 'mafia', team: 'mafia', alive: false, fouls: 0, deathReason: 'vote', deathDay: 3 },
        { seat: 10, role: 'civilian', team: 'peaceful', alive: true, fouls: 0 },
      ],
    });

    const docRating = finish.body.ratings.find((r: { seat: number }) => r.seat === 1);
    expect(docRating.rating).toBe(19);

    await gm.deleteAccount();
  });

  test('bodyguard trade bonus', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000005, 'E2E GM BG');

    const game = await gm.createGame({
      name: `E2E BG ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });

    await gm.assignRoles(game.body.id, Array.from({ length: 10 }, (_, i) => ({
      seat: i + 1,
      displayName: `P${i + 1}`,
      role: i === 0 ? 'bodyguard' : i < 3 ? 'mafia' : 'civilian',
      team: i >= 1 && i < 3 ? 'mafia' : 'peaceful',
    })));

    const finish = await gm.finishGame(game.body.id, {
      winner: 'peaceful',
      gameLog: {},
      players: Array.from({ length: 10 }, (_, i) => ({
        seat: i + 1,
        role: i === 0 ? 'bodyguard' : i < 3 ? 'mafia' : 'civilian',
        team: i >= 1 && i < 3 ? 'mafia' : 'peaceful',
        alive: i !== 0 && i >= 3,
        fouls: 0,
        ...(i === 0 ? { bodyguardTraded: true, deathReason: 'bodyguard', deathDay: 1 } : {}),
        ...(i >= 1 && i < 3 ? { deathReason: 'vote', deathDay: 2 } : {}),
      })),
    });

    const bgRating = finish.body.ratings.find((r: { seat: number }) => r.seat === 1);
    expect(bgRating.rating).toBe(14);

    await gm.deleteAccount();
  });
});

test.describe('Game Edge Cases', () => {
  test('returns 404 for nonexistent game', async ({ request }) => {
    const api = new TestApiClient(request);
    await api.authenticate(generateInitData(createTestUser('G404')));
    const fakeId = 999999999;

    const state = await api.getGameState(fakeId);
    expect(state.status).toBe(404);

    const join = await api.joinGame(fakeId, 1, 'Test');
    expect(join.status).toBe(404);

    const role = await api.getMyRole(fakeId);
    expect(role.status).toBe(404);

    await api.deleteAccount();
  });

  test('POST /games rejects non-iPad users', async ({ request }) => {
    const api = new TestApiClient(request);
    await api.authenticate(generateInitData(createTestUser('GC')));

    const { status, body } = await api.createGame({
      name: 'Test Game',
      date: new Date().toISOString(),
      location: 'Test',
      maxPlayers: 10,
      isRanked: false,
    });
    expect(status).toBe(403);
    expect(body.error).toContain('iPad only');

    await api.deleteAccount();
  });

  test('rejects player count outside 10-20', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000006, 'E2E GM Edge');

    const tooFew = await gm.createGame({
      name: 'Too Few', date: new Date().toISOString(), location: 'Test', maxPlayers: 5, isRanked: false,
    });
    expect(tooFew.status).toBe(400);

    const tooMany = await gm.createGame({
      name: 'Too Many', date: new Date().toISOString(), location: 'Test', maxPlayers: 25, isRanked: false,
    });
    expect(tooMany.status).toBe(400);

    await gm.deleteAccount();
  });

  test('cannot join game that is not in lobby', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000007, 'E2E GM Active');

    const game = await gm.createGame({
      name: `E2E Active ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });

    await gm.assignRoles(game.body.id, Array.from({ length: 10 }, (_, i) => ({
      seat: i + 1,
      displayName: `P${i + 1}`,
      role: i < 3 ? 'mafia' : 'civilian',
      team: i < 3 ? 'mafia' : 'peaceful',
    })));

    const lateJoiner = new TestApiClient(request);
    await lateJoiner.authenticate(generateInitData(createTestUser('Late')));

    const join = await lateJoiner.joinGame(game.body.id, 11, 'Late Player');
    expect(join.status).toBe(400);

    await lateJoiner.deleteAccount();
    await gm.deleteAccount();
  });
});

test.describe('Auth Token Validation', () => {
  test('rejects invalid JWT on protected routes', async ({ request }) => {
    const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYWtlIiwidGVsZWdyYW1JZCI6MTIzfQ.invalid';

    const endpoints = [
      { method: 'GET' as const, path: '/users/me' },
      { method: 'GET' as const, path: '/users/me/games' },
      { method: 'PATCH' as const, path: '/users/me' },
    ];

    for (const ep of endpoints) {
      const opts = {
        headers: {
          Authorization: `Bearer ${invalidToken}`,
          'Content-Type': 'application/json',
        },
        data: ep.method !== 'GET' ? {} : undefined,
      };

      const res =
        ep.method === 'GET'
          ? await request.get(`https://opium-server-production.up.railway.app${ep.path}`, opts)
          : await request.patch(`https://opium-server-production.up.railway.app${ep.path}`, opts);

      expect(res.status()).toBe(401);
    }
  });

  test('rejects requests without auth header', async ({ request }) => {
    const res = await request.get('https://opium-server-production.up.railway.app/users/me');
    expect(res.status()).toBe(401);
  });
});

test.describe('Delete Account', () => {
  test('deletes account and all related data', async ({ request }) => {
    const api = new TestApiClient(request);
    const user = createTestUser('Delete');
    await api.authenticate(generateInitData(user));

    const profile = await api.getProfile();
    expect(profile.status).toBe(200);

    const deleteRes = await api.deleteAccount();
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    const afterDelete = await api.getProfile();
    expect(afterDelete.status).toBe(404);
  });

  test('re-registering after deletion creates fresh account', async ({ request }) => {
    const api = new TestApiClient(request);
    const user = createTestUser('Rereg');

    const first = await api.authenticate(generateInitData(user));
    expect(first.isNewUser).toBe(true);
    await api.deleteAccount();

    const second = await api.authenticate(generateInitData(user));
    expect(second.isNewUser).toBe(true);
    expect(second.user.id).not.toBe(first.user.id);

    await api.deleteAccount();
  });

  test('account deletion clears game ratings', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000008, 'E2E GM Del');

    const p1user = createTestUser('DelRating');
    const p1 = new TestApiClient(request);
    const p1Auth = await p1.authenticate(generateInitData(p1user));

    const game = await gm.createGame({
      name: `E2E Del Rating ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });

    await p1.joinGame(game.body.id, 1, p1user.first_name);

    await gm.assignRoles(game.body.id, [
      { seat: 1, userId: p1Auth.user.id as string, displayName: p1user.first_name, role: 'civilian', team: 'peaceful' },
      ...Array.from({ length: 9 }, (_, i) => ({
        seat: i + 2,
        displayName: `NPC${i + 1}`,
        role: i < 3 ? 'mafia' : 'civilian',
        team: (i < 3 ? 'mafia' : 'peaceful') as string,
      })),
    ]);

    await gm.finishGame(game.body.id, {
      winner: 'peaceful',
      gameLog: {},
      players: [
        { seat: 1, userId: p1Auth.user.id, role: 'civilian', team: 'peaceful', alive: true, fouls: 0 },
        ...Array.from({ length: 9 }, (_, i) => ({
          seat: i + 2,
          role: i < 3 ? 'mafia' : 'civilian',
          team: i < 3 ? 'mafia' : 'peaceful',
          alive: i >= 3,
          fouls: 0,
          ...(i < 3 ? { deathReason: 'vote', deathDay: i + 1 } : {}),
        })),
      ],
    });

    const profile = await p1.getProfile();
    expect(profile.body.totalRating).toBeGreaterThan(0);

    await p1.deleteAccount();
    const newAuth = await p1.authenticate(generateInitData(p1user));
    const newProfile = await p1.getProfile();
    expect(newProfile.body.totalRating).toBe(0);
    expect(newProfile.body.gamesPlayed).toBe(0);

    await p1.deleteAccount();
    await gm.deleteAccount();
  });
});

test.describe('Cross-Feature Integration', () => {
  test('full user journey: auth -> register -> play game -> check stats -> delete', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000009, 'E2E GM Integ');

    const user = createTestUser('Integ');
    const api = new TestApiClient(request);

    const auth = await api.authenticate(generateInitData(user));
    expect(auth.token).toBeTruthy();
    expect(auth.isNewUser).toBe(true);
    expect(auth.registered).toBe(false);

    await api.updateProfile({
      displayName: 'Integration Tester',
      username: `integ_${Date.now()}`,
      dateOfBirth: '01.01.1990',
      gender: 'male',
      bio: 'Integration test user',
      instagramUsername: 'integ_test',
    });

    await api.completeRegistration();

    const profile = await api.getProfile();
    expect(profile.body.displayName).toBe('Integration Tester');
    expect(profile.body.gamesPlayed).toBe(0);
    expect(profile.body.totalRating).toBe(0);

    const game = await gm.createGame({
      name: `E2E Integ Game ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });
    await api.joinGame(game.body.id, 1, 'Integration Tester');

    await gm.assignRoles(game.body.id, [
      { seat: 1, userId: api.userId!, displayName: 'Integration Tester', role: 'sheriff', team: 'peaceful' },
      ...Array.from({ length: 9 }, (_, i) => ({
        seat: i + 2,
        displayName: `NPC${i + 1}`,
        role: i < 3 ? (i === 0 ? 'don' : 'mafia') : 'civilian',
        team: (i < 3 ? 'mafia' : 'peaceful') as string,
      })),
    ]);

    await gm.finishGame(game.body.id, {
      winner: 'peaceful',
      gameLog: {},
      players: [
        { seat: 1, userId: api.userId, role: 'sheriff', team: 'peaceful', alive: true, fouls: 0, sheriffFoundDon: true },
        ...Array.from({ length: 9 }, (_, i) => ({
          seat: i + 2,
          role: i < 3 ? (i === 0 ? 'don' : 'mafia') : 'civilian',
          team: i < 3 ? 'mafia' : 'peaceful',
          alive: i >= 3,
          fouls: 0,
          ...(i < 3 ? { deathReason: 'vote', deathDay: i + 1 } : {}),
        })),
      ],
    });

    const afterGame = await api.getProfile();
    expect(afterGame.body.gamesPlayed).toBe(1);
    expect(afterGame.body.gamesWon).toBe(1);
    expect(afterGame.body.totalRating).toBe(21);

    const history = await api.getGameHistory();
    expect(history.body.total).toBe(1);
    expect(history.body.games[0].role).toBe('sheriff');
    expect(history.body.games[0].won).toBe(true);

    const userList = await gm.listUsers();
    const found = userList.body.find((u: { displayName: string }) => u.displayName === 'Integration Tester');
    expect(found).toBeTruthy();
    expect(found.totalRating).toBe(21);
    expect(found.gamesPlayed).toBe(1);
    expect(found.lastGameDate).toBeTruthy();

    await api.deleteAccount();
    await gm.deleteAccount();
  });
});

test.describe('Guest System', () => {
  test('player can join with guests and guests count towards capacity', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000010, 'E2E GM Guests');

    const p1user = createTestUser('Guest1');
    const p2user = createTestUser('Guest2');
    const p1 = new TestApiClient(request);
    const p2 = new TestApiClient(request);
    await p1.authenticate(generateInitData(p1user));
    const p2Auth = await p2.authenticate(generateInitData(p2user));

    const game = await gm.createGame({
      name: `E2E Guests ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });
    const gameId = game.body.id;

    const join1 = await p1.joinGame(gameId, 1, p1user.first_name);
    expect(join1.status).toBe(201);
    expect(join1.body.guests).toBe(0);

    const joinRes = await request.post(`https://opium-server-production.up.railway.app/games/${gameId}/join`, {
      data: { seatNumber: 2, displayName: p2user.first_name, guests: 3 },
      headers: {
        Authorization: `Bearer ${p2Auth.token}`,
        'Content-Type': 'application/json',
      },
    });
    expect(joinRes.status()).toBe(201);
    const joinBody = await joinRes.json();
    expect(joinBody.guests).toBe(3);

    const state = await p1.getGameState(gameId);
    expect(state.body.players.length).toBe(2);

    await p1.deleteAccount();
    await p2.deleteAccount();
    await gm.deleteAccount();
  });

  test('rejects join when guests exceed capacity', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000011, 'E2E GM CapGuests');

    const p1user = createTestUser('CapG1');
    const p1 = new TestApiClient(request);
    const p1Auth = await p1.authenticate(generateInitData(p1user));

    const game = await gm.createGame({
      name: `E2E Cap Guests ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });

    const joinRes = await request.post(`https://opium-server-production.up.railway.app/games/${game.body.id}/join`, {
      data: { seatNumber: 1, displayName: p1user.first_name, guests: 10 },
      headers: {
        Authorization: `Bearer ${p1Auth.token}`,
        'Content-Type': 'application/json',
      },
    });
    expect(joinRes.status()).toBe(400);

    await p1.deleteAccount();
    await gm.deleteAccount();
  });
});

test.describe('GM Self-Join Prevention', () => {
  test('game master cannot join their own game', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000012, 'E2E GM Self');

    const gmUser = { ...createTestUser('GMSelf'), username: 'gm_self_test' };
    const gmPlayer = new TestApiClient(request);
    await gmPlayer.authenticate(generateInitData(gmUser));
    await gmPlayer.updateProfile({ username: 'gm_self_test' });
    await gmPlayer.completeRegistration();

    const game = await gm.createGame({
      name: `E2E GM Self ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
      hostTelegram: 'gm_self_test',
    });

    const join = await gmPlayer.joinGame(game.body.id, 1, 'GM Player');
    expect(join.status).toBe(400);
    expect(join.body.error).toContain('Game master cannot join');

    const otherUser = createTestUser('NotGM');
    const otherApi = new TestApiClient(request);
    await otherApi.authenticate(generateInitData(otherUser));
    const otherJoin = await otherApi.joinGame(game.body.id, 1, 'Other Player');
    expect(otherJoin.status).toBe(201);

    await gmPlayer.deleteAccount();
    await otherApi.deleteAccount();
    await gm.deleteAccount();
  });
});

test.describe('Leave Game', () => {
  test('player can leave a game they joined', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000013, 'E2E GM Leave');

    const p1user = createTestUser('Leave1');
    const p1 = new TestApiClient(request);
    await p1.authenticate(generateInitData(p1user));

    const game = await gm.createGame({
      name: `E2E Leave ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });

    const join = await p1.joinGame(game.body.id, 1, p1user.first_name);
    expect(join.status).toBe(201);

    const leave = await p1.leaveGame(game.body.id);
    expect(leave.status).toBe(200);
    expect(leave.body.success).toBe(true);

    const state = await p1.getGameState(game.body.id);
    expect(state.body.players.length).toBe(0);

    await p1.deleteAccount();
    await gm.deleteAccount();
  });

  test('cannot leave a game you are not in', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000014, 'E2E GM Leave2');

    const p1user = createTestUser('Leave2');
    const p1 = new TestApiClient(request);
    await p1.authenticate(generateInitData(p1user));

    const game = await gm.createGame({
      name: `E2E Leave Not In ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });

    const leave = await p1.leaveGame(game.body.id);
    expect(leave.status).toBe(404);

    await p1.deleteAccount();
    await gm.deleteAccount();
  });

  test('player can rejoin after leaving', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000015, 'E2E GM Rejoin');

    const p1user = createTestUser('Rejoin1');
    const p1 = new TestApiClient(request);
    await p1.authenticate(generateInitData(p1user));

    const game = await gm.createGame({
      name: `E2E Rejoin ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });

    await p1.joinGame(game.body.id, 1, p1user.first_name);
    await p1.leaveGame(game.body.id);
    const rejoin = await p1.joinGame(game.body.id, 1, p1user.first_name);
    expect(rejoin.status).toBe(201);

    await p1.deleteAccount();
    await gm.deleteAccount();
  });
});

test.describe('Avatar Emoji & Color', () => {
  test('can set and retrieve avatar emoji and colorIndex', async ({ request }) => {
    const api = new TestApiClient(request);
    await api.authenticate(generateInitData(createTestUser('Avatar1')));

    const update = await api.updateProfile({
      avatarEmoji: '🦊',
      avatarColorIndex: 3,
    });
    expect(update.status).toBe(200);
    expect(update.body.avatarEmoji).toBe('🦊');
    expect(update.body.avatarColorIndex).toBe(3);

    const profile = await api.getProfile();
    expect(profile.body.avatarEmoji).toBe('🦊');
    expect(profile.body.avatarColorIndex).toBe(3);

    await api.deleteAccount();
  });

  test('avatar shows in game player list', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000016, 'E2E GM Avatar');

    const p1user = createTestUser('AvatarGame');
    const p1 = new TestApiClient(request);
    await p1.authenticate(generateInitData(p1user));
    await p1.updateProfile({ avatarEmoji: '🐺', avatarColorIndex: 1 });
    await p1.completeRegistration();

    const game = await gm.createGame({
      name: `E2E Avatar Game ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });

    await p1.joinGame(game.body.id, 1, p1user.first_name);

    const gamesRes = await request.get('https://opium-server-production.up.railway.app/games', {
      headers: {
        Authorization: `Bearer ${(await p1.authenticate(generateInitData(p1user))).token}`,
        'Content-Type': 'application/json',
      },
    });
    const games = await gamesRes.json();
    const thisGame = games.find((g: any) => g.id === game.body.id);
    expect(thisGame).toBeTruthy();
    const player = thisGame.players.find((p: any) => p.avatarEmoji === '🐺');
    expect(player).toBeTruthy();
    expect(player.avatarColorIndex).toBe(1);

    await p1.deleteAccount();
    await gm.deleteAccount();
  });
});

test.describe('Game Listing', () => {
  test('GET /games returns games with all required fields', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000017, 'E2E GM List');

    const game = await gm.createGame({
      name: `E2E List Game ${Date.now()}`,
      date: '15/03/2026',
      time: '19:00',
      location: 'Test Venue',
      locationUrl: 'https://maps.google.com/test',
      cost: 50,
      maxPlayers: 12,
      isRanked: true,
      hostTelegram: 'test_host',
    });
    expect(game.status).toBe(201);

    const listRes = await request.get('https://opium-server-production.up.railway.app/games', {
      headers: {
        Authorization: `Bearer ${(await gm.authenticateIpad(700000017, 'E2E GM List')).token}`,
        'Content-Type': 'application/json',
      },
    });
    const games = await listRes.json();
    const thisGame = games.find((g: any) => g.id === game.body.id);

    expect(thisGame).toBeTruthy();
    expect(thisGame.title).toContain('E2E List Game');
    expect(thisGame.date).toBe('15/03/2026');
    expect(thisGame.time).toBe('19:00');
    expect(thisGame.place).toBe('Test Venue');
    expect(thisGame.placeUrl).toBe('https://maps.google.com/test');
    expect(thisGame.price).toBe('50 PLN');
    expect(thisGame.spots).toBe(12);
    expect(thisGame.taken).toBe(0);
    expect(thisGame.rated).toBe(true);
    expect(thisGame.status).toBe('lobby');
    expect(thisGame.host.nick).toBe('test_host');
    expect(Array.isArray(thisGame.players)).toBe(true);

    await gm.deleteAccount();
  });
});

test.describe('Rating Engine — Edge Cases', () => {
  test('maniac win with kills gets maximum bonus', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000018, 'E2E GM Maniac');

    const game = await gm.createGame({
      name: `E2E Maniac ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });

    await gm.assignRoles(game.body.id, [
      { seat: 1, displayName: 'Maniac', role: 'maniac', team: 'peaceful' },
      ...Array.from({ length: 9 }, (_, i) => ({
        seat: i + 2,
        displayName: `P${i + 2}`,
        role: i < 3 ? 'mafia' : 'civilian',
        team: (i < 3 ? 'mafia' : 'peaceful') as string,
      })),
    ]);

    const finish = await gm.finishGame(game.body.id, {
      winner: 'peaceful',
      gameLog: {},
      players: [
        { seat: 1, role: 'maniac', team: 'peaceful', alive: true, fouls: 0, maniacKills: 3 },
        ...Array.from({ length: 9 }, (_, i) => ({
          seat: i + 2,
          role: i < 3 ? 'mafia' : 'civilian',
          team: i < 3 ? 'mafia' : 'peaceful',
          alive: i >= 3,
          fouls: 0,
          ...(i < 3 ? { deathReason: 'vote', deathDay: i + 1 } : {}),
        })),
      ],
    });

    const maniacRating = finish.body.ratings.find((r: { seat: number }) => r.seat === 1);
    expect(maniacRating.rating).toBe(24);

    await gm.deleteAccount();
  });

  test('loser with special actions still gets bonuses', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000019, 'E2E GM LossBonus');

    const game = await gm.createGame({
      name: `E2E Loss Bonus ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });

    await gm.assignRoles(game.body.id, [
      { seat: 1, displayName: 'Sheriff', role: 'sheriff', team: 'peaceful' },
      { seat: 2, displayName: 'Doctor', role: 'doctor', team: 'peaceful' },
      ...Array.from({ length: 8 }, (_, i) => ({
        seat: i + 3,
        displayName: `P${i + 3}`,
        role: i < 3 ? 'mafia' : 'civilian',
        team: (i < 3 ? 'mafia' : 'peaceful') as string,
      })),
    ]);

    const finish = await gm.finishGame(game.body.id, {
      winner: 'mafia',
      gameLog: {},
      players: [
        { seat: 1, role: 'sheriff', team: 'peaceful', alive: false, fouls: 0, sheriffFoundDon: true, deathReason: 'mafia', deathDay: 2 },
        { seat: 2, role: 'doctor', team: 'peaceful', alive: true, fouls: 0, saves: 2 },
        ...Array.from({ length: 8 }, (_, i) => ({
          seat: i + 3,
          role: i < 3 ? 'mafia' : 'civilian',
          team: i < 3 ? 'mafia' : 'peaceful',
          alive: i < 3,
          fouls: 0,
          ...(i >= 3 ? { deathReason: 'vote', deathDay: i } : {}),
        })),
      ],
    });

    const sheriffRating = finish.body.ratings.find((r: { seat: number }) => r.seat === 1);
    expect(sheriffRating.rating).toBe(4);

    const docRating = finish.body.ratings.find((r: { seat: number }) => r.seat === 2);
    expect(docRating.rating).toBe(7);

    await gm.deleteAccount();
  });

  test('rating floor is -5 (heavy fouls on loss)', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000020, 'E2E GM Floor');

    const game = await gm.createGame({
      name: `E2E Floor ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });

    await gm.assignRoles(game.body.id, Array.from({ length: 10 }, (_, i) => ({
      seat: i + 1,
      displayName: `P${i + 1}`,
      role: i < 3 ? 'mafia' : i === 3 ? 'sheriff' : 'civilian',
      team: (i < 3 ? 'mafia' : 'peaceful') as string,
    })));

    const finish = await gm.finishGame(game.body.id, {
      winner: 'mafia',
      gameLog: {},
      players: [
        ...Array.from({ length: 3 }, (_, i) => ({
          seat: i + 1,
          role: 'mafia',
          team: 'mafia',
          alive: true,
          fouls: 0,
        })),
        { seat: 4, role: 'sheriff', team: 'peaceful', alive: false, fouls: 3, techKill: true, deathReason: 'techKill', deathDay: 1 },
        ...Array.from({ length: 6 }, (_, i) => ({
          seat: i + 5,
          role: 'civilian',
          team: 'peaceful',
          alive: false,
          fouls: 0,
          deathReason: 'vote',
          deathDay: i + 1,
        })),
      ],
    });

    const sheriffRating = finish.body.ratings.find((r: { seat: number }) => r.seat === 4);
    expect(sheriffRating.rating).toBe(-5);

    await gm.deleteAccount();
  });
});

test.describe('Game Update & Delete', () => {
  test('iPad can update game details', async ({ request }) => {
    const gm = new TestApiClient(request);
    const auth = await gm.authenticateIpad(700000021, 'E2E GM Update');

    const game = await gm.createGame({
      name: `E2E Update ${Date.now()}`,
      date: '01/01/2026',
      time: '18:00',
      location: 'Old Place',
      maxPlayers: 10,
      isRanked: false,
    });

    const updateRes = await request.put(`https://opium-server-production.up.railway.app/games/${game.body.id}`, {
      data: {
        name: 'Updated Game',
        date: '15/03/2026',
        time: '20:00',
        location: 'New Place',
        locationUrl: 'https://maps.google.com/new',
        cost: 75,
        maxPlayers: 15,
        isRanked: true,
      },
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
    });
    expect(updateRes.status()).toBe(200);

    const listRes = await request.get('https://opium-server-production.up.railway.app/games', {
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
    });
    const games = await listRes.json();
    const updated = games.find((g: any) => g.id === game.body.id);
    expect(updated.title).toBe('Updated Game');
    expect(updated.date).toBe('15/03/2026');
    expect(updated.time).toBe('20:00');
    expect(updated.place).toBe('New Place');
    expect(updated.rated).toBe(true);

    await gm.deleteAccount();
  });

  test('iPad can delete a game', async ({ request }) => {
    const gm = new TestApiClient(request);
    const auth = await gm.authenticateIpad(700000022, 'E2E GM Delete');

    const game = await gm.createGame({
      name: `E2E Delete ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });

    const deleteRes = await request.delete(`https://opium-server-production.up.railway.app/games/${game.body.id}`, {
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
    });
    expect(deleteRes.status()).toBe(200);

    const listRes = await request.get('https://opium-server-production.up.railway.app/games', {
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
    });
    const games = await listRes.json();
    const deleted = games.find((g: any) => g.id === game.body.id);
    expect(deleted).toBeFalsy();

    await gm.deleteAccount();
  });

  test('non-iPad cannot update or delete games', async ({ request }) => {
    const gm = new TestApiClient(request);
    await gm.authenticateIpad(700000023, 'E2E GM NonIPad');

    const game = await gm.createGame({
      name: `E2E NonIPad ${Date.now()}`,
      date: new Date().toISOString(),
      location: 'E2E',
      maxPlayers: 10,
      isRanked: false,
    });

    const player = new TestApiClient(request);
    const playerAuth = await player.authenticate(generateInitData(createTestUser('NonIPad2')));

    const updateRes = await request.put(`https://opium-server-production.up.railway.app/games/${game.body.id}`, {
      data: { name: 'Hacked' },
      headers: {
        Authorization: `Bearer ${playerAuth.token}`,
        'Content-Type': 'application/json',
      },
    });
    expect(updateRes.status()).toBe(403);

    const deleteRes = await request.delete(`https://opium-server-production.up.railway.app/games/${game.body.id}`, {
      headers: {
        Authorization: `Bearer ${playerAuth.token}`,
        'Content-Type': 'application/json',
      },
    });
    expect(deleteRes.status()).toBe(403);

    await player.deleteAccount();
    await gm.deleteAccount();
  });
});

test.describe('Invalid Game ID', () => {
  test('non-numeric game ID returns 404', async ({ request }) => {
    const api = new TestApiClient(request);
    await api.authenticate(generateInitData(createTestUser('BadID')));

    const res = await request.get('https://opium-server-production.up.railway.app/games/abc/state', {
      headers: {
        Authorization: `Bearer ${(api as any).token}`,
        'Content-Type': 'application/json',
      },
    });
    expect(res.status()).toBe(404);

    await api.deleteAccount();
  });
});
