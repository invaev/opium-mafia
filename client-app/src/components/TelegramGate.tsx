import React from 'react';
import { isTelegramApp, getTelegramPlatform } from '../lib/telegram';

interface TelegramGateProps {
  children: React.ReactNode;
}

const MOBILE_PLATFORMS = ['android', 'android_x', 'ios'];

function isMobilePlatform(): boolean {
  const platform = getTelegramPlatform();
  if (platform && MOBILE_PLATFORMS.includes(platform)) return true;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

const TelegramGate: React.FC<TelegramGateProps> = ({ children }) => {
  if (import.meta.env.DEV) {
    return <>{children}</>;
  }

  if (!isTelegramApp()) {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-6">🔒</div>
        <h1 className="text-2xl font-bold text-white mb-3">
          Opium Mafia
        </h1>
        <p className="text-dark-text-secondary text-lg mb-8">
          This app is only available inside Telegram.
        </p>
        <a
          href="https://t.me/OpiumMafia_bot"
          className="px-6 py-3 bg-mafia-red text-white font-semibold rounded-xl
                     hover:bg-red-600 transition-colors"
        >
          Open in Telegram
        </a>
        <p className="text-dark-text-secondary text-sm mt-6 opacity-60">
          Search for @OpiumMafia_bot in Telegram to play
        </p>
      </div>
    );
  }

  if (!isMobilePlatform()) {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-6">📱</div>
        <h1 className="text-2xl font-bold text-white mb-3">
          Opium Mafia
        </h1>
        <p className="text-dark-text-secondary text-lg mb-8">
          This app is available only on mobile devices. Please open it from Telegram on your phone.
        </p>
        <p className="text-dark-text-secondary text-sm mt-6 opacity-60">
          Open @OpiumMafia_bot on your phone to play
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

export default TelegramGate;
