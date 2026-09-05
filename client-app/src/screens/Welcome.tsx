import React from 'react';
import { useNavigate } from 'react-router-dom';
import { hapticImpact } from '../hooks/useHaptic';

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="px-6 py-10 flex flex-col items-center justify-center min-h-screen">
      <div
        className="w-[100px] h-[100px] rounded-[28px] flex items-center justify-center mb-8"
        style={{
          background: 'linear-gradient(135deg, #EF4444 0%, #F59E0B 100%)',
          boxShadow: '0 16px 48px rgba(239,68,68,0.3)',
        }}
      >
        <span className="text-5xl">🃏</span>
      </div>

      <div
        className="text-[38px] font-extrabold text-center leading-tight mb-2"
        style={{
          background: 'linear-gradient(135deg, #FF4444 0%, #FF8844 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        OPIUM
      </div>
      <div className="text-text-muted text-[13px] tracking-[3px] uppercase mb-8">
        Opium Mafia
      </div>

      <div className="text-text-secondary text-[15px] text-center leading-relaxed mb-10 max-w-[280px]">
        Играй в живую мафию с друзьями.
        Роли, рейтинг и статистика — прямо в Telegram.
      </div>

      <div className="w-full flex flex-col gap-3">
        <button
          onClick={() => {
            hapticImpact('medium');
            navigate('/register');
          }}
          className="w-full py-[18px] rounded-2xl border-none text-white text-[17px] font-bold cursor-pointer tracking-wide"
          style={{
            background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
            boxShadow: '0 8px 32px rgba(239,68,68,0.3)',
          }}
        >
          Создать аккаунт
        </button>
        <div className="text-center">
          <span className="text-text-muted text-[13px]">Данные берутся из </span>
          <span className="text-text-link text-[13px] font-semibold">Telegram</span>
        </div>
      </div>

      <div className="mt-auto pb-8 flex gap-4 items-center justify-center">
        <div className="w-6 h-0.5 rounded-sm bg-primary" />
        <div className="w-2 h-0.5 rounded-sm bg-white/10" />
        <div className="w-2 h-0.5 rounded-sm bg-white/10" />
      </div>
    </div>
  );
};

export default Welcome;
