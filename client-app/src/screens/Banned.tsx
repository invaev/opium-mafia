import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { getInitDataRaw } from '../lib/telegram';

const Banned: React.FC = () => {
  const banReason = useAuthStore((s) => s.banReason);
  const logout = useAuthStore((s) => s.logout);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setRegistered = useAuthStore((s) => s.setRegistered);
  const setBanned = useAuthStore((s) => s.setBanned);
  const [checking, setChecking] = useState(false);

  const handleRetry = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const initDataRaw = getInitDataRaw();
      if (!initDataRaw) {
        setChecking(false);
        return;
      }
      const result = await api.authenticate(initDataRaw);
      if (result.banned) {
        setBanned(result.banReason);
      } else if (result.token) {
        api.setToken(result.token);
        logout();
        setAuthenticated(result.token);
        if (result.registered) {
          setRegistered();
        }
      }
    } catch {
    }
    setChecking(false);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <div className="text-5xl mb-6">🚫</div>
      <h1 className="text-xl font-bold text-white mb-3">Аккаунт заблокирован</h1>
      <p className="text-text-muted text-sm mb-6 max-w-xs leading-relaxed">
        Ваш аккаунт был заблокирован администратором. Вы не можете использовать приложение.
      </p>
      {banReason && (
        <div className="w-full max-w-xs mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
          <div className="text-red-400 text-xs font-semibold mb-1 uppercase">Причина</div>
          <div className="text-red-300 text-sm">{banReason}</div>
        </div>
      )}
      <p className="text-text-secondary text-xs max-w-xs mb-6">
        Если вы считаете, что это ошибка, свяжитесь с организатором.
      </p>
      <button
        onClick={handleRetry}
        disabled={checking}
        className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-white/10 text-text-secondary"
        style={{ background: 'rgba(255,255,255,0.04)', opacity: checking ? 0.5 : 1 }}
      >
        {checking ? 'Проверяю...' : 'Проверить снова'}
      </button>
    </div>
  );
};

export default Banned;
