import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { config } from '../config';
import { audit } from '../audit';
import { incrementCounter } from '../metrics';

interface TelegramAuthBody {
  initData: string;
}

interface IpadAuthBody {
  apiKey: string;
  telegramId: number;
  nickname?: string;
  displayName: string;
}

function validateTelegramInitData(initData: string): { valid: boolean; data: Record<string, string> } {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { valid: false, data: {} };

  params.delete('hash');
  const entries = Array.from(params.entries());
  entries.sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(config.telegramBotToken)
    .digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) {
    return { valid: false, data: {} };
  }

  const result: Record<string, string> = {};
  for (const [key, value] of entries) {
    result[key] = value;
  }
  result['hash'] = hash;
  return { valid: true, data: result };
}

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: TelegramAuthBody }>('/telegram', async (request: FastifyRequest<{ Body: TelegramAuthBody }>, reply: FastifyReply) => {
    const { initData } = request.body;
    request.log.info('POST /auth/telegram — request received');

    if (!initData) {
      request.log.warn('Auth failed: initData missing');
      audit({ action: 'auth.telegram.failed', ip: request.ip, source: 'mini_app', meta: { reason: 'missing_initData' } });
      incrementCounter('auth.telegram.failed');
      return reply.status(400).send({ error: 'initData is required' });
    }

    const isDevBypass = config.nodeEnv === 'development' && !config.telegramBotToken;
    let data: Record<string, string>;

    if (isDevBypass) {
      request.log.info('Dev mode: skipping initData HMAC validation (no bot token)');
      const params = new URLSearchParams(initData);
      data = Object.fromEntries(params.entries());
    } else {
      const result = validateTelegramInitData(initData);
      if (!result.valid) {
        request.log.warn('Auth failed: invalid initData signature');
        audit({ action: 'auth.telegram.failed', ip: request.ip, source: 'mini_app', meta: { reason: 'invalid_signature' } });
        incrementCounter('auth.telegram.failed');
        return reply.status(401).send({ error: 'Invalid Telegram initData' });
      }
      data = result.data;

      const authDate = parseInt(data['auth_date'] || '0', 10);
      const now = Math.floor(Date.now() / 1000);
      if (now - authDate > 86400) {
        request.log.warn({ authDate, now, diff: now - authDate }, 'Auth failed: initData expired');
        audit({ action: 'auth.telegram.failed', ip: request.ip, source: 'mini_app', meta: { reason: 'expired', ageSec: now - authDate } });
        incrementCounter('auth.telegram.failed');
        return reply.status(401).send({ error: 'Auth data expired' });
      }
    }

    let userData: { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string; language_code?: string; is_premium?: boolean };
    try {
      userData = JSON.parse(data['user'] || '{}');
    } catch {
      request.log.warn('Auth failed: could not parse user JSON from initData');
      return reply.status(400).send({ error: 'Invalid user data in initData' });
    }

    if (!userData.id) {
      request.log.warn('Auth failed: no telegram user id in initData');
      return reply.status(400).send({ error: 'Missing telegram user id' });
    }

    const displayName = [userData.first_name, userData.last_name].filter(Boolean).join(' ');

    const existingUser = await prisma.user.findUnique({
      where: { telegramId: BigInt(userData.id) },
    });
    const isNewUser = !existingUser;

    const updateData: Record<string, unknown> = {
      telegramUsername: userData.username || null,
      telegramFirstName: userData.first_name || null,
      telegramLastName: userData.last_name || null,
      telegramPhotoUrl: userData.photo_url || null,
      telegramLanguage: userData.language_code || null,
      telegramIsPremium: userData.is_premium ?? null,
      lastSeenAt: new Date(),
    };
    if (!existingUser || !existingUser.registered) {
      updateData.displayName = displayName;
    }
    if (userData.photo_url && (!existingUser || !existingUser.registered)) {
      updateData.avatarUrl = userData.photo_url;
    }

    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(userData.id) },
      update: updateData,
      create: {
        telegramId: BigInt(userData.id),
        telegramUsername: userData.username || null,
        telegramFirstName: userData.first_name || null,
        telegramLastName: userData.last_name || null,
        telegramPhotoUrl: userData.photo_url || null,
        telegramLanguage: userData.language_code || null,
        telegramIsPremium: userData.is_premium ?? null,
        displayName: displayName,
        avatarUrl: userData.photo_url || null,
        lastSeenAt: new Date(),
      },
    });

    if (user.banned) {
      request.log.warn({ userId: user.id }, 'Auth blocked: user is banned');
      audit({ action: 'auth.telegram.banned', userId: user.id, ip: request.ip, source: 'mini_app', meta: { banReason: user.banReason, telegramId: Number(user.telegramId), displayName: user.displayName } });
      incrementCounter('auth.telegram.banned');
      return reply.status(403).send({
        error: 'Account is banned',
        banned: true,
        banReason: user.banReason || null,
      });
    }

    const token = fastify.jwt.sign(
      {
        userId: user.id,
        telegramId: Number(user.telegramId),
        isIpad: false,
      },
      { expiresIn: '30d' }
    );

    request.log.info({ userId: user.id, telegramId: Number(user.telegramId), isNewUser, displayName }, 'Telegram auth success');
    audit({ action: 'auth.telegram.success', userId: user.id, ip: request.ip, source: 'mini_app', meta: { isNewUser, registered: user.registered, telegramId: Number(user.telegramId), displayName } });
    audit({ action: 'user.app.opened', userId: user.id, source: 'mini_app', meta: { isNewUser } });
    incrementCounter('auth.telegram.success');

    return reply.send({
      token,
      isNewUser,
      registered: user.registered,
      user: {
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
        totalRating: user.totalRating,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon,
      },
    });
  });

  fastify.post<{ Body: { passphrase: string } }>('/gm-activate', async (request: FastifyRequest<{ Body: { passphrase: string } }>, reply: FastifyReply) => {
    const { passphrase } = request.body;
    request.log.info({ ip: request.ip }, 'POST /auth/gm-activate — activation attempt');

    if (!passphrase) {
      return reply.status(400).send({ error: 'Passphrase is required' });
    }

    const passphraseBuffer = Buffer.from(passphrase);
    const expectedBuffer = Buffer.from(config.gmPassphrase);

    if (passphraseBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(passphraseBuffer, expectedBuffer)) {
      request.log.warn({ ip: request.ip }, 'GM activation failed: invalid passphrase');
      audit({ action: 'auth.gm_activate.failed', ip: request.ip, source: 'gm_app', meta: { reason: 'invalid_passphrase' } });
      incrementCounter('auth.gm_activate.failed');
      return reply.status(401).send({ error: 'Invalid passphrase' });
    }

    const activationToken = fastify.jwt.sign(
      { purpose: 'gm-device-activation', activatedAt: Date.now() },
      { expiresIn: '365d' }
    );

    request.log.info({ ip: request.ip }, 'GM device activated successfully');
    audit({ action: 'auth.gm_activate.success', ip: request.ip, source: 'gm_app' });
    incrementCounter('auth.gm_activate.success');

    return reply.send({ activationToken });
  });

  fastify.post<{ Body: { activationToken: string } }>('/gm-verify', async (request: FastifyRequest<{ Body: { activationToken: string } }>, reply: FastifyReply) => {
    const { activationToken } = request.body;

    if (!activationToken) {
      return reply.status(400).send({ error: 'Activation token is required' });
    }

    try {
      const decoded = fastify.jwt.verify<{ purpose: string }>(activationToken);
      if (decoded.purpose !== 'gm-device-activation') {
        return reply.status(401).send({ error: 'Invalid activation token' });
      }
      return reply.send({ valid: true });
    } catch {
      return reply.status(401).send({ error: 'Activation token expired or invalid' });
    }
  });

  fastify.post<{ Body: IpadAuthBody }>('/ipad', async (request: FastifyRequest<{ Body: IpadAuthBody }>, reply: FastifyReply) => {
    const { apiKey, telegramId, nickname, displayName } = request.body;
    request.log.info({ telegramId, displayName }, 'POST /auth/ipad — request received');

    if (!apiKey || !telegramId || !displayName) {
      request.log.warn('iPad auth failed: missing required fields');
      return reply.status(400).send({ error: 'apiKey, telegramId, and displayName are required' });
    }

    const apiKeyBuffer = Buffer.from(apiKey);
    const expectedBuffer = Buffer.from(config.ipadApiKey);

    if (apiKeyBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(apiKeyBuffer, expectedBuffer)) {
      request.log.warn({ telegramId }, 'iPad auth failed: invalid API key');
      audit({ action: 'auth.ipad.failed', ip: request.ip, source: 'gm_app', meta: { telegramId, displayName, reason: 'invalid_api_key' } });
      incrementCounter('auth.ipad.failed');
      return reply.status(401).send({ error: 'Invalid API key' });
    }

    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(telegramId) },
      update: {
        nickname: nickname || null,
        displayName,
      },
      create: {
        telegramId: BigInt(telegramId),
        nickname: nickname || null,
        displayName,
      },
    });

    const token = fastify.jwt.sign(
      {
        userId: user.id,
        telegramId: Number(user.telegramId),
        isIpad: true,
      },
      { expiresIn: '30d' }
    );

    request.log.info({ userId: user.id, telegramId: Number(user.telegramId), displayName }, 'iPad auth success');
    audit({ action: 'auth.ipad.success', userId: user.id, ip: request.ip, source: 'gm_app', meta: { telegramId: Number(user.telegramId), displayName } });
    incrementCounter('auth.ipad.success');

    return reply.send({
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        displayName: user.displayName,
      },
    });
  });
}
