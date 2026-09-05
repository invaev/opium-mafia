import React, { useState, useEffect } from 'react';
import { hapticSelection } from '../hooks/useHaptic';
import { api } from '../services/api';

interface LeaderEntry {
  pos: number;
  name: string;
  avatarUrl: string | null;
  rating: number;
  games: number;
  win: string;
  medal?: string;
  me?: boolean;
}

const filters = ['Все время', 'Месяц', 'Неделя'] as const;
const periods = ['all', 'month', 'week'] as const;

const Leaderboard: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState(0);
  const [data, setData] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getLeaderboard(periods[activeFilter] as 'all' | 'month' | 'week')
      .then((entries) => {
        if (!cancelled && Array.isArray(entries)) {
          setData((entries as Record<string, unknown>[]).map((e, i) => ({
            pos: i + 1,
            name: (e.displayName || e.name || 'Игрок') as string,
            avatarUrl: (e.avatarUrl as string) || null,
            rating: (e.rating || 0) as number,
            games: (e.gamesPlayed || 0) as number,
            win: e.winRate ? `${e.winRate}%` : '0%',
            medal: i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : undefined,
            me: !!e.isMe,
          })));
        }
      })
      .catch(() => {
        if (!cancelled) setData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeFilter]);

  return (
    <div className="px-5 py-6">
      <div className="text-center mb-5">
        <div className="text-4xl">🏆</div>
        <div className="text-text-primary text-xl font-bold mt-2">
          Таблица лидеров
        </div>
        <div className="text-[#6A6A80] text-[13px] mt-1">Opium Mafia</div>
      </div>

      <div className="flex gap-2 mb-5">
        {filters.map((f, i) => (
          <button
            key={i}
            onClick={() => {
              hapticSelection();
              setActiveFilter(i);
            }}
            className="flex-1 py-2 rounded-[10px] border-none text-xs font-semibold cursor-pointer transition-all duration-200"
            style={{
              background: activeFilter === i ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
              color: activeFilter === i ? '#F59E0B' : '#6A6A80',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-muted text-sm">Загрузка...</div>
      ) : data.length === 0 ? (
        <div
          className="rounded-[20px] py-12 px-6 text-center"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.08)',
          }}
        >
          <div className="text-5xl mb-4">🏆</div>
          <div className="text-text-primary text-lg font-bold mb-2">
            Пока нет данных
          </div>
          <div className="text-text-muted text-[13px]">
            Таблица лидеров заполнится после первых игр
          </div>
        </div>
      ) : (
        data.map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-3 px-3.5 rounded-[14px] mb-2"
            style={{
              background: p.me ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
              border: p.me ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <div
              className="w-7 text-center font-bold"
              style={{
                color: p.medal ? '#F59E0B' : '#5A5A70',
                fontSize: p.medal ? 18 : 14,
              }}
            >
              {p.medal || p.pos}
            </div>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden shrink-0"
              style={{
                background: p.avatarUrl ? 'transparent' : `hsl(${p.pos * 40}, 50%, ${p.me ? '45%' : '25%'})`,
              }}
            >
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                p.name[0]
              )}
            </div>
            <div className="flex-1">
              <div
                className="text-sm"
                style={{
                  color: p.me ? '#F59E0B' : '#C0C0D0',
                  fontWeight: p.me ? 700 : 500,
                }}
              >
                {p.name}
              </div>
              <div className="text-text-muted text-[11px] mt-0.5">
                {p.games} игр · {p.win} побед
              </div>
            </div>
            <div className="text-text-primary text-lg font-bold">{p.rating}</div>
          </div>
        ))
      )}
    </div>
  );
};

export default Leaderboard;
