import { Bot, Context, InputFile, InlineKeyboard, Keyboard } from 'grammy';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from '../config';
import { prisma } from '../prisma';
import { audit } from '../audit';
let defaultPostImage: Buffer | null = null;
try {
  defaultPostImage = readFileSync(join(__dirname, '..', 'assets', 'default-post.png'));
} catch {
  console.warn('Default post image not found at assets/default-post.png');
}

let bot: Bot | null = null;

async function syncTelegramData(ctx: Context): Promise<{ id: number; telegramId: bigint; registered: boolean } | null> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return null;

  const telegramData = {
    telegramUsername: ctx.from?.username || null,
    telegramFirstName: ctx.from?.first_name || null,
    telegramLastName: ctx.from?.last_name || null,
    telegramLanguage: (ctx.from as any)?.language_code || null,
    telegramIsPremium: (ctx.from as any)?.is_premium ?? null,
    lastSeenAt: new Date(),
  };

  const existingUser = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
    select: { id: true, telegramId: true, registered: true },
  });

  if (!existingUser) return null;

  const updateData: Record<string, unknown> = { ...telegramData };
  if (!existingUser.registered) {
    const displayName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || 'Player';
    updateData.displayName = displayName;
  }

  await prisma.user.update({
    where: { telegramId: BigInt(telegramId) },
    data: updateData,
  }).catch(() => {});

  return existingUser;
}

export async function startBot(): Promise<Bot> {
  if (!config.telegramBotToken) {
    console.warn('TELEGRAM_BOT_TOKEN not set, bot will not start');
    throw new Error('Bot token not configured');
  }

  bot = new Bot(config.telegramBotToken);

  const miniAppUrl = process.env.MINI_APP_URL || 'https://opium-mafia.pages.dev';

  const mainKeyboard = new Keyboard()
    .text('ℹ️ О клубе').text('🤝 Партнёры')
    .resized()
    .persistent();

  const playButton = new InlineKeyboard()
    .webApp('🎮 Играть', miniAppUrl);

  bot.command('start', async (ctx: Context) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const displayName = [ctx.from?.first_name, ctx.from?.last_name]
      .filter(Boolean)
      .join(' ') || 'Player';

    const telegramData = {
      telegramUsername: ctx.from?.username || null,
      telegramFirstName: ctx.from?.first_name || null,
      telegramLastName: ctx.from?.last_name || null,
      telegramLanguage: (ctx.from as any)?.language_code || null,
      telegramIsPremium: (ctx.from as any)?.is_premium ?? null,
      lastSeenAt: new Date(),
    };

    const existingUser = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: { registered: true },
    });

    const updateData: Record<string, unknown> = { ...telegramData };
    if (!existingUser || !existingUser.registered) {
      updateData.displayName = displayName;
    }

    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(telegramId) },
      update: updateData,
      create: {
        telegramId: BigInt(telegramId),
        ...telegramData,
        displayName,
      },
    });

    audit({ action: 'bot.start', userId: user.id, source: 'bot' });

    const firstName = ctx.from?.first_name || 'друг';

    await ctx.reply(
      `Привет, ${firstName}! 🎩\n\n` +
      `Добро пожаловать в Opium Mafia — мафия-клуб, где каждая игра как кино.\n\n` +
      `Интриги, блеф и настоящие эмоции — всё это ждёт тебя за нашим столом. Готов испытать себя?`,
      {
        reply_markup: mainKeyboard,
      }
    );
    await ctx.reply('Нажми чтобы открыть приложение 👇', {
      reply_markup: playButton,
    });
  });

  bot.hears('ℹ️ О клубе', async (ctx: Context) => {
    const u = await syncTelegramData(ctx);
    if (u) audit({ action: 'bot.about', userId: u.id, source: 'bot' });
    await ctx.reply(
      `🎭 <b>Opium Mafia Club</b>\n\n` +
      `🏠 Мафия-клуб в Варшаве\n\n` +
      `📍 Локация уточняется перед каждой игрой\n\n` +
      `🎮 Играем в классическую мафию с 12 ролями\n\n` +
      `👥 От 10 до 20 игроков\n\n` +
      `💬 Telegram: <a href="https://t.me/+a1YrwJFx25Q3NDEy">Наш чат</a>\n\n` +
      `Открой приложение чтобы увидеть ближайшие игры и присоединиться!`,
      {
        parse_mode: 'HTML',
        reply_markup: mainKeyboard,
      }
    );
  });

  bot.hears('🤝 Партнёры', async (ctx: Context) => {
    const u = await syncTelegramData(ctx);
    if (u) audit({ action: 'bot.partners', userId: u.id, source: 'bot' });
    await ctx.reply(
      `🤝 <b>Наши партнёры</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `🖥 <a href="https://vaevi.com"><b>Vaevi Technologies</b></a>\n` +
      `Технологические решения и разработка\n\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `🚗 <a href="https://sk-cars.pl"><b>SK-Cars</b></a>\n` +
      `Премиум автомобили и приватные трансферы\n\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `🌙 <a href="https://www.lunalounge.pl"><b>Luna Lounge</b></a>\n` +
      `Лаунж-бар и место для отдыха\n\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `💎 Стань партнёром клуба — напиши нам!`,
      {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: mainKeyboard,
      }
    );
  });

  bot.command('stats', async (ctx: Context) => {
    const u = await syncTelegramData(ctx);
    if (!u) {
      await ctx.reply('You have not registered yet. Send /start to begin.');
      return;
    }

    audit({ action: 'bot.stats', userId: u.id, source: 'bot' });

    const user = await prisma.user.findUnique({
      where: { id: u.id },
    });

    if (!user) return;

    const winRate = user.gamesPlayed > 0
      ? Math.round((user.gamesWon / user.gamesPlayed) * 100)
      : 0;

    await ctx.reply(
      `Your Stats:\n\n` +
      `Rating: ${user.totalRating}\n` +
      `Games: ${user.gamesPlayed}\n` +
      `Wins: ${user.gamesWon} (${winRate}%)\n` +
      `Fouls: ${user.totalFouls}`
    );
  });

  bot.command('rating', async (ctx: Context) => {
    const u = await syncTelegramData(ctx);
    if (!u) {
      await ctx.reply('You have not registered yet. Send /start to begin.');
      return;
    }

    audit({ action: 'bot.rating', userId: u.id, source: 'bot' });

    const topPlayers = await prisma.user.findMany({
      where: { registered: true },
      orderBy: { totalRating: 'desc' },
      take: 10,
      select: { displayName: true, totalRating: true },
    });

    if (topPlayers.length === 0) {
      await ctx.reply('No players yet.');
      return;
    }

    let text = `Leaderboard - Opium Mafia:\n\n`;
    topPlayers.forEach((entry, i) => {
      text += `${i + 1}. ${entry.displayName} - ${entry.totalRating}\n`;
    });

    await ctx.reply(text);
  });

  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  bot.start({
    onStart: () => {
      console.log('Telegram bot started');
    },
  });

  return bot;
}

export async function sendNotification(telegramId: number, message: string): Promise<boolean> {
  if (!bot) return false;

  try {
    await bot.api.sendMessage(telegramId, message, {
      parse_mode: 'HTML',
    });
    return true;
  } catch (err) {
    console.error(`Failed to send notification to ${telegramId}:`, err);
    return false;
  }
}

export async function notifyGameCreated(game: {
  name: string;
  date: string;
  time?: string;
  location: string;
  locationUrl?: string;
  cost?: number;
  maxPlayers: number;
  isRanked: boolean;
  photoData?: string;
}): Promise<void> {
  if (!bot) return;

  const type = game.isRanked ? 'Рейтинговая' : 'Товарищеская';

  let gatherLine = '';
  if (game.time) {
    const [h, m] = game.time.split(':').map(Number);
    const totalMin = h * 60 + m - 30;
    const gH = Math.floor((totalMin + 1440) % 1440 / 60);
    const gM = (totalMin + 1440) % 60;
    const gatherTime = `${String(gH).padStart(2, '0')}:${String(gM).padStart(2, '0')}`;
    gatherLine = `🕐 Сбор игроков: ${gatherTime}\n`;
  }

  const caption =
    `🎭 <b>Новая игра!</b>\n\n` +
    `📌 ${game.name}\n\n` +
    `📅 ${game.date}${game.time ? ` в ${game.time}` : ''}\n\n` +
    gatherLine + (gatherLine ? '\n' : '') +
    `📍 ${game.locationUrl ? `<a href="${game.locationUrl}">${game.location}</a>` : game.location}\n\n` +
    `💰 Стоимость: ${game.cost || 0} PLN\n\n` +
    `👥 Макс. игроков: ${game.maxPlayers}\n\n` +
    `🏆 ${type}\n\n` +
    `Открой приложение чтобы присоединиться!`;

  const users = await prisma.user.findMany({
    where: { registered: true },
    select: { telegramId: true },
  });

  let photoBuffer: Buffer | null = null;
  if (game.photoData) {
    const base64 = game.photoData.replace(/^data:image\/\w+;base64,/, '');
    photoBuffer = Buffer.from(base64, 'base64');
  } else if (defaultPostImage) {
    photoBuffer = defaultPostImage;
  }

  for (const user of users) {
    try {
      if (photoBuffer) {
        await bot.api.sendPhoto(
          Number(user.telegramId),
          new InputFile(photoBuffer, 'game.jpg'),
          { caption, parse_mode: 'HTML' }
        );
      } else {
        await bot.api.sendMessage(Number(user.telegramId), caption, {
          parse_mode: 'HTML',
        });
      }
    } catch (err) {
      console.error(`Failed to notify user ${user.telegramId}:`, err);
    }
  }
}

export async function notifyGameUpdated(game: {
  name: string;
  date: string;
  time?: string;
  location: string;
  locationUrl?: string;
  cost?: number;
  maxPlayers: number;
  isRanked: boolean;
  photoData?: string | null;
}): Promise<void> {
  if (!bot) return;

  const type = game.isRanked ? 'Рейтинговая' : 'Товарищеская';

  let gatherLine = '';
  if (game.time) {
    const [h, m] = game.time.split(':').map(Number);
    const totalMin = h * 60 + m - 30;
    const gH = Math.floor((totalMin + 1440) % 1440 / 60);
    const gM = (totalMin + 1440) % 60;
    const gatherTime = `${String(gH).padStart(2, '0')}:${String(gM).padStart(2, '0')}`;
    gatherLine = `🕐 Сбор игроков: ${gatherTime}\n`;
  }

  const caption =
    `✏️ <b>Игра обновлена!</b>\n\n` +
    `📌 ${game.name}\n\n` +
    `📅 ${game.date}${game.time ? ` в ${game.time}` : ''}\n\n` +
    gatherLine + (gatherLine ? '\n' : '') +
    `📍 ${game.locationUrl ? `<a href="${game.locationUrl}">${game.location}</a>` : game.location}\n\n` +
    `💰 Стоимость: ${game.cost || 0} PLN\n\n` +
    `👥 Макс. игроков: ${game.maxPlayers}\n\n` +
    `🏆 ${type}\n\n` +
    `Открой приложение чтобы увидеть изменения!`;

  let photoBuffer: Buffer | null = null;
  if (game.photoData) {
    const base64 = game.photoData.replace(/^data:image\/\w+;base64,/, '');
    photoBuffer = Buffer.from(base64, 'base64');
  } else if (defaultPostImage) {
    photoBuffer = defaultPostImage;
  }

  const users = await prisma.user.findMany({
    where: { registered: true },
    select: { telegramId: true },
  });

  for (const user of users) {
    try {
      if (photoBuffer) {
        await bot.api.sendPhoto(
          Number(user.telegramId),
          new InputFile(photoBuffer, 'game.jpg'),
          { caption, parse_mode: 'HTML' }
        );
      } else {
        await bot.api.sendMessage(Number(user.telegramId), caption, {
          parse_mode: 'HTML',
        });
      }
    } catch (err) {
      console.error(`Failed to notify user ${user.telegramId}:`, err);
    }
  }
}

export async function notifyGameCancelled(game: {
  name: string;
  date: string;
  time?: string;
  photoData?: string | null;
}): Promise<void> {
  if (!bot) return;

  const caption =
    `❌ <b>Игра отменена</b>\n\n` +
    `📌 ${game.name}\n\n` +
    `📅 ${game.date}${game.time ? ` в ${game.time}` : ''}\n\n` +
    `Игра была отменена организатором.`;

  let photoBuffer: Buffer | null = null;
  if (game.photoData) {
    const base64 = game.photoData.replace(/^data:image\/\w+;base64,/, '');
    photoBuffer = Buffer.from(base64, 'base64');
  } else if (defaultPostImage) {
    photoBuffer = defaultPostImage;
  }

  const users = await prisma.user.findMany({
    where: { registered: true },
    select: { telegramId: true },
  });

  for (const user of users) {
    try {
      if (photoBuffer) {
        await bot.api.sendPhoto(
          Number(user.telegramId),
          new InputFile(photoBuffer, 'game.jpg'),
          { caption, parse_mode: 'HTML' }
        );
      } else {
        await bot.api.sendMessage(Number(user.telegramId), caption, {
          parse_mode: 'HTML',
        });
      }
    } catch (err) {
      console.error(`Failed to notify user ${user.telegramId}:`, err);
    }
  }
}

export function stopBot(): void {
  if (bot) {
    bot.stop();
    bot = null;
  }
}
