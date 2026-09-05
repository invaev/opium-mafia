import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../prisma';
import { redis } from '../redis';
import {
  sendToPlayer,
  sendToUser,
  broadcastToGame,
  broadcastToAll,
  cleanupGameConnections,
} from '../ws/handler';
import { calculateRating, RatingInput, RatingResult } from '../engine/rating';
import { notifyGameCreated, notifyGameCancelled, notifyGameUpdated, sendNotification } from '../bot';
import { audit } from '../audit';
import { incrementCounter } from '../metrics';

interface CreateGameBody {
  name: string;
  date: string;
  time?: string;
  location: string;
  locationUrl?: string;
  cost?: number;
  maxPlayers: number;
  isRanked: boolean;
  photoData?: string;
  hostTelegram?: string;
}

interface JoinGameBody {
  seatNumber: number;
  displayName: string;
  guests?: number;
}

interface RolesBody {
  players: Array<{
    seat: number;
    userId?: number;
    telegramId?: number;
    displayName: string;
    role: string;
    team: string;
    teammates?: number[];
  }>;
}

interface NightBody {
  nightNumber: number;
  actions: {
    courtesanTarget?: number;
    mafiaTarget?: number;
    enforcerUsed: boolean;
    framerTarget?: number;
    sheriffTarget?: number;
    seerTargets?: [number, number];
    doctorTarget?: number;
    bodyguardTarget?: number;
    maniacTarget?: number;
    werewolfTarget?: number;
  };
  results: {
    deaths: Array<{ seat: number; cause: string }>;
    saves: Array<{ seat: number; savedBy: string }>;
    sheriffCheck?: { seat: number; result: string; isFramed: boolean };
    seerCompare?: { seats: [number, number]; result: string };
    blocked?: number;
    werewolfActivated?: boolean;
  };
}

interface DayBody {
  dayNumber: number;
  event: string;
  data: Record<string, unknown>;
}

interface FinishBody {
  winner: string;
  gameLog: Record<string, unknown>;
  players: Array<{
    seat: number;
    userId?: number;
    role: string;
    team: string;
    alive: boolean;
    fouls: number;
    deathReason?: string;
    deathDay?: number;
    techKill?: boolean;
    saves?: number;
    bodyguardTraded?: boolean;
    sheriffFoundDon?: boolean;
    sheriffShotMafia?: boolean;
    framerSuccessful?: boolean;
    enforcerUsed?: boolean;
    maniacKills?: number;
    werewolfActivated?: boolean;
  }>;
}

function parseGameId(idStr: string, reply: FastifyReply): number | null {
  const id = Number(idStr);
  if (!id || isNaN(id) || !Number.isInteger(id)) {
    reply.status(404).send({ error: 'Game not found' });
    return null;
  }
  return id;
}

function requireIpad(request: FastifyRequest, reply: FastifyReply): boolean {
  if (!request.isIpad) {
    reply.status(403).send({ error: 'This endpoint is for iPad only' });
    return false;
  }
  return true;
}

export default async function gameRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply);
  });

  fastify.get('/', async (request, reply) => {
    if (!request.isIpad) {
      const reqUser = await prisma.user.findUnique({ where: { id: request.userId }, select: { banned: true } });
      if (reqUser?.banned) return reply.send([]);
    }

    const games = await prisma.game.findMany({
      orderBy: { id: 'desc' },
      take: 20,
      include: {
        players: {
          select: {
            seatNumber: true,
            displayName: true,
            userId: true,
            guests: true,
            role: true,
            isAlive: true,
            fouls: true,
            deathReason: true,
            deathDay: true,
            user: {
              select: { avatarUrl: true, avatarEmoji: true, avatarColorIndex: true, totalRating: true, gamesPlayed: true, gamesWon: true, bio: true, instagramUsername: true, nickname: true },
            },
          },
          orderBy: { seatNumber: 'asc' },
        },
        ratings: {
          select: {
            userId: true,
            role: true,
            totalPoints: true,
            breakdown: true,
          },
        },
        host: {
          select: { displayName: true, nickname: true },
        },
      },
    });

    const result = games.map((g) => {
      const log = (g.gameLog as Record<string, unknown>) || {};
      return {
        id: g.id,
        title: log.name || g.name || `Game #${g.id}`,
        date: (log.date as string) || '',
        time: (log.time as string) || '',
        place: (log.location as string) || '',
        placeUrl: (log.locationUrl as string) || null,
        price: log.cost ? `${log.cost} PLN` : '',
        spots: g.playerCount,
        taken: g.players.reduce((sum, p) => sum + 1 + (p.guests || 0), 0),
        rated: (log.isRanked as boolean) ?? true,
        status: g.status,
        winner: g.winner || null,
        photoData: g.photoData || null,
        hostTelegram: (log.hostTelegram as string) || null,
        host: {
          name: g.host?.displayName || 'GM',
          nick: (log.hostTelegram as string) || g.host?.nickname || '',
        },
        players: g.players.map((p) => {
          const gameRating = g.status === 'finished' && p.userId
            ? g.ratings.find(r => r.userId === p.userId)
            : null;
          return {
            name: p.displayName,
            nick: p.user?.nickname || '',
            seat: p.seatNumber,
            userId: p.userId,
            guests: p.guests,
            avatarUrl: p.user?.avatarUrl || null,
            avatarEmoji: p.user?.avatarEmoji || null,
            avatarColorIndex: p.user?.avatarColorIndex ?? null,
            rating: p.user?.totalRating || 0,
            games: p.user?.gamesPlayed || 0,
            winRate: p.user && p.user.gamesPlayed > 0 ? `${Math.round((p.user.gamesWon / p.user.gamesPlayed) * 100)}%` : '0%',
            bio: p.user?.bio || '',
            insta: p.user?.instagramUsername || '',
            role: g.status === 'finished' ? p.role : undefined,
            alive: g.status === 'finished' ? p.isAlive : undefined,
            fouls: g.status === 'finished' ? p.fouls : undefined,
            deathReason: g.status === 'finished' ? p.deathReason : undefined,
            deathDay: g.status === 'finished' ? p.deathDay : undefined,
            gameRating: gameRating ? gameRating.totalPoints : undefined,
            ratingBreakdown: gameRating ? gameRating.breakdown : undefined,
          };
        }),
      };
    });

    result.sort((a, b) => {
      const parseDateTime = (d: string, t: string): number => {
        if (!d) return Infinity;
        const parts = d.split('.');
        if (parts.length !== 3) return Infinity;
        const iso = `${parts[2]}-${parts[1]}-${parts[0]}T${t || '00:00'}:00`;
        const ts = new Date(iso).getTime();
        return isNaN(ts) ? Infinity : ts;
      };
      return parseDateTime(a.date, a.time) - parseDateTime(b.date, b.time);
    });

    return reply.send(result);
  });

  fastify.post<{ Body: CreateGameBody }>('/', async (request, reply) => {
    if (!requireIpad(request, reply)) return;

    const { name, maxPlayers, isRanked } = request.body;
    request.log.info({ name, maxPlayers, isRanked }, 'Creating new game');

    if (maxPlayers < 10 || maxPlayers > 20) {
      return reply.status(400).send({ error: 'Player count must be between 10 and 20' });
    }

    const game = await prisma.game.create({
      data: {
        hostUserId: request.userId,
        playerCount: maxPlayers,
        status: 'lobby',
        photoData: request.body.photoData || null,
        gameLog: {
          name,
          date: request.body.date,
          time: request.body.time || null,
          location: request.body.location,
          locationUrl: request.body.locationUrl || null,
          cost: request.body.cost || 0,
          isRanked,
          hostTelegram: request.body.hostTelegram || null,
        },
      },
    });

    await redis.set(
      `game:${game.id}:status`,
      JSON.stringify({
        id: game.id,
        status: 'lobby',
        playerCount: maxPlayers,
        phase: 'lobby',
        dayNumber: 0,
      }),
      'EX',
      86400
    );

    request.log.info({ gameId: game.id, maxPlayers }, 'Game created');
    audit({ action: 'game.created', userId: request.userId, gameId: game.id, ip: request.ip, source: 'gm_app', meta: { name, maxPlayers, isRanked, date: request.body.date, time: request.body.time, location: request.body.location, cost: request.body.cost } });
    incrementCounter('game.created');

    notifyGameCreated({
      name,
      date: request.body.date,
      time: request.body.time,
      location: request.body.location,
      locationUrl: request.body.locationUrl,
      cost: request.body.cost,
      maxPlayers,
      isRanked,
      photoData: request.body.photoData,
    }).catch(err => request.log.error({ err }, 'Failed to send game notifications'));

    broadcastToAll({ type: 'games:refresh' });

    return reply.status(201).send({
      id: game.id,
      status: 'lobby',
      playerCount: maxPlayers,
    });
  });

  fastify.post<{ Params: { id: string }; Body: JoinGameBody }>('/:id/join', async (request, reply) => {
    const id = parseGameId(request.params.id, reply);
    if (!id) return;
    request.log.info({ gameId: id, userId: request.userId }, 'Player joining game');

    const joiningUser = await prisma.user.findUnique({ where: { id: request.userId }, select: { banned: true } });
    if (joiningUser?.banned) {
      request.log.warn({ gameId: id, userId: request.userId }, 'Game join blocked: user is globally banned');
      incrementCounter('game.join.banned');
      return reply.status(403).send({ error: 'Your account is banned' });
    }

    const ban = await prisma.gameBan.findUnique({
      where: { gameId_userId: { gameId: id, userId: request.userId } },
    });
    if (ban) {
      return reply.status(403).send({ error: 'You are banned from this game' });
    }

    const guestsCount = Math.max(0, Number((request.body as any)?.guests) || 0);

    let result: { id: number; gameId: number; seatNumber: number; displayName: string; guests: number };
    try {
      result = await prisma.$transaction(async (tx) => {
        const game = await tx.game.findUnique({
          where: { id },
          include: { players: true },
        });
        if (!game) throw Object.assign(new Error('Game not found'), { statusCode: 404 });
        if (game.status !== 'lobby') throw Object.assign(new Error('Game is not in lobby phase'), { statusCode: 400 });

        const existingPlayer = game.players.find(p => p.userId === request.userId);
        if (existingPlayer) throw Object.assign(new Error('You already joined this game'), { statusCode: 400 });

        const log = (game.gameLog as Record<string, unknown>) || {};
        const hostTelegram = ((log.hostTelegram as string) || '').replace(/^@/, '').toLowerCase();
        if (hostTelegram) {
          const joiningUser = await tx.user.findUnique({ where: { id: request.userId } });
          const joiningUsername = (joiningUser?.nickname || '').replace(/^@/, '').toLowerCase();
          if (joiningUsername && joiningUsername === hostTelegram) {
            throw Object.assign(new Error('Game master cannot join as a player'), { statusCode: 400 });
          }
        }

        const currentTaken = game.players.reduce((sum, p) => sum + 1 + (p.guests || 0), 0);
        const spotsNeeded = 1 + guestsCount;
        if (currentTaken + spotsNeeded > game.playerCount) {
          throw Object.assign(new Error('Not enough spots'), { statusCode: 400 });
        }

        const takenSeats = new Set(game.players.map(p => p.seatNumber));
        let seatNumber = 1;
        while (takenSeats.has(seatNumber)) seatNumber++;

        const user = await tx.user.findUnique({ where: { id: request.userId } });
        const displayName = (request.body as any)?.displayName || user?.displayName || 'Player';

        const player = await tx.gamePlayer.create({
          data: {
            gameId: id,
            userId: request.userId,
            seatNumber,
            displayName,
            guests: guestsCount,
          },
        });

        return { id: player.id, gameId: id, seatNumber, displayName, guests: guestsCount };
      }, { isolationLevel: 'Serializable' });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      const message = err.statusCode ? err.message : 'Failed to join game';
      request.log.warn({ gameId: id, userId: request.userId, error: err.message }, `Join failed: ${err.message}`);
      return reply.status(statusCode).send({ error: message });
    }

    request.log.info({ gameId: id, playerId: result.id, seatNumber: result.seatNumber, displayName: result.displayName, guests: result.guests }, 'Player joined game');
    audit({ action: 'game.player.joined', userId: request.userId, gameId: id, ip: request.ip, source: 'mini_app', meta: { seat: result.seatNumber, guests: result.guests } });
    incrementCounter('game.player.joined');

    broadcastToGame(id, {
      type: 'player:joined',
      data: { name: result.displayName, gameId: id },
    });

    broadcastToAll({ type: 'games:refresh' });

    return reply.status(201).send(result);
  });

  fastify.post<{ Params: { id: string } }>('/:id/leave', async (request, reply) => {
    const id = parseGameId(request.params.id, reply);
    if (!id) return;
    request.log.info({ gameId: id, userId: request.userId }, 'Player leaving game');

    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) return reply.status(404).send({ error: 'Game not found' });
    if (game.status !== 'lobby') {
      return reply.status(400).send({ error: 'Cannot leave a game that is already in progress' });
    }

    const player = await prisma.gamePlayer.findFirst({
      where: { gameId: id, userId: request.userId },
    });
    if (!player) {
      return reply.status(404).send({ error: 'You are not in this game' });
    }

    await prisma.gamePlayer.delete({ where: { id: player.id } });

    request.log.info({ gameId: id, userId: request.userId }, 'Player left game');
    audit({ action: 'game.player.left', userId: request.userId, gameId: id, ip: request.ip, source: 'mini_app', meta: { seat: player.seatNumber, displayName: player.displayName } });
    incrementCounter('game.player.left');

    broadcastToGame(id, {
      type: 'player:left',
      data: { name: player.displayName, gameId: id },
    });

    broadcastToAll({ type: 'games:refresh' });

    return reply.send({ success: true });
  });

  fastify.post<{ Params: { id: string } }>('/:id/start', async (request, reply) => {
    if (!requireIpad(request, reply)) return;

    const id = parseGameId(request.params.id, reply);
    if (!id) return;
    request.log.info({ gameId: id }, 'Starting game');

    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) {
      return reply.status(404).send({ error: 'Game not found' });
    }
    if (game.status !== 'lobby') {
      return reply.status(400).send({ error: 'Game is not in lobby status' });
    }

    await prisma.game.update({
      where: { id },
      data: { status: 'active', startedAt: new Date() },
    });

    broadcastToAll({ type: 'games:refresh' });

    request.log.info({ gameId: id }, 'Game started');
    audit({ action: 'game.started', userId: request.userId, gameId: id, ip: request.ip, source: 'gm_app', meta: { playerCount: game.playerCount } });
    incrementCounter('game.started');
    return reply.send({ success: true });
  });

  fastify.put<{ Params: { id: string }; Body: Partial<CreateGameBody> }>('/:id', async (request, reply) => {
    if (!requireIpad(request, reply)) return;

    const id = parseGameId(request.params.id, reply);
    if (!id) return;
    request.log.info({ gameId: id, body: request.body }, 'Updating game');

    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) {
      return reply.status(404).send({ error: 'Game not found' });
    }
    if (game.status === 'finished') {
      return reply.status(400).send({ error: 'Cannot update a finished game' });
    }

    const existingLog = (game.gameLog as Record<string, unknown>) || {};
    const body = request.body;

    const updatedLog: Record<string, unknown> = {
      ...existingLog,
      ...(body.name !== undefined && { name: body.name }),
      ...(body.date !== undefined && { date: body.date }),
      ...(body.time !== undefined && { time: body.time }),
      ...(body.location !== undefined && { location: body.location }),
      ...(body.locationUrl !== undefined && { locationUrl: body.locationUrl }),
      ...(body.cost !== undefined && { cost: body.cost }),
      ...(body.isRanked !== undefined && { isRanked: body.isRanked }),
      ...((body as any).hostTelegram !== undefined && { hostTelegram: (body as any).hostTelegram }),
    };

    const updateData: Record<string, unknown> = {
      gameLog: updatedLog as any,
    };
    if (body.maxPlayers !== undefined) {
      updateData.playerCount = body.maxPlayers;
    }
    if (body.photoData !== undefined) {
      updateData.photoData = body.photoData || null;
    }

    await prisma.game.update({ where: { id }, data: updateData as any });

    const finalLog = updatedLog;
    const photoForNotification = body.photoData !== undefined ? (body.photoData || null) : (game.photoData || null);
    notifyGameUpdated({
      name: (finalLog.name as string) || game.name || `Game #${id}`,
      date: (finalLog.date as string) || '',
      time: (finalLog.time as string) || undefined,
      location: (finalLog.location as string) || '',
      locationUrl: (finalLog.locationUrl as string) || undefined,
      cost: (finalLog.cost as number) || 0,
      maxPlayers: (updateData.playerCount as number) || game.playerCount,
      isRanked: (finalLog.isRanked as boolean) ?? true,
      photoData: photoForNotification,
    }).catch(err => request.log.error({ err }, 'Failed to send update notifications'));

    request.log.info({ gameId: id }, 'Game updated');
    audit({ action: 'game.updated', userId: request.userId, gameId: id, ip: request.ip, source: 'gm_app', meta: { fields: Object.keys(request.body || {}) } });
    incrementCounter('game.updated');

    broadcastToAll({ type: 'games:refresh' });

    return reply.send({ success: true });
  });

  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    if (!requireIpad(request, reply)) return;

    const id = parseGameId(request.params.id, reply);
    if (!id) return;
    request.log.info({ gameId: id }, 'Deleting game');

    const game = await prisma.game.findUnique({
      where: { id },
      include: { players: true },
    });
    if (!game) {
      return reply.status(404).send({ error: 'Game not found' });
    }
    if (game.status === 'finished') {
      return reply.status(400).send({ error: 'Cannot delete a finished game' });
    }

    const log = (game.gameLog as Record<string, unknown>) || {};
    const gameName = (log.name as string) || game.name || `Game #${game.id}`;
    const gameDate = (log.date as string) || '';
    const gameTime = (log.time as string) || '';

    await prisma.game.update({ where: { id }, data: { status: 'cancelled' } });

    await redis.del(`game:${id}:status`);
    await redis.del(`game:${id}:roles`);
    cleanupGameConnections(id);

    notifyGameCancelled({ name: gameName, date: gameDate, time: gameTime, photoData: game.photoData || null })
      .catch(err => request.log.error({ err }, 'Failed to send cancellation notifications'));

    request.log.info({ gameId: id, gameName }, 'Game deleted');
    audit({ action: 'game.deleted', userId: request.userId, gameId: id, ip: request.ip, source: 'gm_app', meta: { gameName, gameDate, gameTime } });
    incrementCounter('game.deleted');

    broadcastToAll({ type: 'games:refresh' });

    return reply.send({ success: true });
  });

  fastify.post<{ Params: { id: string }; Body: RolesBody }>('/:id/roles', async (request, reply) => {
    if (!requireIpad(request, reply)) return;

    const id = parseGameId(request.params.id, reply);
    if (!id) return;
    const { players } = request.body;
    request.log.info({ gameId: id, playerCount: players.length, roles: players.map(p => ({ seat: p.seat, role: p.role })) }, 'Assigning roles');

    if (!players || !Array.isArray(players) || players.length === 0) {
      return reply.status(400).send({ error: 'Players array is required' });
    }

    const VALID_ROLES = ['don', 'mafia', 'framer', 'enforcer', 'sheriff', 'doctor', 'hooker', 'maniac', 'bodyguard', 'seer', 'werewolf', 'civilian'];
    for (const p of players) {
      if (!p.role || !VALID_ROLES.includes(p.role)) {
        return reply.status(400).send({ error: `Invalid role "${p.role}" for seat ${p.seat}` });
      }
      if (!p.displayName || typeof p.displayName !== 'string') {
        return reply.status(400).send({ error: `Missing displayName for seat ${p.seat}` });
      }
    }

    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) {
      request.log.warn({ gameId: id }, 'Roles failed: game not found');
      return reply.status(404).send({ error: 'Game not found' });
    }
    if (game.status !== 'lobby') {
      request.log.warn({ gameId: id, status: game.status }, 'Roles failed: game not in lobby');
      return reply.status(400).send({ error: 'Game is not in lobby status' });
    }

    const updateData: Record<string, unknown> = { status: 'active' };
    if (players.length !== game.playerCount) {
      request.log.info({ gameId: id, expected: game.playerCount, actual: players.length }, 'Adjusting playerCount to match actual players');
      updateData.playerCount = players.length;
    }

    await prisma.game.update({
      where: { id },
      data: updateData,
    });

    for (const p of players) {
      const existingPlayer = p.userId
        ? await prisma.gamePlayer.findFirst({ where: { gameId: id, userId: p.userId } })
        : await prisma.gamePlayer.findFirst({ where: { gameId: id, seatNumber: p.seat } });

      if (existingPlayer) {
        await prisma.gamePlayer.update({
          where: { id: existingPlayer.id },
          data: {
            role: p.role,
            seatNumber: p.seat,
            displayName: p.displayName,
          },
        });
      } else {
        await prisma.gamePlayer.create({
          data: {
            gameId: id,
            userId: p.userId || null,
            seatNumber: p.seat,
            displayName: p.displayName,
            role: p.role,
          },
        });
      }

      if (p.userId) {
        sendToPlayer(id, p.userId, {
          type: 'role:assigned',
          data: {
            role: p.role,
            team: p.team,
            teammates: p.teammates || undefined,
          },
        });
      }
    }

    const roleMap: Record<number, string> = {};
    for (const p of players) {
      roleMap[p.seat] = p.role;
    }
    await redis.set(`game:${id}:roles`, JSON.stringify(roleMap), 'EX', 86400);

    await redis.set(
      `game:${id}:status`,
      JSON.stringify({
        id,
        status: 'active',
        playerCount: game.playerCount,
        phase: 'night0',
        dayNumber: 0,
      }),
      'EX',
      86400
    );

    broadcastToAll({ type: 'games:refresh' });

    request.log.info({ gameId: id, rolesAssigned: players.length }, 'Roles assigned, game now active');
    audit({ action: 'game.roles.assigned', userId: request.userId, gameId: id, ip: request.ip, source: 'gm_app', meta: { playerCount: players.length, roles: players.map(p => ({ seat: p.seat, role: p.role })) } });
    incrementCounter('game.roles.assigned');

    return reply.send({ success: true, rolesAssigned: players.length });
  });

  fastify.post<{ Params: { id: string }; Body: NightBody }>('/:id/night', async (request, reply) => {
    if (!requireIpad(request, reply)) return;

    const id = parseGameId(request.params.id, reply);
    if (!id) return;
    const { nightNumber, actions, results } = request.body;
    request.log.info({ gameId: id, nightNumber, deaths: results.deaths, saves: results.saves }, 'Night results received');

    const game = await prisma.game.findUnique({
      where: { id },
      include: { players: true },
    });
    if (!game) {
      request.log.warn({ gameId: id }, 'Night failed: game not found');
      return reply.status(404).send({ error: 'Game not found' });
    }
    if (game.status !== 'active') {
      request.log.warn({ gameId: id, status: game.status }, 'Night failed: game not active');
      return reply.status(400).send({ error: 'Game is not active' });
    }

    for (const death of results.deaths) {
      const player = game.players.find(p => p.seatNumber === death.seat);
      if (player) {
        await prisma.gamePlayer.update({
          where: { id: player.id },
          data: {
            isAlive: false,
            deathReason: death.cause,
            deathDay: nightNumber,
          },
        });
      }
    }

    const currentLog = (game.gameLog as Record<string, unknown>) || {};
    const nightLogs = (currentLog.nights as Array<unknown>) || [];
    nightLogs.push({ nightNumber, actions, results });
    await prisma.game.update({
      where: { id },
      data: {
        gameLog: { ...currentLog, nights: nightLogs } as any,
      },
    });

    if (results.sheriffCheck) {
      const sheriffPlayer = game.players.find(p => p.role === 'sheriff' && p.isAlive);
      if (sheriffPlayer?.userId) {
        sendToPlayer(id, sheriffPlayer.userId, {
          type: 'night:result',
          data: {
            message: `Check result: Seat ${results.sheriffCheck.seat} is ${results.sheriffCheck.result}`,
            checkResult: results.sheriffCheck.result,
          },
        });
      }
    }

    if (results.seerCompare) {
      const seerPlayer = game.players.find(p => p.role === 'seer' && p.isAlive);
      if (seerPlayer?.userId) {
        sendToPlayer(id, seerPlayer.userId, {
          type: 'night:result',
          data: {
            message: `Compare result: Seats ${results.seerCompare.seats[0]} and ${results.seerCompare.seats[1]} are ${results.seerCompare.result}`,
            compareResult: results.seerCompare.result,
          },
        });
      }
    }

    if (results.blocked) {
      const blockedPlayer = game.players.find(p => p.seatNumber === results.blocked && p.isAlive);
      if (blockedPlayer?.userId) {
        sendToPlayer(id, blockedPlayer.userId, {
          type: 'night:result',
          data: {
            message: 'Your action was blocked tonight',
            blocked: true,
          },
        });
      }
    }

    const deathMessages = results.deaths.map(d => {
      const player = game.players.find(p => p.seatNumber === d.seat);
      return `${player?.displayName || `Seat ${d.seat}`} was eliminated`;
    });

    const saveMessages = results.saves.map(s => {
      const player = game.players.find(p => p.seatNumber === s.seat);
      return `${player?.displayName || `Seat ${s.seat}`} was saved`;
    });

    broadcastToGame(id, {
      type: 'day:started',
      data: {
        dayNumber: nightNumber + 1,
        deaths: deathMessages,
        saves: saveMessages,
      },
    });

    await redis.set(
      `game:${id}:status`,
      JSON.stringify({
        id,
        status: 'active',
        playerCount: game.playerCount,
        phase: 'announce',
        dayNumber: nightNumber + 1,
      }),
      'EX',
      86400
    );

    request.log.info({ gameId: id, nightNumber }, 'Night processed, transitioning to day');
    audit({ action: 'game.night.resolved', userId: request.userId, gameId: id, ip: request.ip, source: 'gm_app', meta: { nightNumber, deaths: results.deaths?.length || 0, saves: results.saves?.length || 0 } });
    incrementCounter('game.night.resolved');

    return reply.send({ success: true, nightNumber });
  });

  fastify.post<{ Params: { id: string }; Body: DayBody }>('/:id/day', async (request, reply) => {
    if (!requireIpad(request, reply)) return;

    const id = parseGameId(request.params.id, reply);
    if (!id) return;
    const { dayNumber, event, data } = request.body;
    request.log.info({ gameId: id, dayNumber, event, data }, 'Day event received');

    const game = await prisma.game.findUnique({
      where: { id },
      include: { players: true },
    });
    if (!game) {
      request.log.warn({ gameId: id }, 'Day event failed: game not found');
      return reply.status(404).send({ error: 'Game not found' });
    }
    if (game.status !== 'active') {
      request.log.warn({ gameId: id, status: game.status }, 'Day event failed: game not active');
      return reply.status(400).send({ error: 'Game is not active' });
    }

    switch (event) {
      case 'timer': {
        broadcastToGame(id, {
          type: 'day:timer',
          data: {
            phase: data.phase as string,
            secondsLeft: data.secondsLeft as number,
          },
        });
        break;
      }

      case 'nomination': {
        const seat = data.seat as number;
        const player = game.players.find(p => p.seatNumber === seat);
        broadcastToGame(id, {
          type: 'day:nomination',
          data: {
            seat,
            name: player?.displayName || `Seat ${seat}`,
          },
        });
        break;
      }

      case 'vote': {
        broadcastToGame(id, {
          type: 'day:vote',
          data: {
            candidates: data.candidates as number[],
            results: data.results as Record<number, number>,
          },
        });
        break;
      }

      case 'elimination': {
        const elimSeat = data.seat as number;
        const elimPlayer = game.players.find(p => p.seatNumber === elimSeat);
        const elimReason = data.reason as string;

        if (elimPlayer) {
          await prisma.gamePlayer.update({
            where: { id: elimPlayer.id },
            data: {
              isAlive: false,
              deathReason: elimReason,
              deathDay: dayNumber,
            },
          });
        }

        broadcastToGame(id, {
          type: 'player:eliminated',
          data: {
            seat: elimSeat,
            name: elimPlayer?.displayName || `Seat ${elimSeat}`,
            role: elimPlayer?.role || 'civilian',
          },
        });
        break;
      }

      case 'foul': {
        const foulSeat = data.seat as number;
        const foulPlayer = game.players.find(p => p.seatNumber === foulSeat);

        if (foulPlayer) {
          const newFouls = foulPlayer.fouls + 1;
          const isTechKill = newFouls >= 3;

          await prisma.gamePlayer.update({
            where: { id: foulPlayer.id },
            data: {
              fouls: newFouls,
              isAlive: isTechKill ? false : foulPlayer.isAlive,
              deathReason: isTechKill ? 'techKill' : foulPlayer.deathReason,
              deathDay: isTechKill ? dayNumber : foulPlayer.deathDay,
            },
          });

          if (isTechKill) {
            broadcastToGame(id, {
              type: 'player:eliminated',
              data: {
                seat: foulSeat,
                name: foulPlayer.displayName,
                role: foulPlayer.role,
              },
            });
          }
        }
        break;
      }

      default:
        request.log.warn({ gameId: id, event }, 'Unknown day event type');
        return reply.status(400).send({ error: `Unknown day event: ${event}` });
    }

    const currentLog = (game.gameLog as Record<string, unknown>) || {};
    const dayLogs = (currentLog.days as Array<unknown>) || [];
    dayLogs.push({ dayNumber, event, data, timestamp: new Date().toISOString() });
    await prisma.game.update({
      where: { id },
      data: {
        gameLog: { ...currentLog, days: dayLogs } as any,
      },
    });

    let phase = 'opium';
    if (event === 'nomination') phase = 'defense';
    if (event === 'vote') phase = 'voting';
    if (event === 'elimination') phase = 'lastWord';

    await redis.set(
      `game:${id}:status`,
      JSON.stringify({
        id,
        status: 'active',
        playerCount: game.playerCount,
        phase,
        dayNumber,
      }),
      'EX',
      86400
    );

    request.log.info({ gameId: id, dayNumber, event, phase }, 'Day event processed');

    return reply.send({ success: true });
  });

  fastify.post<{ Params: { id: string }; Body: FinishBody }>('/:id/finish', async (request, reply) => {
    if (!requireIpad(request, reply)) return;

    const id = parseGameId(request.params.id, reply);
    if (!id) return;
    const { winner, gameLog, players } = request.body;
    if (!winner || !['peaceful', 'mafia', 'werewolf'].includes(winner)) {
      return reply.status(400).send({ error: 'Invalid winner: must be peaceful, mafia, or werewolf' });
    }
    if (!players || !Array.isArray(players) || players.length === 0) {
      return reply.status(400).send({ error: 'Players array is required' });
    }
    request.log.info({ gameId: id, winner, playerCount: players.length }, 'Finishing game');

    const game = await prisma.game.findUnique({
      where: { id },
      include: { players: true },
    });
    if (!game) {
      request.log.warn({ gameId: id }, 'Finish failed: game not found');
      return reply.status(404).send({ error: 'Game not found' });
    }
    if (game.status !== 'active') {
      request.log.warn({ gameId: id, status: game.status }, 'Finish failed: game not active');
      return reply.status(400).send({ error: 'Game is not active' });
    }

    const existingLog = (game.gameLog as Record<string, unknown>) || {};
    await prisma.game.update({
      where: { id },
      data: {
        status: 'finished',
        winner,
        finishedAt: new Date(),
        gameLog: { ...existingLog, ...gameLog, finishData: players },
      },
    });

    const roleIcons: Record<string, string> = {
      don: '🎩', mafia: '🔫', framer: '🎭', enforcer: '💪',
      sheriff: '🔍', doctor: '💊', hooker: '💋', maniac: '🔪',
      bodyguard: '🛡️', seer: '👁️', werewolf: '🐺', civilian: '🏠',
    };
    const roleNames: Record<string, string> = {
      don: 'Дон', mafia: 'Мафия', framer: 'Подставщик', enforcer: 'Громила',
      sheriff: 'Комиссар', doctor: 'Доктор', hooker: 'Любовница', maniac: 'Маньяк',
      bodyguard: 'Телохранитель', seer: 'Провидец', werewolf: 'Оборотень', civilian: 'Мирный',
    };
    const winnerLabels: Record<string, string> = {
      peaceful: 'Мирные победили', mafia: 'Мафия победила', werewolf: 'Оборотень победил',
    };
    const winnerDescriptions: Record<string, string> = {
      peaceful: 'Город очищен от мафии', mafia: 'Мафия захватила город', werewolf: 'Оборотень уничтожил всех',
    };

    const ratingResults: Array<{
      seat: number;
      name: string;
      role: string;
      alive: boolean;
      rating: number;
    }> = [];

    const playerRatings: Array<{
      userId: number;
      rating: RatingResult;
      oldRating: number;
      newRating: number;
    }> = [];

    for (const p of players) {
      const dbPlayer = game.players.find(gp => gp.seatNumber === p.seat);
      if (!dbPlayer) continue;

      await prisma.gamePlayer.update({
        where: { id: dbPlayer.id },
        data: {
          role: p.role,
          isAlive: p.alive,
          fouls: p.fouls,
          deathReason: p.deathReason || null,
          deathDay: p.deathDay || null,
        },
      });

      const mafiaRoles = ['don', 'mafia', 'framer', 'enforcer'];
      const isMafia = mafiaRoles.includes(p.role);
      const won = (winner === 'mafia' && isMafia) ||
                  (winner === 'peaceful' && !isMafia && p.role !== 'werewolf') ||
                  (winner === 'werewolf' && p.role === 'werewolf');

      const ratingInput: RatingInput = {
        role: p.role,
        team: p.team,
        won,
        alive: p.alive,
        fouls: p.fouls,
        techKill: p.techKill || false,
        saves: p.saves,
        bodyguardTraded: p.bodyguardTraded,
        sheriffFoundDon: p.sheriffFoundDon,
        sheriffShotMafia: p.sheriffShotMafia,
        framerSuccessful: p.framerSuccessful,
        enforcerUsed: p.enforcerUsed,
        maniacKills: p.maniacKills,
        werewolfActivated: p.werewolfActivated,
      };

      const rating = calculateRating(ratingInput);

      if (p.userId || dbPlayer.userId) {
        const userId = p.userId || dbPlayer.userId!;

        const userBefore = await prisma.user.findUnique({ where: { id: userId } });
        const oldRating = userBefore?.totalRating || 0;

        await prisma.gameRating.create({
          data: {
            gameId: id,
            userId,
            role: p.role,
            basePoints: rating.base,
            bonusPoints: rating.roleBonus + rating.survival,
            penaltyPoints: Math.abs(rating.penalties),
            totalPoints: rating.total,
            breakdown: {
              base: rating.base,
              survival: rating.survival,
              roleBonus: rating.roleBonus,
              penalties: rating.penalties,
              total: rating.total,
              details: rating.details,
            },
          },
        });

        await prisma.user.update({
          where: { id: userId },
          data: {
            totalRating: { increment: rating.total },
            gamesPlayed: { increment: 1 },
            gamesWon: won ? { increment: 1 } : undefined,
            totalFouls: { increment: p.fouls },
          },
        });

        const newRating = oldRating + rating.total;

        sendToPlayer(id, userId, {
          type: 'rating:updated',
          data: {
            total: newRating,
            change: rating.total,
          },
        });

        playerRatings.push({ userId, rating, oldRating, newRating });
      }

      ratingResults.push({
        seat: p.seat,
        name: dbPlayer.displayName,
        role: p.role,
        alive: p.alive,
        rating: rating.total,
      });
    }

    const endPlayers = players.map((p) => {
      const mafTeam = ['don', 'mafia', 'framer', 'enforcer', 'werewolf'];
      return {
        seat: p.seat,
        role: roleNames[p.role] || p.role,
        icon: roleIcons[p.role] || '❓',
        dead: !p.alive,
        team: mafTeam.includes(p.role) ? 'maf' as const : 'civ' as const,
      };
    });

    for (const pr of playerRatings) {
      const breakdown = [
        { label: 'Базовые очки', pts: `${pr.rating.base >= 0 ? '+' : ''}${pr.rating.base}`, color: pr.rating.base >= 0 ? '#22C55E' : '#EF4444' },
        { label: 'Выживание', pts: `${pr.rating.survival >= 0 ? '+' : ''}${pr.rating.survival}`, color: pr.rating.survival > 0 ? '#3B82F6' : '#6A6A80' },
        { label: 'Бонус роли', pts: `${pr.rating.roleBonus >= 0 ? '+' : ''}${pr.rating.roleBonus}`, color: pr.rating.roleBonus > 0 ? '#F59E0B' : '#6A6A80' },
      ];
      if (pr.rating.penalties !== 0) {
        breakdown.push({ label: 'Штрафы', pts: `${pr.rating.penalties}`, color: '#EF4444' });
      }

      const personalizedPlayers = endPlayers.map((ep) => {
        const matchingP = players.find(p => p.seat === ep.seat);
        return {
          ...ep,
          isMe: matchingP?.userId === pr.userId,
        };
      });

      sendToPlayer(id, pr.userId, {
        type: 'game:ended',
        data: {
          winner: winnerLabels[winner] || winner,
          winnerTeam: winner,
          description: winnerDescriptions[winner] || '',
          ratingBreakdown: breakdown,
          totalChange: `${pr.rating.total >= 0 ? '+' : ''}${pr.rating.total}`,
          oldRating: pr.oldRating,
          newRating: pr.newRating,
          players: personalizedPlayers,
        },
      });
    }

    broadcastToGame(id, {
      type: 'game:ended',
      data: {
        winner: winnerLabels[winner] || winner,
        winnerTeam: winner,
        players: ratingResults,
      },
    });

    broadcastToAll({ type: 'games:refresh' });

    await redis.del(`game:${id}:status`);
    await redis.del(`game:${id}:roles`);

    setTimeout(() => {
      cleanupGameConnections(id);
    }, 5000);

    request.log.info({ gameId: id, winner, ratings: ratingResults }, 'Game finished, ratings calculated');
    audit({ action: 'game.finished', userId: request.userId, gameId: id, ip: request.ip, source: 'gm_app', meta: { winner, playerCount: players.length, ratingsCount: ratingResults.length } });
    incrementCounter('game.finished');

    return reply.send({
      success: true,
      winner,
      ratings: ratingResults,
    });
  });

  fastify.get<{ Params: { id: string } }>('/:id/my-role', async (request, reply) => {
    const id = parseGameId(request.params.id, reply);
    if (!id) return;
    request.log.info({ gameId: id, userId: request.userId }, 'Player requesting role');

    const player = await prisma.gamePlayer.findFirst({
      where: { gameId: id, userId: request.userId },
    });

    if (!player) {
      request.log.warn({ gameId: id, userId: request.userId }, 'Role request failed: player not in game');
      return reply.status(404).send({ error: 'You are not in this game' });
    }

    const game = await prisma.game.findUnique({ where: { id } });
    if (!game || game.status === 'lobby') {
      return reply.send({ assigned: false, seat: player.seatNumber });
    }

    const mafiaRoles = ['don', 'mafia', 'framer', 'enforcer', 'werewolf'];
    let teammates: Array<{ seat: number; name: string }> | undefined;

    if (mafiaRoles.includes(player.role)) {
      const mafiaPlayers = await prisma.gamePlayer.findMany({
        where: {
          gameId: id,
          role: { in: mafiaRoles },
          NOT: { seatNumber: player.seatNumber },
        },
      });
      teammates = mafiaPlayers.map(p => ({
        seat: p.seatNumber,
        name: p.displayName,
      }));
    }

    return reply.send({
      assigned: true,
      seat: player.seatNumber,
      role: player.role,
      team: mafiaRoles.includes(player.role) ? 'mafia' : 'peaceful',
      teammates,
    });
  });

  fastify.get<{ Params: { id: string } }>('/:id/state', async (request, reply) => {
    const id = parseGameId(request.params.id, reply);
    if (!id) return;
    request.log.info({ gameId: id }, 'Fetching game state');

    const cached = await redis.get(`game:${id}:status`);
    let gameStatus: { phase: string; dayNumber: number } | null = null;

    if (cached) {
      gameStatus = JSON.parse(cached);
    }

    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        players: {
          select: {
            seatNumber: true,
            displayName: true,
            isAlive: true,
            fouls: true,
            deathReason: true,
            deathDay: true,
          },
        },
      },
    });

    if (!game) {
      request.log.warn({ gameId: id }, 'Game state: not found');
      return reply.status(404).send({ error: 'Game not found' });
    }

    request.log.info({ gameId: id, status: game.status, phase: gameStatus?.phase, players: game.players.length }, 'Game state returned');

    return reply.send({
      id: game.id,
      status: game.status,
      playerCount: game.playerCount,
      winner: game.winner,
      phase: gameStatus?.phase || game.status,
      dayNumber: gameStatus?.dayNumber || 0,
      startedAt: game.startedAt,
      finishedAt: game.finishedAt,
      players: game.players.map(p => ({
        seat: p.seatNumber,
        name: p.displayName,
        alive: p.isAlive,
        fouls: p.fouls,
        deathReason: p.deathReason,
        deathDay: p.deathDay,
      })),
    });
  });

  fastify.post<{ Params: { id: string }; Body: { userId: number; ban?: boolean; reason?: string } }>('/:id/remove-player', async (request, reply) => {
    if (!requireIpad(request, reply)) return;
    const id = parseGameId(request.params.id, reply);
    if (!id) return;
    const { userId, ban, reason } = request.body;

    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) return reply.status(404).send({ error: 'Game not found' });

    const player = await prisma.gamePlayer.findFirst({
      where: { gameId: id, userId },
    });
    if (!player) return reply.status(404).send({ error: 'Player not in this game' });

    await prisma.gamePlayer.delete({ where: { id: player.id } });

    if (ban) {
      await prisma.gameBan.create({
        data: { gameId: id, userId, bannedBy: request.userId, reason: reason || null },
      });
    }

    sendToUser(userId, {
      type: 'player:removed',
      data: { gameId: id, banned: !!ban },
    });

    const removedUser = await prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true } });
    if (removedUser?.telegramId) {
      const log = (game.gameLog as Record<string, unknown>) || {};
      const gameName = (log.name as string) || game.name || `Game #${id}`;
      const msg = ban
        ? `Вы удалены из игры <b>${gameName}</b> и не можете вернуться в эту игру.`
        : `Вы удалены из игры <b>${gameName}</b>. Вы можете записаться снова.`;
      sendNotification(Number(removedUser.telegramId), msg).catch(() => {});
    }

    broadcastToAll({ type: 'games:refresh' });

    request.log.info({ gameId: id, userId, banned: !!ban }, 'Player removed from game');
    audit({ action: ban ? 'game.player.banned' : 'game.player.left', userId: request.userId, targetId: userId || undefined, gameId: id, ip: request.ip, source: 'gm_app', meta: { banned: !!ban, seat: player.seatNumber, displayName: player.displayName } });
    incrementCounter(ban ? 'game.player.banned' : 'game.player.removed');
    return reply.send({ success: true });
  });

  fastify.post<{ Params: { id: string } }>('/:id/clone', async (request, reply) => {
    if (!requireIpad(request, reply)) return;
    const id = parseGameId(request.params.id, reply);
    if (!id) return;

    const sourceGame = await prisma.game.findUnique({
      where: { id },
      include: { players: true },
    });
    if (!sourceGame) return reply.status(404).send({ error: 'Game not found' });
    if (sourceGame.status !== 'finished') {
      return reply.status(400).send({ error: 'Can only clone finished games' });
    }

    const sourceLog = (sourceGame.gameLog as Record<string, unknown>) || {};
    const sourceName = (sourceLog.name as string) || sourceGame.name || 'Game';

    const nameMatch = sourceName.match(/^(.+?)(\s*#\s*)(\d+)$/);
    const newName = nameMatch
      ? `${nameMatch[1]}${nameMatch[2]}${parseInt(nameMatch[3]) + 1}`
      : `${sourceName} #2`;

    const newGame = await prisma.game.create({
      data: {
        hostUserId: request.userId,
        playerCount: sourceGame.playerCount,
        status: 'lobby',
        clonedFromId: id,
        gameLog: {
          name: newName,
          date: '',
          time: (sourceLog.time as string) || '',
          location: (sourceLog.location as string) || '',
          locationUrl: (sourceLog.locationUrl as string) || '',
          cost: sourceLog.cost || 0,
          isRanked: (sourceLog.isRanked as boolean) ?? true,
          hostTelegram: (sourceLog.hostTelegram as string) || '',
        },
      },
    });

    const bans = await prisma.gameBan.findMany({
      where: { gameId: id },
      select: { userId: true },
    });
    const bannedIds = new Set(bans.map(b => b.userId));

    let seat = 1;
    for (const p of sourceGame.players) {
      if (!p.userId || bannedIds.has(p.userId)) continue;
      await prisma.gamePlayer.create({
        data: {
          gameId: newGame.id,
          userId: p.userId,
          seatNumber: seat++,
          displayName: p.displayName,
          guests: 0,
        },
      });
    }

    broadcastToAll({ type: 'games:refresh' });

    request.log.info({ gameId: newGame.id, clonedFrom: id, playersAdded: seat - 1 }, 'Game cloned');
    audit({ action: 'game.cloned', userId: request.userId, gameId: newGame.id, ip: request.ip, source: 'gm_app', meta: { clonedFrom: id, playersAdded: seat - 1 } });
    incrementCounter('game.cloned');
    return reply.status(201).send({
      id: newGame.id,
      name: newName,
      playersAdded: seat - 1,
    });
  });

  fastify.put<{ Params: { id: string }; Body: { state: Record<string, unknown> } }>('/:id/state', async (request, reply) => {
    if (!requireIpad(request, reply)) return;
    const id = parseGameId(request.params.id, reply);
    if (!id) return;

    await prisma.gameState.upsert({
      where: { gameId: id },
      create: { gameId: id, stateJson: request.body.state as any },
      update: { stateJson: request.body.state as any },
    });

    return reply.send({ success: true });
  });

  fastify.get<{ Params: { id: string } }>('/:id/gm-state', async (request, reply) => {
    if (!requireIpad(request, reply)) return;
    const id = parseGameId(request.params.id, reply);
    if (!id) return;

    const state = await prisma.gameState.findUnique({ where: { gameId: id } });
    if (!state) return reply.send({ found: false });
    return reply.send({ found: true, state: state.stateJson, updatedAt: state.updatedAt });
  });
}
