import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../prisma';
import { audit } from '../audit';
import { incrementCounter } from '../metrics';

interface UpdateProfileBody {
  displayName?: string;
  nickname?: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  avatarColorIndex?: number;
  instagramUsername?: string;
  dateOfBirth?: string;
  gender?: string;
  bio?: string;
}

interface GameHistoryQuery {
  limit?: number;
  offset?: number;
}

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply);
  });

  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.isIpad) {
      return reply.status(403).send({ error: 'This endpoint is for iPad only' });
    }

    const users = await prisma.user.findMany({
      where: { registered: true },
      orderBy: { totalRating: 'desc' },
      select: {
        id: true,
        displayName: true,
        nickname: true,
        avatarUrl: true,
        avatarEmoji: true,
        avatarColorIndex: true,
        instagramUsername: true,
        dateOfBirth: true,
        gender: true,
        bio: true,
        banned: true,
        banReason: true,
        totalRating: true,
        gamesPlayed: true,
        gamesWon: true,
        totalFouls: true,
        registered: true,
        lastSeenAt: true,
        createdAt: true,
        gamePlayers: {
          orderBy: { game: { startedAt: 'desc' } },
          take: 1,
          select: {
            game: {
              select: {
                name: true,
                startedAt: true,
              },
            },
          },
        },
      },
    });

    const result = users.map(({ gamePlayers, ...user }) => ({
      ...user,
      lastGameName: gamePlayers[0]?.game?.name ?? null,
      lastGameDate: gamePlayers[0]?.game?.startedAt ?? null,
    }));

    return reply.send(result);
  });

  fastify.get('/leaderboard', async (request: FastifyRequest<{ Querystring: { period?: string } }>, reply: FastifyReply) => {
    const users = await prisma.user.findMany({
      where: { registered: true, banned: false },
      orderBy: { totalRating: 'desc' },
      select: {
        id: true,
        displayName: true,
        nickname: true,
        avatarUrl: true,
        totalRating: true,
        gamesPlayed: true,
        gamesWon: true,
      },
    });

    const result = users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      rating: u.totalRating,
      gamesPlayed: u.gamesPlayed,
      gamesWon: u.gamesWon,
      winRate: u.gamesPlayed > 0 ? Math.round((u.gamesWon / u.gamesPlayed) * 100) : 0,
      isMe: u.id === request.userId,
    }));

    return reply.send(result);
  });

  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    request.log.info({ userId: request.userId }, 'POST /users/register');

    const reqUser = await prisma.user.findUnique({ where: { id: request.userId }, select: { banned: true, dateOfBirth: true } });
    if (reqUser?.banned) {
      request.log.warn({ userId: request.userId }, 'Registration blocked: user is banned');
      return reply.status(403).send({ error: 'Account is banned' });
    }

    if (!reqUser?.dateOfBirth || reqUser.dateOfBirth.split('.').length !== 3) {
      request.log.warn({ userId: request.userId }, 'Registration blocked: missing date of birth');
      return reply.status(400).send({ error: 'Дата рождения обязательна', code: 'MISSING_DOB' });
    }

    if (reqUser?.dateOfBirth) {
      const parts = reqUser.dateOfBirth.split('.');
      if (parts.length === 3) {
        const birthDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        if (age < 18) {
          request.log.warn({ userId: request.userId, age, dob: reqUser.dateOfBirth }, 'Registration blocked: under 18');
          return reply.status(403).send({ error: 'Регистрация доступна с 18 лет', code: 'UNDERAGE' });
        }
      }
    }

    const user = await prisma.user.update({
      where: { id: request.userId },
      data: { registered: true },
    });

    request.log.info({ userId: user.id, displayName: user.displayName }, 'User registration completed');
    audit({ action: 'user.registered', userId: user.id, ip: request.ip, source: 'mini_app', meta: { displayName: user.displayName } });
    incrementCounter('user.registrations');

    return reply.send({ success: true });
  });

  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    request.log.info({ userId: request.userId }, 'GET /users/me');
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
    });

    if (!user) {
      request.log.warn({ userId: request.userId }, 'Profile: user not found');
      return reply.status(404).send({ error: 'User not found' });
    }

    const recentRatings = await prisma.gameRating.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const avgPointsPerGame = recentRatings.length > 0
      ? Math.round(recentRatings.reduce((sum, r) => sum + r.totalPoints, 0) / recentRatings.length)
      : 0;

    const bestGameRating = recentRatings.length > 0
      ? Math.max(...recentRatings.map(r => r.totalPoints))
      : 0;

    const roleCounts: Record<string, number> = {};
    for (const r of recentRatings) {
      roleCounts[r.role] = (roleCounts[r.role] || 0) + 1;
    }
    const favoriteRole = Object.entries(roleCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    const roleAvgRatings: Record<string, { sum: number; count: number }> = {};
    for (const r of recentRatings) {
      if (!roleAvgRatings[r.role]) {
        roleAvgRatings[r.role] = { sum: 0, count: 0 };
      }
      roleAvgRatings[r.role].sum += r.totalPoints;
      roleAvgRatings[r.role].count += 1;
    }
    const bestRole = Object.entries(roleAvgRatings)
      .map(([role, { sum, count }]) => ({ role, avg: sum / count }))
      .sort((a, b) => b.avg - a.avg)[0]?.role || null;

    const ratingHistory = recentRatings
      .slice(0, 20)
      .reverse()
      .map(r => r.totalPoints);

    request.log.info({ userId: user.id, displayName: user.displayName, gamesPlayed: user.gamesPlayed, totalRating: user.totalRating }, 'Profile returned');

    return reply.send({
      id: user.id,
      nickname: user.nickname,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      avatarEmoji: user.avatarEmoji,
      avatarColorIndex: user.avatarColorIndex,
      instagramUsername: user.instagramUsername,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      bio: user.bio,
      banned: user.banned,
      banReason: user.banReason,
      totalRating: user.totalRating,
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon,
      winRate: user.gamesPlayed > 0
        ? Math.round((user.gamesWon / user.gamesPlayed) * 100)
        : 0,
      totalFouls: user.totalFouls,
      avgPointsPerGame,
      bestGameRating,
      favoriteRole,
      bestRole,
      ratingHistory,
      createdAt: user.createdAt,
    });
  });

  fastify.patch<{ Body: UpdateProfileBody }>('/me', async (request: FastifyRequest<{ Body: UpdateProfileBody }>, reply: FastifyReply) => {
    const { displayName, nickname, avatarUrl, avatarEmoji, avatarColorIndex, instagramUsername, dateOfBirth, gender, bio } = request.body;
    request.log.info({ userId: request.userId, displayName, nickname, avatarUrl, avatarEmoji, avatarColorIndex, instagramUsername, dateOfBirth, bio }, 'PATCH /users/me');

    const reqUser = await prisma.user.findUnique({ where: { id: request.userId }, select: { banned: true } });
    if (reqUser?.banned) {
      request.log.warn({ userId: request.userId }, 'Profile update blocked: user is banned');
      incrementCounter('user.profile.update.banned');
      return reply.status(403).send({ error: 'Account is banned' });
    }

    const errors: string[] = [];
    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || displayName.trim().length === 0) errors.push('displayName must be a non-empty string');
      else if (displayName.length > 50) errors.push('displayName must be 50 characters or less');
    }
    if (nickname !== undefined) {
      if (typeof nickname !== 'string') errors.push('nickname must be a string');
      else if (nickname.length > 30) errors.push('nickname must be 30 characters or less');
      else if (nickname && !/^[\w\u0400-\u04FF\s.\-]+$/u.test(nickname)) errors.push('Буквы, цифры, пробелы, точки, дефисы и _');
    }
    if (bio !== undefined) {
      if (typeof bio !== 'string') errors.push('bio must be a string');
      else if (bio.length > 200) errors.push('bio must be 200 characters or less');
    }
    if (instagramUsername !== undefined) {
      if (typeof instagramUsername !== 'string') errors.push('instagramUsername must be a string');
      else if (instagramUsername.length > 30) errors.push('instagramUsername must be 30 characters or less');
    }
    if (dateOfBirth !== undefined && dateOfBirth !== null && dateOfBirth !== '') {
      if (typeof dateOfBirth !== 'string' || !/^\d{2}\.\d{2}\.\d{4}$/.test(dateOfBirth)) {
        errors.push('dateOfBirth must be in DD.MM.YYYY format');
      }
    }
    if (gender !== undefined && gender !== null && gender !== '') {
      if (!['male', 'female'].includes(gender)) errors.push('gender must be "male" or "female"');
    }
    if (errors.length > 0) {
      return reply.status(400).send({ error: errors.join('; ') });
    }

    const updateData: Record<string, unknown> = {};
    if (displayName !== undefined) updateData.displayName = displayName.trim();
    if (nickname !== undefined) updateData.nickname = nickname;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (avatarEmoji !== undefined) updateData.avatarEmoji = avatarEmoji;
    if (avatarColorIndex !== undefined) updateData.avatarColorIndex = avatarColorIndex;
    if (instagramUsername !== undefined) updateData.instagramUsername = instagramUsername;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
    if (gender !== undefined) updateData.gender = gender;
    if (bio !== undefined) updateData.bio = bio;

    if (Object.keys(updateData).length === 0) {
      request.log.warn({ userId: request.userId }, 'Profile update: no fields provided');
      return reply.status(400).send({ error: 'No fields to update' });
    }

    const user = await prisma.user.update({
      where: { id: request.userId },
      data: updateData,
    });

    request.log.info({ userId: user.id, displayName: user.displayName }, 'Profile updated');
    audit({ action: 'user.profile.updated', userId: user.id, ip: request.ip, source: request.isIpad ? 'gm_app' : 'mini_app', meta: { fields: Object.keys(updateData) } });
    incrementCounter('user.profile.updates');

    return reply.send({
      id: user.id,
      nickname: user.nickname,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      avatarEmoji: user.avatarEmoji,
      avatarColorIndex: user.avatarColorIndex,
      instagramUsername: user.instagramUsername,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      bio: user.bio,
    });
  });

  fastify.delete('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    request.log.info({ userId: request.userId }, 'DELETE /users/me — account deletion requested');

    const user = await prisma.user.findUnique({
      where: { id: request.userId },
    });

    if (!user) {
      request.log.warn({ userId: request.userId }, 'Delete account: user not found');
      return reply.status(404).send({ error: 'User not found' });
    }

    if (user.banned) {
      request.log.warn({ userId: request.userId }, 'Account deletion blocked: user is banned');
      incrementCounter('user.account.deletion.banned');
      return reply.status(403).send({ error: 'Banned accounts cannot be deleted' });
    }

    await prisma.gameRating.deleteMany({ where: { userId: request.userId } });
    await prisma.gamePlayer.updateMany({
      where: { userId: request.userId },
      data: { userId: null },
    });
    await prisma.game.updateMany({
      where: { hostUserId: request.userId },
      data: { hostUserId: null },
    });
    await prisma.user.delete({ where: { id: request.userId } });

    request.log.info({ userId: request.userId, telegramId: Number(user.telegramId) }, 'Account deleted successfully');
    audit({ action: 'user.account.deleted', userId: request.userId, ip: request.ip, source: 'mini_app', meta: { telegramId: Number(user.telegramId), displayName: user.displayName, nickname: user.nickname } });
    incrementCounter('user.account.deletions');

    return reply.send({ success: true });
  });

  fastify.get<{ Querystring: GameHistoryQuery }>('/me/games', async (request: FastifyRequest<{ Querystring: GameHistoryQuery }>, reply: FastifyReply) => {
    const limit = Math.min(Number(request.query.limit) || 20, 100);
    const offset = Number(request.query.offset) || 0;
    request.log.info({ userId: request.userId, limit, offset }, 'GET /users/me/games');

    const gamePlayers = await prisma.gamePlayer.findMany({
      where: { userId: request.userId },
      orderBy: { game: { startedAt: 'desc' } },
      take: limit,
      skip: offset,
      include: {
        game: {
          select: {
            id: true,
            playerCount: true,
            status: true,
            winner: true,
            startedAt: true,
            finishedAt: true,
          },
        },
      },
    });

    const gameIds = gamePlayers.map(gp => gp.gameId);

    const allRatings = await prisma.gameRating.findMany({
      where: { gameId: { in: gameIds } },
    });
    const ratingsByGame = new Map<number, typeof allRatings>();
    for (const r of allRatings) {
      const arr = ratingsByGame.get(r.gameId) || [];
      arr.push(r);
      ratingsByGame.set(r.gameId, arr);
    }

    const allGamePlayers = await prisma.gamePlayer.findMany({
      where: { gameId: { in: gameIds } },
      include: {
        user: { select: { displayName: true, nickname: true, avatarUrl: true, avatarEmoji: true, avatarColorIndex: true } },
      },
    });
    const playersByGame = new Map<number, typeof allGamePlayers>();
    for (const p of allGamePlayers) {
      const arr = playersByGame.get(p.gameId) || [];
      arr.push(p);
      playersByGame.set(p.gameId, arr);
    }

    const totalGames = await prisma.gamePlayer.count({
      where: { userId: request.userId },
    });

    const games = gamePlayers.map(gp => {
      const myRatings = ratingsByGame.get(gp.gameId) || [];
      const myRating = myRatings.find(r => r.userId === request.userId);
      const mafiaRoles = ['don', 'mafia', 'framer', 'enforcer'];
      const isMafia = mafiaRoles.includes(gp.role);
      const won = gp.game.winner
        ? (gp.game.winner === 'mafia' && isMafia) ||
          (gp.game.winner === 'peaceful' && !isMafia && gp.role !== 'werewolf') ||
          (gp.game.winner === 'werewolf' && gp.role === 'werewolf')
        : null;

      const gamePlrs = playersByGame.get(gp.gameId) || [];
      const players = gamePlrs.map(p => {
        const pRating = myRatings.find(r => r.userId === p.userId);
        return {
          seat: p.seatNumber,
          name: p.displayName,
          nickname: p.user?.nickname || null,
          role: p.role,
          alive: p.isAlive,
          fouls: p.fouls,
          userId: p.userId,
          avatarUrl: p.user?.avatarUrl || null,
          avatarEmoji: p.user?.avatarEmoji || null,
          avatarColorIndex: p.user?.avatarColorIndex ?? null,
          ratingChange: pRating?.totalPoints ?? 0,
        };
      }).sort((a, b) => b.ratingChange - a.ratingChange);

      return {
        gameId: gp.game.id,
        playerCount: gp.game.playerCount,
        status: gp.game.status,
        winner: gp.game.winner,
        seat: gp.seatNumber,
        role: gp.role,
        alive: gp.isAlive,
        fouls: gp.fouls,
        deathReason: gp.deathReason,
        deathDay: gp.deathDay,
        won,
        rating: myRating
          ? {
              total: myRating.totalPoints,
              base: myRating.basePoints,
              bonus: myRating.bonusPoints,
              penalty: myRating.penaltyPoints,
              breakdown: myRating.breakdown,
            }
          : null,
        players,
        startedAt: gp.game.startedAt,
        finishedAt: gp.game.finishedAt,
      };
    });

    return reply.send({
      games,
      total: totalGames,
      limit,
      offset,
    });
  });

  fastify.delete('/test-cleanup', async (request, reply) => {
    if (!request.isIpad) {
      return reply.status(403).send({ error: 'This endpoint is for iPad only' });
    }

    const TEST_TELEGRAM_ID_MIN = BigInt(900000000);

    const testUsers = await prisma.user.findMany({
      where: { telegramId: { gte: TEST_TELEGRAM_ID_MIN } },
      select: { id: true, telegramId: true },
    });

    if (testUsers.length === 0) {
      return reply.send({ deleted: 0 });
    }

    const userIds = testUsers.map(u => u.id);

    const hostedGames = await prisma.game.findMany({
      where: { hostUserId: { in: userIds } },
      select: { id: true },
    });
    const hostedGameIds = hostedGames.map(g => g.id);

    if (hostedGameIds.length > 0) {
      await prisma.gameState.deleteMany({ where: { gameId: { in: hostedGameIds } } });
      await prisma.gameBan.deleteMany({ where: { gameId: { in: hostedGameIds } } });
      await prisma.gameRating.deleteMany({ where: { gameId: { in: hostedGameIds } } });
      await prisma.gamePlayer.deleteMany({ where: { gameId: { in: hostedGameIds } } });
      await prisma.game.deleteMany({ where: { id: { in: hostedGameIds } } });
    }

    await prisma.gameBan.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { bannedBy: { in: userIds } }] } });
    await prisma.gameRating.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.gamePlayer.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });

    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    request.log.info({ count: testUsers.length, gamesCleaned: hostedGameIds.length }, 'Test data cleaned up');
    return reply.send({ deleted: testUsers.length, gamesCleaned: hostedGameIds.length });
  });

  fastify.post<{ Params: { id: string }; Body: { reason?: string } }>('/:id/ban', async (request, reply) => {
    if (!request.isIpad) {
      return reply.status(403).send({ error: 'This endpoint is for iPad only' });
    }

    const userId = parseInt(request.params.id, 10);
    if (isNaN(userId)) return reply.status(400).send({ error: 'Invalid user ID' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    if (user.banned) return reply.status(400).send({ error: 'User is already banned' });

    const reason = (request.body as any)?.reason || null;

    await prisma.user.update({
      where: { id: userId },
      data: {
        banned: true,
        banReason: reason,
        bannedAt: new Date(),
        bannedBy: request.userId,
      },
    });

    request.log.info({ userId, reason, bannedBy: request.userId }, 'User banned globally');
    audit({ action: 'user.banned', userId: request.userId, targetId: userId, ip: request.ip, source: 'gm_app', meta: { reason, displayName: user.displayName, telegramId: Number(user.telegramId) } });
    incrementCounter('user.bans');

    return reply.send({ success: true });
  });

  fastify.post<{ Params: { id: string } }>('/:id/unban', async (request, reply) => {
    if (!request.isIpad) {
      return reply.status(403).send({ error: 'This endpoint is for iPad only' });
    }

    const userId = parseInt(request.params.id, 10);
    if (isNaN(userId)) return reply.status(400).send({ error: 'Invalid user ID' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    if (!user.banned) return reply.status(400).send({ error: 'User is not banned' });

    await prisma.user.update({
      where: { id: userId },
      data: {
        banned: false,
        banReason: null,
        bannedAt: null,
        bannedBy: null,
      },
    });

    request.log.info({ userId, unbannedBy: request.userId }, 'User unbanned');
    audit({ action: 'user.unbanned', userId: request.userId, targetId: userId, ip: request.ip, source: 'gm_app', meta: { displayName: user.displayName, telegramId: Number(user.telegramId) } });
    incrementCounter('user.unbans');

    return reply.send({ success: true });
  });
}
