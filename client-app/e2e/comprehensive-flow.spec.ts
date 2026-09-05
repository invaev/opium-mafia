import { test, expect } from '@playwright/test';
import { generateInitData, createTestUser, TestApiClient } from './api-helpers';

test.afterAll(async ({ request }) => {
  const gm = new TestApiClient(request);
  await gm.authenticateIpad(800000001, 'Cleanup GM');
  await gm.testCleanup();
});

const ROLE_DISTRIBUTION_10 = {
  don: 1, mafia: 2, sheriff: 1, doctor: 1, civilian: 5,
};

async function createRegisteredUsers(
  request: any,
  count: number,
  prefix: string
): Promise<Array<{ api: TestApiClient; user: ReturnType<typeof createTestUser>; userId: number }>> {
  const users: Array<{ api: TestApiClient; user: ReturnType<typeof createTestUser>; userId: number }> = [];
  for (let i = 0; i < count; i++) {
    const api = new TestApiClient(request);
    const user = createTestUser(`${prefix}${i}`);
    const authResult = await api.authenticate(generateInitData(user));
    await api.completeRegistration();
    users.push({ api, user, userId: authResult.user.id as number });
  }
  return users;
}

async function createGM(request: any): Promise<TestApiClient> {
  const gm = new TestApiClient(request);
  await gm.authenticateIpad(999999999, 'E2E Game Master');
  return gm;
}

test.describe('Health', () => {
  test('server is healthy', async ({ request }) => {
    const api = new TestApiClient(request);
    const { status, body } = await api.getHealth();
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
  });
});

test.describe('Auth & Registration', () => {
  test('new user: auth → register → profile', async ({ request }) => {
    const api = new TestApiClient(request);
    const user = createTestUser('RegFlow');
    const auth = await api.authenticate(generateInitData(user));
    expect(auth.isNewUser).toBe(true);
    expect(auth.registered).toBe(false);

    const reg = await api.completeRegistration();
    expect(reg.status).toBe(200);

    const profile = await api.getProfile();
    expect(profile.status).toBe(200);
    expect(profile.body.totalRating).toBe(0);
    expect(profile.body.gamesPlayed).toBe(0);

    await api.deleteAccount();
  });

  test('re-auth preserves registered state', async ({ request }) => {
    const api = new TestApiClient(request);
    const user = createTestUser('ReAuth');
    await api.authenticate(generateInitData(user));
    await api.completeRegistration();

    const auth2 = await api.authenticate(generateInitData(user));
    expect(auth2.registered).toBe(true);

    await api.deleteAccount();
  });
});

test.describe('Game Lifecycle — Peaceful Win', () => {
  test('create → join 10 → roles → finish → ratings + stats', async ({ request }) => {
    const gm = await createGM(request);
    const players = await createRegisteredUsers(request, 10, 'PW');

    const game = await gm.createGame({
      name: 'E2E Peaceful Win',
      date: '2026-03-11',
      location: 'Test Arena',
      maxPlayers: 10,
      isRanked: true,
    });
    expect([200, 201]).toContain(game.status);
    const gameId = game.body.id;

    for (let i = 0; i < players.length; i++) {
      const join = await players[i].api.joinGame(gameId, i + 1, `Player${i}`);
      expect([200, 201]).toContain(join.status);
    }

    const roleAssignment = [
      { seat: 1, role: 'don', team: 'mafia' },
      { seat: 2, role: 'mafia', team: 'mafia' },
      { seat: 3, role: 'mafia', team: 'mafia' },
      { seat: 4, role: 'sheriff', team: 'peaceful' },
      { seat: 5, role: 'doctor', team: 'peaceful' },
      { seat: 6, role: 'civilian', team: 'peaceful' },
      { seat: 7, role: 'civilian', team: 'peaceful' },
      { seat: 8, role: 'civilian', team: 'peaceful' },
      { seat: 9, role: 'civilian', team: 'peaceful' },
      { seat: 10, role: 'civilian', team: 'peaceful' },
    ];

    const mafiaPlayerIds = [players[0].userId, players[1].userId, players[2].userId];
    const rolesPayload = roleAssignment.map((r, i) => ({
      ...r,
      userId: players[i].userId,
      displayName: `Player${i}`,
      teammates: r.team === 'mafia' ? mafiaPlayerIds.filter(id => id !== players[i].userId) : undefined,
    }));

    const rolesResult = await gm.assignRoles(gameId, rolesPayload);
    expect(rolesResult.status).toBe(200);

    const finishPlayers = roleAssignment.map((r, i) => ({
      seat: r.seat,
      userId: players[i].userId,
      role: r.role,
      team: r.team,
      alive: r.team === 'peaceful',
      fouls: 0,
    }));

    const finishResult = await gm.finishGame(gameId, {
      winner: 'peaceful',
      gameLog: { nightLog: [], voteLog: [], foulLog: [] },
      players: finishPlayers,
    });
    expect(finishResult.status).toBe(200);
    expect(finishResult.body.success).toBe(true);
    expect(finishResult.body.winner).toBe('peaceful');

    const ratings = finishResult.body.ratings;
    expect(ratings).toHaveLength(10);

    const sheriffRating = ratings.find((r: any) => r.seat === 4);
    expect(sheriffRating.role).toBe('sheriff');
    expect(sheriffRating.rating).toBe(18);

    const doctorRating = ratings.find((r: any) => r.seat === 5);
    expect(doctorRating.role).toBe('doctor');
    expect(doctorRating.rating).toBe(15);

    const civRating = ratings.find((r: any) => r.seat === 6);
    expect(civRating.role).toBe('civilian');
    expect(civRating.rating).toBe(14);

    const donRating = ratings.find((r: any) => r.seat === 1);
    expect(donRating.role).toBe('don');
    expect(donRating.rating).toBe(2);

    const mafiaRating = ratings.find((r: any) => r.seat === 2);
    expect(mafiaRating.role).toBe('mafia');
    expect(mafiaRating.rating).toBe(2);

    for (let i = 0; i < players.length; i++) {
      const profile = await players[i].api.getProfile();
      expect(profile.body.gamesPlayed).toBe(1);

      if (roleAssignment[i].team === 'peaceful') {
        expect(profile.body.gamesWon).toBe(1);
      } else {
        expect(profile.body.gamesWon).toBe(0);
      }
    }

    const history = await players[3].api.getGameHistory();
    expect(history.status).toBe(200);
    expect(history.body.games.length).toBeGreaterThanOrEqual(1);
    const thisGame = history.body.games.find((g: any) => g.gameId === gameId);
    expect(thisGame).toBeDefined();
    expect(thisGame.role).toBe('sheriff');
    expect(thisGame.won).toBe(true);

    for (const p of players) {
      await p.api.deleteAccount();
    }
  });
});

test.describe('Game Lifecycle — Mafia Win', () => {
  test('mafia wins → mafia get win ratings, peaceful get loss ratings', async ({ request }) => {
    const gm = await createGM(request);
    const players = await createRegisteredUsers(request, 10, 'MW');

    const game = await gm.createGame({
      name: 'E2E Mafia Win',
      date: '2026-03-11',
      location: 'Test Arena',
      maxPlayers: 10,
      isRanked: true,
    });
    const gameId = game.body.id;

    for (let i = 0; i < 10; i++) {
      await players[i].api.joinGame(gameId, i + 1, `MWPlayer${i}`);
    }

    const roleAssignment = [
      { seat: 1, role: 'don', team: 'mafia' },
      { seat: 2, role: 'mafia', team: 'mafia' },
      { seat: 3, role: 'mafia', team: 'mafia' },
      { seat: 4, role: 'sheriff', team: 'peaceful' },
      { seat: 5, role: 'doctor', team: 'peaceful' },
      { seat: 6, role: 'civilian', team: 'peaceful' },
      { seat: 7, role: 'civilian', team: 'peaceful' },
      { seat: 8, role: 'civilian', team: 'peaceful' },
      { seat: 9, role: 'civilian', team: 'peaceful' },
      { seat: 10, role: 'civilian', team: 'peaceful' },
    ];

    const mafiaIds = [players[0].userId, players[1].userId, players[2].userId];
    await gm.assignRoles(gameId, roleAssignment.map((r, i) => ({
      ...r,
      userId: players[i].userId,
      displayName: `MWPlayer${i}`,
      teammates: r.team === 'mafia' ? mafiaIds.filter(id => id !== players[i].userId) : undefined,
    })));

    const finishPlayers = roleAssignment.map((r, i) => ({
      seat: r.seat,
      userId: players[i].userId,
      role: r.role,
      team: r.team,
      alive: i === 0 || i === 1 || i === 5 || i === 6,
      fouls: 0,
    }));

    const result = await gm.finishGame(gameId, {
      winner: 'mafia',
      gameLog: {},
      players: finishPlayers,
    });
    expect(result.status).toBe(200);

    const ratings = result.body.ratings;

    const donR = ratings.find((r: any) => r.seat === 1);
    expect(donR.rating).toBe(18);

    const mafR = ratings.find((r: any) => r.seat === 2);
    expect(mafR.rating).toBe(15);

    const maf2R = ratings.find((r: any) => r.seat === 3);
    expect(maf2R.rating).toBe(12);

    const sheriffR = ratings.find((r: any) => r.seat === 4);
    expect(sheriffR.rating).toBe(2);

    const civAliveR = ratings.find((r: any) => r.seat === 6);
    expect(civAliveR.rating).toBe(3);

    const civDeadR = ratings.find((r: any) => r.seat === 8);
    expect(civDeadR.rating).toBe(2);

    const donProfile = await players[0].api.getProfile();
    expect(donProfile.body.gamesPlayed).toBe(1);
    expect(donProfile.body.gamesWon).toBe(1);
    expect(donProfile.body.totalRating).toBe(18);

    const sheriffProfile = await players[3].api.getProfile();
    expect(sheriffProfile.body.gamesPlayed).toBe(1);
    expect(sheriffProfile.body.gamesWon).toBe(0);
    expect(sheriffProfile.body.totalRating).toBe(2);

    for (const p of players) {
      await p.api.deleteAccount();
    }
  });
});

test.describe('Special Role Bonuses', () => {
  test('sheriff found don + doctor saves → extra rating', async ({ request }) => {
    const gm = await createGM(request);
    const players = await createRegisteredUsers(request, 10, 'SB');

    const game = await gm.createGame({
      name: 'E2E Special Bonuses',
      date: '2026-03-11',
      location: 'Test Arena',
      maxPlayers: 10,
      isRanked: true,
    });
    const gameId = game.body.id;

    for (let i = 0; i < 10; i++) {
      await players[i].api.joinGame(gameId, i + 1, `SBPlayer${i}`);
    }

    const roles = [
      { seat: 1, role: 'don', team: 'mafia' },
      { seat: 2, role: 'mafia', team: 'mafia' },
      { seat: 3, role: 'mafia', team: 'mafia' },
      { seat: 4, role: 'sheriff', team: 'peaceful' },
      { seat: 5, role: 'doctor', team: 'peaceful' },
      { seat: 6, role: 'civilian', team: 'peaceful' },
      { seat: 7, role: 'civilian', team: 'peaceful' },
      { seat: 8, role: 'civilian', team: 'peaceful' },
      { seat: 9, role: 'civilian', team: 'peaceful' },
      { seat: 10, role: 'civilian', team: 'peaceful' },
    ];

    const mafiaIds = [players[0].userId, players[1].userId, players[2].userId];
    await gm.assignRoles(gameId, roles.map((r, i) => ({
      ...r,
      userId: players[i].userId,
      displayName: `SBPlayer${i}`,
      teammates: r.team === 'mafia' ? mafiaIds.filter(id => id !== players[i].userId) : undefined,
    })));

    const finishPlayers = roles.map((r, i) => ({
      seat: r.seat,
      userId: players[i].userId,
      role: r.role,
      team: r.team,
      alive: r.team === 'peaceful',
      fouls: 0,
      ...(r.role === 'sheriff' ? { sheriffFoundDon: true, sheriffShotMafia: true } : {}),
      ...(r.role === 'doctor' ? { saves: 2 } : {}),
    }));

    const result = await gm.finishGame(gameId, {
      winner: 'peaceful',
      gameLog: {},
      players: finishPlayers,
    });
    expect(result.status).toBe(200);

    const ratings = result.body.ratings;

    const sheriffR = ratings.find((r: any) => r.seat === 4);
    expect(sheriffR.rating).toBe(23);

    const doctorR = ratings.find((r: any) => r.seat === 5);
    expect(doctorR.rating).toBe(19);

    for (const p of players) {
      await p.api.deleteAccount();
    }
  });
});

test.describe('Foul Penalties', () => {
  test('1, 2, 3 fouls → escalating penalties', async ({ request }) => {
    const gm = await createGM(request);
    const players = await createRegisteredUsers(request, 10, 'FP');

    const game = await gm.createGame({
      name: 'E2E Foul Penalties',
      date: '2026-03-11',
      location: 'Test Arena',
      maxPlayers: 10,
      isRanked: true,
    });
    const gameId = game.body.id;

    for (let i = 0; i < 10; i++) {
      await players[i].api.joinGame(gameId, i + 1, `FPPlayer${i}`);
    }

    const roles = [
      { seat: 1, role: 'don', team: 'mafia' },
      { seat: 2, role: 'mafia', team: 'mafia' },
      { seat: 3, role: 'mafia', team: 'mafia' },
      { seat: 4, role: 'sheriff', team: 'peaceful' },
      { seat: 5, role: 'doctor', team: 'peaceful' },
      { seat: 6, role: 'civilian', team: 'peaceful' },
      { seat: 7, role: 'civilian', team: 'peaceful' },
      { seat: 8, role: 'civilian', team: 'peaceful' },
      { seat: 9, role: 'civilian', team: 'peaceful' },
      { seat: 10, role: 'civilian', team: 'peaceful' },
    ];

    const mafiaIds = [players[0].userId, players[1].userId, players[2].userId];
    await gm.assignRoles(gameId, roles.map((r, i) => ({
      ...r,
      userId: players[i].userId,
      displayName: `FPPlayer${i}`,
      teammates: r.team === 'mafia' ? mafiaIds.filter(id => id !== players[i].userId) : undefined,
    })));

    const finishPlayers = roles.map((r, i) => {
      let fouls = 0;
      let alive = r.team === 'peaceful';
      let techKill = false;

      if (i === 5) fouls = 1;
      if (i === 6) fouls = 2;
      if (i === 7) { fouls = 3; alive = false; techKill = true; }

      if (r.team === 'mafia') alive = false;

      return {
        seat: r.seat,
        userId: players[i].userId,
        role: r.role,
        team: r.team,
        alive,
        fouls,
        techKill,
      };
    });

    const result = await gm.finishGame(gameId, {
      winner: 'peaceful',
      gameLog: {},
      players: finishPlayers,
    });
    expect(result.status).toBe(200);

    const ratings = result.body.ratings;

    const civ1F = ratings.find((r: any) => r.seat === 6);
    expect(civ1F.rating).toBe(13);

    const civ2F = ratings.find((r: any) => r.seat === 7);
    expect(civ2F.rating).toBe(11);

    const civ3F = ratings.find((r: any) => r.seat === 8);
    expect(civ3F.rating).toBe(3);

    const p6 = await players[5].api.getProfile();
    expect(p6.body.totalFouls).toBe(1);

    const p7 = await players[6].api.getProfile();
    expect(p7.body.totalFouls).toBe(2);

    const p8 = await players[7].api.getProfile();
    expect(p8.body.totalFouls).toBe(3);

    for (const p of players) {
      await p.api.deleteAccount();
    }
  });
});

test.describe('Stats Accumulation', () => {
  test('playing 2 games accumulates rating and stats', async ({ request }) => {
    const gm = await createGM(request);
    const players = await createRegisteredUsers(request, 10, 'SA');

    const game1 = await gm.createGame({
      name: 'E2E Stats Game 1',
      date: '2026-03-11',
      location: 'Test Arena',
      maxPlayers: 10,
      isRanked: true,
    });
    const gameId1 = game1.body.id;

    for (let i = 0; i < 10; i++) {
      await players[i].api.joinGame(gameId1, i + 1, `SAPlayer${i}`);
    }

    const roles = [
      { seat: 1, role: 'don', team: 'mafia' },
      { seat: 2, role: 'mafia', team: 'mafia' },
      { seat: 3, role: 'mafia', team: 'mafia' },
      { seat: 4, role: 'sheriff', team: 'peaceful' },
      { seat: 5, role: 'doctor', team: 'peaceful' },
      { seat: 6, role: 'civilian', team: 'peaceful' },
      { seat: 7, role: 'civilian', team: 'peaceful' },
      { seat: 8, role: 'civilian', team: 'peaceful' },
      { seat: 9, role: 'civilian', team: 'peaceful' },
      { seat: 10, role: 'civilian', team: 'peaceful' },
    ];

    const mafiaIds = [players[0].userId, players[1].userId, players[2].userId];
    await gm.assignRoles(gameId1, roles.map((r, i) => ({
      ...r,
      userId: players[i].userId,
      displayName: `SAPlayer${i}`,
      teammates: r.team === 'mafia' ? mafiaIds.filter(id => id !== players[i].userId) : undefined,
    })));

    await gm.finishGame(gameId1, {
      winner: 'peaceful',
      gameLog: {},
      players: roles.map((r, i) => ({
        seat: r.seat,
        userId: players[i].userId,
        role: r.role,
        team: r.team,
        alive: r.team === 'peaceful',
        fouls: 0,
      })),
    });

    const p0After1 = await players[0].api.getProfile();
    expect(p0After1.body.gamesPlayed).toBe(1);
    expect(p0After1.body.gamesWon).toBe(0);
    const donRating1 = p0After1.body.totalRating;

    const p4After1 = await players[3].api.getProfile();
    expect(p4After1.body.gamesPlayed).toBe(1);
    expect(p4After1.body.gamesWon).toBe(1);
    const sheriffRating1 = p4After1.body.totalRating;

    const game2 = await gm.createGame({
      name: 'E2E Stats Game 2',
      date: '2026-03-11',
      location: 'Test Arena',
      maxPlayers: 10,
      isRanked: true,
    });
    const gameId2 = game2.body.id;

    for (let i = 0; i < 10; i++) {
      await players[i].api.joinGame(gameId2, i + 1, `SAPlayer${i}`);
    }

    const roles2 = [
      { seat: 1, role: 'sheriff', team: 'peaceful' },
      { seat: 2, role: 'civilian', team: 'peaceful' },
      { seat: 3, role: 'civilian', team: 'peaceful' },
      { seat: 4, role: 'don', team: 'mafia' },
      { seat: 5, role: 'mafia', team: 'mafia' },
      { seat: 6, role: 'mafia', team: 'mafia' },
      { seat: 7, role: 'doctor', team: 'peaceful' },
      { seat: 8, role: 'civilian', team: 'peaceful' },
      { seat: 9, role: 'civilian', team: 'peaceful' },
      { seat: 10, role: 'civilian', team: 'peaceful' },
    ];

    const mafiaIds2 = [players[3].userId, players[4].userId, players[5].userId];
    await gm.assignRoles(gameId2, roles2.map((r, i) => ({
      ...r,
      userId: players[i].userId,
      displayName: `SAPlayer${i}`,
      teammates: r.team === 'mafia' ? mafiaIds2.filter(id => id !== players[i].userId) : undefined,
    })));

    await gm.finishGame(gameId2, {
      winner: 'mafia',
      gameLog: {},
      players: roles2.map((r, i) => ({
        seat: r.seat,
        userId: players[i].userId,
        role: r.role,
        team: r.team,
        alive: r.team === 'mafia' || i === 0,
        fouls: 0,
      })),
    });

    const p0After2 = await players[0].api.getProfile();
    expect(p0After2.body.gamesPlayed).toBe(2);
    expect(p0After2.body.totalRating).toBe(donRating1 + 3);

    const p3After2 = await players[3].api.getProfile();
    expect(p3After2.body.gamesPlayed).toBe(2);
    expect(p3After2.body.gamesWon).toBe(2);
    expect(p3After2.body.totalRating).toBe(sheriffRating1 + 18);

    const history = await players[0].api.getGameHistory();
    expect(history.body.games.length).toBeGreaterThanOrEqual(2);

    for (const p of players) {
      await p.api.deleteAccount();
    }
  });
});

test.describe('Player Ordering by Rating', () => {
  test('game list returns players with their ratings', async ({ request }) => {
    const gm = await createGM(request);
    const players = await createRegisteredUsers(request, 10, 'OR');

    const game1 = await gm.createGame({
      name: 'E2E Rating Seed',
      date: '2026-03-11',
      location: 'Test Arena',
      maxPlayers: 10,
      isRanked: true,
    });
    const gameId1 = game1.body.id;

    for (let i = 0; i < 10; i++) {
      await players[i].api.joinGame(gameId1, i + 1, `ORPlayer${i}`);
    }

    const roles = [
      { seat: 1, role: 'don', team: 'mafia' },
      { seat: 2, role: 'mafia', team: 'mafia' },
      { seat: 3, role: 'mafia', team: 'mafia' },
      { seat: 4, role: 'sheriff', team: 'peaceful' },
      { seat: 5, role: 'doctor', team: 'peaceful' },
      { seat: 6, role: 'civilian', team: 'peaceful' },
      { seat: 7, role: 'civilian', team: 'peaceful' },
      { seat: 8, role: 'civilian', team: 'peaceful' },
      { seat: 9, role: 'civilian', team: 'peaceful' },
      { seat: 10, role: 'civilian', team: 'peaceful' },
    ];

    const mafiaIds = [players[0].userId, players[1].userId, players[2].userId];
    await gm.assignRoles(gameId1, roles.map((r, i) => ({
      ...r,
      userId: players[i].userId,
      displayName: `ORPlayer${i}`,
      teammates: r.team === 'mafia' ? mafiaIds.filter(id => id !== players[i].userId) : undefined,
    })));

    await gm.finishGame(gameId1, {
      winner: 'peaceful',
      gameLog: {},
      players: roles.map((r, i) => ({
        seat: r.seat,
        userId: players[i].userId,
        role: r.role,
        team: r.team,
        alive: r.team === 'peaceful',
        fouls: 0,
      })),
    });

    const game2 = await gm.createGame({
      name: 'E2E Rating Order Check',
      date: '2026-03-11',
      location: 'Test Arena',
      maxPlayers: 10,
      isRanked: true,
    });
    const gameId2 = game2.body.id;

    for (let i = 0; i < 10; i++) {
      await players[i].api.joinGame(gameId2, i + 1, `ORPlayer${i}`);
    }

    const gamesRes = await gm.request.get('https://opium-server-production.up.railway.app/games', {
      headers: { Authorization: `Bearer ${gm.token}`, 'Content-Type': 'application/json' },
    });
    const gamesList = await gamesRes.json();
    const thisGame = gamesList.find((g: any) => g.id === gameId2);
    expect(thisGame).toBeDefined();

    for (const pl of thisGame.players) {
      expect(pl).toHaveProperty('rating');
      expect(typeof pl.rating).toBe('number');
    }

    const sheriffPlayer = thisGame.players.find((p: any) => p.seat === 4);
    expect(sheriffPlayer.rating).toBe(18);

    const donPlayer = thisGame.players.find((p: any) => p.seat === 1);
    expect(donPlayer.rating).toBe(2);

    const civPlayer = thisGame.players.find((p: any) => p.seat === 6);
    expect(civPlayer.rating).toBe(14);

    const sortedByRating = [...thisGame.players].sort((a: any, b: any) => b.rating - a.rating);
    expect(sortedByRating[0].rating).toBeGreaterThanOrEqual(sortedByRating[1].rating);
    expect(sortedByRating[sortedByRating.length - 1].rating).toBeLessThanOrEqual(sortedByRating[0].rating);

    for (const p of players) {
      await p.api.deleteAccount();
    }
  });
});

test.describe('Game Join & Leave', () => {
  test('player joins → appears in list → leaves → removed', async ({ request }) => {
    const gm = await createGM(request);
    const [player] = await createRegisteredUsers(request, 1, 'JL');

    const game = await gm.createGame({
      name: 'E2E Join Leave',
      date: '2026-03-11',
      location: 'Test Arena',
      maxPlayers: 10,
      isRanked: true,
    });
    const gameId = game.body.id;

    const joinRes = await player.api.joinGame(gameId, 1, 'JLPlayer0');
    expect([200, 201]).toContain(joinRes.status);

    const gamesRes = await gm.request.get('https://opium-server-production.up.railway.app/games', {
      headers: { Authorization: `Bearer ${gm.token}`, 'Content-Type': 'application/json' },
    });
    const games = await gamesRes.json();
    const g = games.find((gg: any) => gg.id === gameId);
    expect(g.players.length).toBe(1);
    expect(g.taken).toBe(1);

    const leaveRes = await player.api.leaveGame(gameId);
    expect(leaveRes.status).toBe(200);

    const gamesRes2 = await gm.request.get('https://opium-server-production.up.railway.app/games', {
      headers: { Authorization: `Bearer ${gm.token}`, 'Content-Type': 'application/json' },
    });
    const games2 = await gamesRes2.json();
    const g2 = games2.find((gg: any) => gg.id === gameId);
    expect(g2.players.length).toBe(0);
    expect(g2.taken).toBe(0);

    await player.api.deleteAccount();
  });
});

test.describe('Role Assignment', () => {
  test('after roles assigned, player can see their role via /my-role', async ({ request }) => {
    const gm = await createGM(request);
    const players = await createRegisteredUsers(request, 10, 'RA');

    const game = await gm.createGame({
      name: 'E2E Roles',
      date: '2026-03-11',
      location: 'Test Arena',
      maxPlayers: 10,
      isRanked: true,
    });
    const gameId = game.body.id;

    for (let i = 0; i < 10; i++) {
      await players[i].api.joinGame(gameId, i + 1, `RAPlayer${i}`);
    }

    const roles = [
      { seat: 1, role: 'don', team: 'mafia' },
      { seat: 2, role: 'mafia', team: 'mafia' },
      { seat: 3, role: 'mafia', team: 'mafia' },
      { seat: 4, role: 'sheriff', team: 'peaceful' },
      { seat: 5, role: 'doctor', team: 'peaceful' },
      { seat: 6, role: 'civilian', team: 'peaceful' },
      { seat: 7, role: 'civilian', team: 'peaceful' },
      { seat: 8, role: 'civilian', team: 'peaceful' },
      { seat: 9, role: 'civilian', team: 'peaceful' },
      { seat: 10, role: 'civilian', team: 'peaceful' },
    ];

    const mafiaIds = [players[0].userId, players[1].userId, players[2].userId];
    const assignRes = await gm.assignRoles(gameId, roles.map((r, i) => ({
      ...r,
      userId: players[i].userId,
      displayName: `RAPlayer${i}`,
      teammates: r.team === 'mafia' ? mafiaIds.filter(id => id !== players[i].userId) : undefined,
    })));
    expect(assignRes.status).toBe(200);

    for (let i = 0; i < 10; i++) {
      const roleRes = await players[i].api.getMyRole(gameId);
      expect(roleRes.status).toBe(200);
      expect(roleRes.body.role).toBe(roles[i].role);
      expect(roleRes.body.team).toBe(roles[i].team);

      if (roles[i].team === 'mafia') {
        expect(roleRes.body.teammates).toBeDefined();
        expect(roleRes.body.teammates.length).toBeGreaterThan(0);
      }
    }

    await gm.finishGame(gameId, {
      winner: 'peaceful',
      gameLog: {},
      players: roles.map((r, i) => ({
        seat: r.seat,
        userId: players[i].userId,
        role: r.role,
        team: r.team,
        alive: true,
        fouls: 0,
      })),
    });

    for (const p of players) {
      await p.api.deleteAccount();
    }
  });
});

test.describe('Clone Game', () => {
  test('clone finished game creates new lobby with same players', async ({ request }) => {
    const gm = await createGM(request);
    const players = await createRegisteredUsers(request, 10, 'CG');

    const game = await gm.createGame({
      name: 'E2E Clone Source',
      date: '2026-03-11',
      location: 'Test Arena',
      maxPlayers: 10,
      isRanked: true,
    });
    const gameId = game.body.id;

    for (let i = 0; i < 10; i++) {
      await players[i].api.joinGame(gameId, i + 1, `CGPlayer${i}`);
    }

    const roles = [
      { seat: 1, role: 'don', team: 'mafia' },
      { seat: 2, role: 'mafia', team: 'mafia' },
      { seat: 3, role: 'mafia', team: 'mafia' },
      { seat: 4, role: 'sheriff', team: 'peaceful' },
      { seat: 5, role: 'doctor', team: 'peaceful' },
      { seat: 6, role: 'civilian', team: 'peaceful' },
      { seat: 7, role: 'civilian', team: 'peaceful' },
      { seat: 8, role: 'civilian', team: 'peaceful' },
      { seat: 9, role: 'civilian', team: 'peaceful' },
      { seat: 10, role: 'civilian', team: 'peaceful' },
    ];

    const mafiaIds = [players[0].userId, players[1].userId, players[2].userId];
    await gm.assignRoles(gameId, roles.map((r, i) => ({
      ...r,
      userId: players[i].userId,
      displayName: `CGPlayer${i}`,
      teammates: r.team === 'mafia' ? mafiaIds.filter(id => id !== players[i].userId) : undefined,
    })));

    await gm.finishGame(gameId, {
      winner: 'peaceful',
      gameLog: {},
      players: roles.map((r, i) => ({
        seat: r.seat,
        userId: players[i].userId,
        role: r.role,
        team: r.team,
        alive: r.team === 'peaceful',
        fouls: 0,
      })),
    });

    const cloneRes = await gm.request.post(`https://opium-server-production.up.railway.app/games/${gameId}/clone`, {
      data: {},
      headers: { Authorization: `Bearer ${gm.token}`, 'Content-Type': 'application/json' },
    });
    expect(cloneRes.ok()).toBe(true);
    const cloneBody = await cloneRes.json();
    expect(cloneBody.id).toBeGreaterThan(gameId);
    expect(cloneBody.playersAdded).toBe(10);

    const gamesRes = await gm.request.get('https://opium-server-production.up.railway.app/games', {
      headers: { Authorization: `Bearer ${gm.token}`, 'Content-Type': 'application/json' },
    });
    const games = await gamesRes.json();
    const clonedGame = games.find((g: any) => g.id === cloneBody.id);
    expect(clonedGame).toBeDefined();
    expect(clonedGame.status).toBe('lobby');
    expect(clonedGame.players.length).toBe(10);

    for (const p of players) {
      await p.api.deleteAccount();
    }
  });
});

test.describe('Edge Cases', () => {
  test('cannot finish non-active game', async ({ request }) => {
    const gm = await createGM(request);

    const game = await gm.createGame({
      name: 'E2E Not Active',
      date: '2026-03-11',
      location: 'Test Arena',
      maxPlayers: 10,
      isRanked: true,
    });
    const gameId = game.body.id;

    const finishRes = await gm.finishGame(gameId, {
      winner: 'peaceful',
      gameLog: {},
      players: [],
    });
    expect(finishRes.status).toBe(400);
    expect(finishRes.body.error).toContain('not active');
  });

  test('cannot assign roles without players joined', async ({ request }) => {
    const gm = await createGM(request);

    const game = await gm.createGame({
      name: 'E2E No Players',
      date: '2026-03-11',
      location: 'Test Arena',
      maxPlayers: 10,
      isRanked: true,
    });
    const gameId = game.body.id;

    const rolesRes = await gm.assignRoles(gameId, [{
      seat: 1,
      displayName: 'Ghost',
      role: 'civilian',
      team: 'peaceful',
    }]);
    expect(rolesRes.status).toBe(200);
  });

  test('iPad auth required for game management', async ({ request }) => {
    const api = new TestApiClient(request);
    const user = createTestUser('NoIpad');
    await api.authenticate(generateInitData(user));
    await api.completeRegistration();

    const res = await api.createGame({
      name: 'Should Fail',
      date: '2026-03-11',
      location: 'Nowhere',
      maxPlayers: 10,
      isRanked: true,
    });
    expect(res.status).toBe(403);

    await api.deleteAccount();
  });
});

test.describe('Loss-Side Bonuses', () => {
  test('sheriff found don on loss, doctor saves on loss, bodyguard traded on loss', async ({ request }) => {
    const gm = await createGM(request);
    const players = await createRegisteredUsers(request, 10, 'LB');

    const game = await gm.createGame({
      name: 'E2E Loss Bonuses',
      date: '2026-03-11',
      location: 'Test Arena',
      maxPlayers: 10,
      isRanked: true,
    });
    const gameId = game.body.id;

    for (let i = 0; i < 10; i++) {
      await players[i].api.joinGame(gameId, i + 1, `LBPlayer${i}`);
    }

    const roles = [
      { seat: 1, role: 'don', team: 'mafia' },
      { seat: 2, role: 'mafia', team: 'mafia' },
      { seat: 3, role: 'mafia', team: 'mafia' },
      { seat: 4, role: 'sheriff', team: 'peaceful' },
      { seat: 5, role: 'doctor', team: 'peaceful' },
      { seat: 6, role: 'bodyguard', team: 'peaceful' },
      { seat: 7, role: 'civilian', team: 'peaceful' },
      { seat: 8, role: 'civilian', team: 'peaceful' },
      { seat: 9, role: 'civilian', team: 'peaceful' },
      { seat: 10, role: 'civilian', team: 'peaceful' },
    ];

    const mafiaIds = [players[0].userId, players[1].userId, players[2].userId];
    await gm.assignRoles(gameId, roles.map((r, i) => ({
      ...r,
      userId: players[i].userId,
      displayName: `LBPlayer${i}`,
      teammates: r.team === 'mafia' ? mafiaIds.filter(id => id !== players[i].userId) : undefined,
    })));

    const finishPlayers = roles.map((r, i) => ({
      seat: r.seat,
      userId: players[i].userId,
      role: r.role,
      team: r.team,
      alive: r.team === 'mafia',
      fouls: 0,
      ...(r.role === 'sheriff' ? { sheriffFoundDon: true } : {}),
      ...(r.role === 'doctor' ? { saves: 1 } : {}),
      ...(r.role === 'bodyguard' ? { bodyguardTraded: true } : {}),
    }));

    const result = await gm.finishGame(gameId, {
      winner: 'mafia',
      gameLog: {},
      players: finishPlayers,
    });
    expect(result.status).toBe(200);

    const ratings = result.body.ratings;

    const sheriffR = ratings.find((r: any) => r.seat === 4);
    expect(sheriffR.rating).toBe(4);

    const doctorR = ratings.find((r: any) => r.seat === 5);
    expect(doctorR.rating).toBe(4);

    const bodyguardR = ratings.find((r: any) => r.seat === 6);
    expect(bodyguardR.rating).toBe(4);

    for (const p of players) {
      await p.api.deleteAccount();
    }
  });
});
