import React, { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import { api } from '../services/api';
import { ROLE_META } from '@shared/types';
import type { GameRole } from '@shared/types';
import { useUserStore } from '../store/userStore';

interface PlayerInGame {
  seat: number;
  name: string;
  nickname: string | null;
  role: string;
  alive: boolean;
  fouls: number;
  userId: number | null;
  avatarUrl: string | null;
  avatarEmoji: string | null;
  avatarColorIndex: number | null;
  ratingChange: number;
}

interface GameHistory {
  gameId: number;
  playerCount: number;
  status: string;
  winner: string | null;
  seat: number;
  role: string;
  alive: boolean;
  fouls: number;
  deathReason: string | null;
  deathDay: number | null;
  won: boolean | null;
  rating: {
    total: number;
    base: number;
    bonus: number;
    penalty: number;
  } | null;
  players: PlayerInGame[];
  startedAt: string | null;
  finishedAt: string | null;
}

function getRoleMeta(role: string) {
  return ROLE_META[role as GameRole] || { icon: '❓', nameRu: role, color: '#888' };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

const MEDALS = ['🥇', '🥈', '🥉'];

function winnerLabel(winner: string | null) {
  if (winner === 'mafia') return { text: 'Мафия', color: '#EF4444', icon: '🔫' };
  if (winner === 'peaceful') return { text: 'Мирные', color: '#22C55E', icon: '🕊' };
  if (winner === 'werewolf') return { text: 'Оборотень', color: '#A855F7', icon: '🐺' };
  return { text: 'Неизвестно', color: '#888', icon: '❓' };
}

const History: React.FC = () => {
  const [games, setGames] = useState<GameHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const myUserId = useUserStore((s) => s.profile?.id);

  useEffect(() => {
    api.getHistory(50).then((data: any) => {
      setGames(data.games || []);
      setTotal(data.total || 0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const finishedGames = games.filter(g => g.status === 'finished');

  return (
    <div>
      <BackButton label="Профиль" to="/profile" />
      <div className="px-5 py-5">
        <div className="text-text-primary text-xl font-bold mb-1">
          История игр
        </div>
        <div className="text-text-muted text-xs mb-5">
          {total} {total === 1 ? 'игра' : total < 5 ? 'игры' : 'игр'} сыграно
        </div>

        {loading ? (
          <div className="text-text-muted text-sm text-center py-12">Загрузка...</div>
        ) : finishedGames.length === 0 ? (
          <div
            className="rounded-[20px] py-12 px-6 text-center"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed rgba(255,255,255,0.08)',
            }}
          >
            <div className="text-5xl mb-4">🎮</div>
            <div className="text-text-primary text-lg font-bold mb-2">Пока нет игр</div>
            <div className="text-text-muted text-[13px]">
              Сыграй свою первую партию — результаты появятся здесь
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {finishedGames.map((g) => {
              const roleMeta = getRoleMeta(g.role);
              const ratingChange = g.rating?.total ?? 0;
              const isPositive = ratingChange > 0;
              const winner = winnerLabel(g.winner);
              const isExpanded = expanded === g.gameId;

              return (
                <div
                  key={g.gameId}
                  className="rounded-[14px] overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div
                    className="p-3.5 cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : g.gameId)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-base font-bold shrink-0"
                        style={{
                          background: g.won
                            ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))'
                            : 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))',
                          border: `1px solid ${g.won ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                          color: g.won ? '#22C55E' : '#EF4444',
                        }}
                      >
                        {g.won ? 'W' : 'L'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{roleMeta.icon}</span>
                          <span className="text-[#C0C0D0] text-sm font-medium">{roleMeta.nameRu}</span>
                        </div>
                        <div className="text-text-muted text-[11px] mt-0.5 flex items-center gap-1.5">
                          <span>Игра #{g.gameId}</span>
                          <span>·</span>
                          <span style={{ color: winner.color }}>{winner.icon} {winner.text}</span>
                          {g.finishedAt && (
                            <>
                              <span>·</span>
                              <span>{formatDate(g.finishedAt)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right flex items-center gap-2">
                        <div
                          className="text-base font-bold"
                          style={{ color: isPositive ? '#22C55E' : '#F59E0B' }}
                        >
                          {isPositive ? '+' : ''}{ratingChange}
                        </div>
                        <span className="text-[#3A3A4A] text-sm">{isExpanded ? '▾' : '›'}</span>
                      </div>
                    </div>
                  </div>

                  {isExpanded && g.players && g.players.length > 0 && (
                    <div
                      className="px-3.5 pb-3.5"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <div className="text-text-muted text-[10px] font-semibold uppercase mt-2.5 mb-2">
                        Игроки по рейтингу
                      </div>
                      {g.players.map((p, idx) => {
                        const pRole = getRoleMeta(p.role);
                        const isMe = p.userId === myUserId;
                        const medal = idx < 3 ? MEDALS[idx] : null;

                        return (
                          <div
                            key={p.seat}
                            className="flex items-center gap-2.5 py-1.5"
                            style={{
                              borderBottom: idx < g.players.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                              background: isMe ? 'rgba(245,158,11,0.06)' : 'transparent',
                              borderRadius: isMe ? 8 : 0,
                              padding: isMe ? '6px 8px' : undefined,
                              margin: isMe ? '1px -4px' : undefined,
                            }}
                          >
                            <div className="w-5 text-center shrink-0">
                              {medal ? (
                                <span className="text-sm">{medal}</span>
                              ) : (
                                <span className="text-text-muted text-[11px]">{idx + 1}</span>
                              )}
                            </div>

                            <span className="text-sm shrink-0">{pRole.icon}</span>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className={`text-[13px] truncate ${isMe ? 'text-[#F59E0B] font-bold' : 'text-[#C0C0D0]'}`}>
                                  {p.name}
                                </span>
                                {!p.alive && <span className="text-[10px]">💀</span>}
                              </div>
                              <span className="text-text-muted text-[10px]">{pRole.nameRu}</span>
                            </div>

                            <div
                              className="text-[13px] font-bold shrink-0"
                              style={{ color: p.ratingChange > 0 ? '#22C55E' : p.ratingChange < 0 ? '#EF4444' : '#888' }}
                            >
                              {p.ratingChange > 0 ? '+' : ''}{p.ratingChange}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
