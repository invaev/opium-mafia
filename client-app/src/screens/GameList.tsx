import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { api } from '../services/api';
import { mapGames } from '../utils/mapGames';

const GameList: React.FC = () => {
  const navigate = useNavigate();
  const { games, setGames } = useGameStore();

  useEffect(() => {
    if (!api.hasToken()) return;
    api.getGames().then((data) => {
      setGames(mapGames(data as any[]));
    }).catch(() => {});
  }, [setGames]);

  const activeGames = games.filter((g) => g.status === 'lobby');

  if (activeGames.length === 0) {
    return (
      <div className="p-5">
        <div className="text-text-primary text-xl font-bold mb-4">Ближайшие игры</div>
        <div
          className="rounded-[20px] py-12 px-6 mt-10 text-center"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.08)',
          }}
        >
          <div className="text-[56px] mb-4">🌙</div>
          <div className="text-text-primary text-lg font-bold mb-2">Пока нет игр</div>
          <div className="text-text-muted text-[13px] leading-relaxed mb-2">
            Следи за обновлениями — организаторы скоро добавят новые игры
          </div>
          <div className="text-text-dim text-xs">
            Или предложи свою дату в чате клуба
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="text-text-primary text-xl font-bold mb-4">Ближайшие игры</div>

      <div className="flex flex-col gap-3">
        {activeGames.map((g) => {
          const spotsLeft = Math.max(0, g.spots - g.taken);
          const almostFull = spotsLeft <= 3;

          return (
            <div
              key={g.id}
              onClick={() => navigate(`/game/${g.id}`)}
              className="rounded-2xl overflow-hidden cursor-pointer"
              style={{
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <div className="p-3.5 px-4">
                <div className="flex justify-between items-start mb-2.5">
                  <div className="text-text-primary text-base font-bold flex-1 leading-snug">
                    {g.title}
                  </div>
                  {g.rated && (
                    <div
                      className="px-2 py-0.5 rounded-md shrink-0 ml-2 text-[10px] font-bold"
                      style={{
                        background: 'rgba(245,158,11,0.12)',
                        border: '1px solid rgba(245,158,11,0.2)',
                        color: '#F59E0B',
                      }}
                    >
                      РЕЙТИНГ
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">📅</span>
                    <span className="text-[#A0A0B0] text-[13px]">{[g.date, g.time].filter(Boolean).join(' ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">📍</span>
                    <span className="text-[#A0A0B0] text-[13px]">{g.place}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">💰</span>
                    <span className="text-[#A0A0B0] text-[13px]">{g.price}</span>
                  </div>
                </div>

                <div
                  className="flex justify-between items-center mt-3 pt-2.5"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="flex">
                      {g.players.slice(0, 4).map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-center text-[11px] overflow-hidden"
                          style={{
                            width: 24, height: 24, borderRadius: 12,
                            background: p.avatarUrl ? 'transparent' : `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]})`,
                            marginLeft: i > 0 ? -6 : 0,
                            border: '2px solid #0D0D12',
                            position: 'relative',
                            zIndex: 4 - i,
                          }}
                        >
                          {p.avatarUrl ? (
                            <img src={p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            p.emoji
                          )}
                        </div>
                      ))}
                      {g.players.length > 4 && (
                        <div
                          className="flex items-center justify-center text-[9px] font-bold"
                          style={{
                            width: 24, height: 24, borderRadius: 12,
                            background: 'rgba(255,255,255,0.08)',
                            color: '#8888A0',
                            marginLeft: -6,
                            border: '2px solid #0D0D12',
                          }}
                        >
                          +{g.players.length - 4}
                        </div>
                      )}
                    </div>
                    <span className="text-text-muted text-xs">{g.taken}/{g.spots}</span>
                  </div>
                  <div
                    className="text-xs font-semibold"
                    style={{ color: almostFull ? '#EF4444' : '#22C55E' }}
                  >
                    {spotsLeft === 0
                      ? 'Мест нет'
                      : `${spotsLeft} ${spotsLeft === 1 ? 'место' : spotsLeft < 5 ? 'места' : 'мест'}`}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GameList;
