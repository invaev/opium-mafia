import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/opium_mafia',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramBotSecret: process.env.TELEGRAM_BOT_SECRET || '',
  ipadApiKey: process.env.IPAD_API_KEY || 'dev-ipad-key',
  gmPassphrase: process.env.GM_PASSPHRASE || 'dev-gm-passphrase',
};
