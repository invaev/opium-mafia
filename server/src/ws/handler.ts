import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { prisma } from '../prisma';

const gameConnections = new Map<number, Map<number, WebSocket>>();

const userConnections = new Map<number, WebSocket>();

export function getGameConnections(gameId: number): Map<number, WebSocket> {
  if (!gameConnections.has(gameId)) {
    gameConnections.set(gameId, new Map());
  }
  return gameConnections.get(gameId)!;
}

export function addPlayerConnection(gameId: number, userId: number, ws: WebSocket): void {
  const connections = getGameConnections(gameId);
  const existing = connections.get(userId);
  if (existing && existing.readyState === WebSocket.OPEN) {
    console.log(`[WS] Replacing existing connection for user=${userId} game=${gameId}`);
    existing.close(1000, 'Replaced by new connection');
  }
  connections.set(userId, ws);
  userConnections.set(userId, ws);
  console.log(`[WS] Player connected: user=${userId} game=${gameId} (${connections.size} players in game)`);
}

export function removePlayerConnection(gameId: number, userId: number): void {
  const connections = gameConnections.get(gameId);
  if (connections) {
    connections.delete(userId);
    console.log(`[WS] Player disconnected: user=${userId} game=${gameId} (${connections.size} remaining)`);
    if (connections.size === 0) {
      gameConnections.delete(gameId);
      console.log(`[WS] Game ${gameId} has no more connections, cleaned up`);
    }
  }
  userConnections.delete(userId);
}

export function sendToPlayer(gameId: number, userId: number, event: object): void {
  const connections = gameConnections.get(gameId);
  if (!connections) {
    console.log(`[WS] sendToPlayer: no connections for game=${gameId}`);
    return;
  }

  const ws = connections.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
    console.log(`[WS] Sent to user=${userId} game=${gameId}: ${(event as any).type}`);
  } else {
    console.log(`[WS] sendToPlayer: user=${userId} not connected or socket not open (game=${gameId})`);
  }
}

export function sendToUser(userId: number, event: object): void {
  const ws = userConnections.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
    console.log(`[WS] Sent to user=${userId}: ${(event as any).type}`);
  } else {
    console.log(`[WS] sendToUser: user=${userId} not connected`);
  }
}

export function broadcastToGame(gameId: number, event: object, excludeUserId?: number): void {
  const connections = gameConnections.get(gameId);
  if (!connections) {
    console.log(`[WS] broadcastToGame: no connections for game=${gameId}`);
    return;
  }

  const message = JSON.stringify(event);
  let sent = 0;
  for (const [userId, ws] of connections) {
    if (userId === excludeUserId) continue;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
      sent++;
    }
  }
  console.log(`[WS] Broadcast to game=${gameId}: ${(event as any).type} (${sent}/${connections.size} players)`);
}

export function broadcastToAll(event: object): void {
  const message = JSON.stringify(event);
  let sent = 0;
  for (const [userId, ws] of userConnections) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
      sent++;
    }
  }
  console.log(`[WS] Broadcast to all: ${(event as any).type} (${sent}/${userConnections.size} users)`);
}

export function cleanupGameConnections(gameId: number): void {
  const connections = gameConnections.get(gameId);
  if (!connections) return;

  console.log(`[WS] Cleaning up game=${gameId} (${connections.size} connections)`);
  for (const [userId, ws] of connections) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, 'Game ended');
    }
    userConnections.delete(userId);
  }
  gameConnections.delete(gameId);
}

export default async function wsHandler(fastify: FastifyInstance) {
  fastify.get('/ws', { websocket: true }, async (socket, request) => {
    const ws = socket as unknown as WebSocket;

    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');
    const gameId = url.searchParams.get('gameId');

    console.log(`[WS] New connection attempt: gameId=${gameId}, hasToken=${!!token}`);

    if (!token) {
      console.log('[WS] Connection rejected: no token');
      ws.close(4001, 'Missing token');
      return;
    }

    let decoded: { userId: number; telegramId: number };
    try {
      decoded = fastify.jwt.verify<{ userId: number; telegramId: number }>(token);
    } catch (err) {
      console.log(`[WS] Connection rejected: invalid token — ${(err as Error).message}`);
      ws.close(4001, 'Invalid token');
      return;
    }

    const userId = decoded.userId;
    const gameIdNum = gameId ? Number(gameId) : null;
    console.log(`[WS] Authenticated: user=${userId} telegramId=${decoded.telegramId} game=${gameIdNum || 'global'}`);

    const wsUser = await prisma.user.findUnique({ where: { id: userId }, select: { banned: true } });
    if (wsUser?.banned) {
      console.log(`[WS] Connection rejected: user=${userId} is banned`);
      ws.close(4003, 'Account is banned');
      return;
    }

    if (gameIdNum) {
      addPlayerConnection(gameIdNum, userId, ws);

      ws.on('close', (code, reason) => {
        console.log(`[WS] Connection closed: user=${userId} game=${gameIdNum} code=${code} reason=${reason?.toString()}`);
        removePlayerConnection(gameIdNum, userId);
      });
    } else {
      userConnections.set(userId, ws);
      console.log(`[WS] Global connection registered: user=${userId} (${userConnections.size} total users)`);

      ws.on('close', (code, reason) => {
        console.log(`[WS] Global connection closed: user=${userId} code=${code} reason=${reason?.toString()}`);
        userConnections.delete(userId);
      });
    }

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log(`[WS] Message from user=${userId}: ${JSON.stringify(msg)}`);
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        console.log(`[WS] Invalid message from user=${userId}: ${data.toString().slice(0, 100)}`);
      }
    });

    ws.on('error', (err) => {
      console.error(`[WS] Error for user=${userId}: ${err.message}`);
    });

    const alive = { value: true };
    const pingTimer = setInterval(() => {
      if (!alive.value) {
        console.log(`[WS] No pong from user=${userId}, terminating`);
        ws.terminate();
        return;
      }
      alive.value = false;
      ws.ping();
    }, 30000);

    ws.on('pong', () => {
      alive.value = true;
    });

    ws.on('close', () => {
      clearInterval(pingTimer);
    });

    ws.send(JSON.stringify({ type: 'connected', data: { userId, gameId: gameIdNum } }));
    console.log(`[WS] Sent connection confirmation to user=${userId}`);
  });
}
