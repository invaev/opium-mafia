import React from 'react';
import BackButton from '../components/BackButton';
import { useGameStore } from '../store/gameStore';

const teamWinColors: Record<string, string> = {
  peaceful: '#3B82F6',
  mafia: '#EF4444',
  werewolf: '#8B5CF6',
};

const GameEnd: React.FC = () => {
  const { gameEnd } = useGameStore();

  if (!gameEnd) return null;

  const wColor = teamWinColors[gameEnd.winnerTeam] || '#3B82F6';

  return (
    <div>
      <BackButton label="Главная" to="/" />
      <div className="px-5 py-6">
        <div
          className="text-center py-8 px-5 rounded-3xl mb-6"
          style={{
            background: `linear-gradient(180deg, ${wColor}15 0%, ${wColor}02 100%)`,
            border: `1px solid ${wColor}20`,
          }}
        >
          <div className="text-[56px]">🏆</div>
          <div className="text-2xl font-extrabold text-text-primary mt-3">
            {gameEnd.winner}
          </div>
          <div className="text-sm mt-2" style={{ color: wColor }}>
            {gameEnd.description}
          </div>
        </div>

        <div
          className="rounded-2xl p-4 mb-4"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="text-text-secondary text-xs font-semibold mb-3">
            Твой рейтинг за партию:
          </div>
          <div className="flex flex-col gap-1.5">
            {gameEnd.ratingBreakdown.map((r, i) => (
              <div
                key={i}
                className="flex justify-between py-1.5"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              >
                <span className="text-[#A0A0B0] text-[13px]">{r.label}</span>
                <span className="text-sm font-bold" style={{ color: r.color }}>
                  {r.pts}
                </span>
              </div>
            ))}
          </div>
          <div
            className="flex justify-between mt-3 pt-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
          >
            <span className="text-text-primary text-base font-bold">ИТОГО</span>
            <span className="text-accent text-[22px] font-extrabold">{gameEnd.totalChange}</span>
          </div>
          <div className="text-center mt-3 text-[#6A6A80] text-xs">
            Общий рейтинг: {gameEnd.oldRating} →{' '}
            <strong className="text-accent">{gameEnd.newRating}</strong>
          </div>
        </div>

        <div
          className="rounded-2xl p-4"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="text-text-secondary text-xs font-semibold mb-2.5">
            Раскрытие ролей:
          </div>
          {gameEnd.players.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg"
              style={{
                opacity: p.dead ? 0.5 : 1,
                background: p.team === 'maf' ? 'rgba(239,68,68,0.05)' : 'transparent',
              }}
            >
              <span className="text-sm">{p.icon}</span>
              <span className="text-text-secondary text-xs w-6">
                №{p.seat}
              </span>
              <span
                className="text-[13px] flex-1"
                style={{
                  color: p.team === 'maf' ? '#F87171' : '#C0C0D0',
                  fontWeight: p.isMe ? 700 : 400,
                }}
              >
                {p.role}
              </span>
              {p.dead && <span className="text-[11px] text-text-muted">☠️</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameEnd;
