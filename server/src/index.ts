import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { config } from './config';
import { prisma } from './prisma';
import { redis } from './redis';
import authPlugin from './plugins/auth';
import authRoutes from './routes/auth';
import gameRoutes from './routes/games';
import userRoutes from './routes/users';
import analyticsRoutes from './routes/analytics';
import wsHandler from './ws/handler';
import { startBot, stopBot } from './bot/index';
import { startAuditFlush, stopAuditFlush } from './audit';
import { incrementCounter, recordHistogram, setGauge, getMetrics } from './metrics';

async function main() {
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  });

  const allowedOrigins = [
    'https://opium-mafia.pages.dev',
    'https://opium-gm.pages.dev',
  ];
  if (config.nodeEnv === 'development') {
    allowedOrigins.push('https://localhost:3000', 'http://localhost:3000', 'http://localhost:5173', 'https://localhost:5173', 'http://localhost:7777', 'https://localhost:7777');
  }
  await fastify.register(cors, {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Telegram-Init-Data'],
    credentials: true,
  });

  await fastify.register(jwt, {
    secret: config.jwtSecret,
  });

  await fastify.register(websocket);

  await fastify.register(authPlugin);

  fastify.addHook('onRequest', async (request) => {
    request.log.info({ method: request.method, url: request.url, ip: request.ip }, 'Incoming request');
    incrementCounter('http.requests.total');
    incrementCounter(`http.requests.${request.method}`);
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = Math.round(reply.elapsedTime);
    request.log.info(
      { method: request.method, url: request.url, statusCode: reply.statusCode, responseTime: responseTime + 'ms' },
      'Request completed'
    );
    recordHistogram('http.response_time', responseTime);
    incrementCounter(`http.status.${Math.floor(reply.statusCode / 100)}xx`);

    if (responseTime > 1000) {
      request.log.warn(
        { method: request.method, url: request.url, responseTime: responseTime + 'ms' },
        'Slow request detected'
      );
      incrementCounter('http.slow_requests');
    }
  });

  fastify.addHook('onError', async (request, reply, error) => {
    incrementCounter('http.errors.total');
    request.log.error(
      { method: request.method, url: request.url, error: error.message, stack: error.stack },
      'Request error'
    );
  });

  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(gameRoutes, { prefix: '/games' });
  await fastify.register(userRoutes, { prefix: '/users' });
  await fastify.register(analyticsRoutes, { prefix: '/analytics' });
  await fastify.register(wsHandler);

  fastify.get('/', async () => ({
    name: 'Opium Mafia Server',
    version: '0.1.0',
    author: 'Imran Valiyev',
    owner: 'Vaevi Technologies',
    website: 'https://vaevi.com',
  }));

  fastify.get('/health', async () => {
    let dbOk = false;
    let redisOk = false;
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {  }
    const dbLatency = Date.now() - dbStart;

    const redisStart = Date.now();
    try {
      await redis.ping();
      redisOk = true;
    } catch {  }
    const redisLatency = Date.now() - redisStart;

    const status = dbOk && redisOk ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      services: {
        database: { ok: dbOk, latency_ms: dbLatency },
        redis: { ok: redisOk, latency_ms: redisLatency },
      },
      memory: {
        rss_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heap_used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    };
  });

  fastify.get('/metrics', async (request, reply) => {
    setGauge('process.memory.rss_mb', Math.round(process.memoryUsage().rss / 1024 / 1024));
    setGauge('process.memory.heap_used_mb', Math.round(process.memoryUsage().heapUsed / 1024 / 1024));

    try {
      const [userCount, gameCount, activeGames] = await Promise.all([
        prisma.user.count({ where: { registered: true } }),
        prisma.game.count(),
        prisma.game.count({ where: { status: 'active' } }),
      ]);
      setGauge('users.registered', userCount);
      setGauge('games.total', gameCount);
      setGauge('games.active', activeGames);
    } catch {  }

    return getMetrics();
  });

  (BigInt.prototype as any).toJSON = function () {
    return Number(this);
  };

  startAuditFlush();

  const shutdown = async (signal: string) => {
    fastify.log.info(`Received ${signal}, shutting down...`);
    stopBot();
    stopAuditFlush();
    await fastify.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await fastify.listen({ port: config.port, host: config.host });
    fastify.log.info(`Server running on http://${config.host}:${config.port}`);

    if (config.telegramBotToken) {
      startBot().catch((err) => {
        fastify.log.warn(`Telegram bot failed to start: ${err.message}`);
      });
    } else {
      fastify.log.warn('TELEGRAM_BOT_TOKEN not set, Telegram bot disabled');
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
