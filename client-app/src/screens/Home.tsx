import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AvatarCircle from '../components/AvatarCircle';
import { useUserStore } from '../store/userStore';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { hapticImpact, hapticNotification } from '../hooks/useHaptic';
import { showToast } from '../components/Toast';
import { api } from '../services/api';
import { mapGames } from '../utils/mapGames';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useUserStore();
  const { activeGame, news, games, setGames } = useGameStore();
  const token = useAuthStore((s) => s.token);

  const setActiveGame = useGameStore((s) => s.setActiveGame);
  const setRoleRevealed = useGameStore((s) => s.setRoleRevealed);
  const myUserId = profile?.id;
  const [quickJoinedGameId, setQuickJoinedGameId] = useState<number | null>(null);

  useEffect(() => {
    if (!api.hasToken()) return;
    api.getGames().then((data) => {
      const mapped = mapGames(data as any[]);
      setGames(mapped);

      if (myUserId) {
        const activeG = mapped.find((g) => g.status === 'active' && g._playerUserIds?.includes(myUserId));
        if (activeG) {
          api.getMyRole(activeG.id).then((roleData) => {
            if (roleData.assigned && roleData.role) {
              setActiveGame({
                id: activeG.id,
                title: activeG.title,
                place: activeG.place,
                role: roleData.role as any,
                team: roleData.team as any,
              });
            }
          }).catch(() => {});
        } else {
          setActiveGame(null);
        }
      }
    }).catch((err) => console.error('Failed to fetch games:', err));
  }, [token, myUserId]);
  const myActiveGame = games.find((g: any) => g.status === 'active' && myUserId && g._playerUserIds?.includes(myUserId));
  const lobbyGames = games.filter((g: any) => g.status === 'lobby');
  const nextGame = lobbyGames[0];
  const isJoinedNext = nextGame && myUserId && ((nextGame as any)._playerUserIds?.includes(myUserId) || quickJoinedGameId === nextGame.id);
  const spotsLeftNext = nextGame ? Math.max(0, nextGame.spots - nextGame.taken) : 0;
  const hasActivity = !!activeGame || !!myActiveGame || !!nextGame;

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-text-primary text-xl font-bold">
            Привет, {profile?.name || 'Игрок'} 👋
          </div>
          <div className="text-text-muted text-[13px] mt-0.5">
            Opium Mafia
          </div>
        </div>
        <AvatarCircle
          emoji={profile?.avatar.type === 'emoji' ? profile.avatar.emoji : undefined}
          photoUrl={profile?.avatar.type === 'photo' ? profile.avatar.photoUrl : undefined}
          colorIndex={profile?.avatar.colorIndex}
          size={42}
        />
      </div>

      {hasActivity ? (
        <>
          {activeGame && (
            <div
              onClick={() => {
                setRoleRevealed(false);
                navigate('/role-reveal');
              }}
              className="rounded-2xl p-4 mb-4 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(139,92,246,0.08) 100%)',
                border: '1px solid rgba(59,130,246,0.2)',
              }}
            >
              <div className="flex justify-between items-center mb-2.5">
                <div
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#4ADE80' }}
                >
                  СЕЙЧАС ИДЁТ
                </div>
                <div className="text-text-dim text-sm">›</div>
              </div>
              <div className="text-text-primary text-base font-bold">
                {activeGame.title} 🎭
              </div>
              <div className="text-text-secondary text-xs mt-1">
                {activeGame.place} · Нажми чтобы увидеть свою роль
              </div>
            </div>
          )}

          {!activeGame && myActiveGame && (
            <div
              onClick={() => navigate(`/game/${myActiveGame.id}`)}
              className="rounded-2xl p-4 mb-4 cursor-pointer"
              style={{
                background: 'rgba(34,197,94,0.04)',
                border: '1px solid rgba(34,197,94,0.15)',
              }}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[11px] font-semibold tracking-wider" style={{ color: '#4ADE80' }}>ИГРА ИДЁТ</span>
              </div>
              <div className="text-text-primary text-[15px] font-bold">
                {myActiveGame.title}
              </div>
              <div className="text-text-secondary text-xs mt-1">
                {myActiveGame.place}
              </div>
            </div>
          )}

          {nextGame && (
            <div
              onClick={() => navigate(`/game/${nextGame.id}`)}
              className="rounded-2xl p-4 mb-4 cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="text-text-secondary text-[11px] font-semibold tracking-wider mb-2.5 flex items-center gap-2">
                БЛИЖАЙШАЯ ИГРА
              </div>
              <div className="text-text-primary text-[15px] font-bold">
                {nextGame.title} 🌙
              </div>
              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs">📅</span>
                  <span className="text-[#A0A0B0] text-[13px]">{[nextGame.date, nextGame.time].filter(Boolean).join(' ')}</span>
                </div>
                {nextGame.place && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs">📍</span>
                    {nextGame.placeUrl ? (
                      <a href={nextGame.placeUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] underline" style={{ color: '#60A5FA' }} onClick={(e) => e.stopPropagation()}>{nextGame.place}</a>
                    ) : (
                      <span className="text-[#A0A0B0] text-[13px]">{nextGame.place}</span>
                    )}
                  </div>
                )}
                {nextGame.price && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs">💰</span>
                    <span className="text-[#A0A0B0] text-[13px]">{nextGame.price}</span>
                  </div>
                )}
              </div>
              <div
                className="flex justify-between items-center mt-2.5 pt-2.5"
                style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="flex items-center gap-1.5">
                  <div className="flex">
                    {nextGame.players.slice(0, 3).map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-center text-[10px] overflow-hidden"
                        style={{
                          width: 22, height: 22, borderRadius: 11,
                          background: (p as any).avatarUrl ? 'transparent' : `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]})`,
                          marginLeft: i > 0 ? -5 : 0,
                          border: '2px solid #0D0D12',
                          zIndex: 3 - i,
                        }}
                      >
                        {(p as any).avatarUrl ? (
                          <img src={(p as any).avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          p.emoji
                        )}
                      </div>
                    ))}
                  </div>
                  <span className="text-text-muted text-[11px]">
                    {nextGame.taken}/{nextGame.spots}
                  </span>
                </div>
                {isJoinedNext ? (
                  <span className="text-success text-xs font-semibold">✓ Ты записан</span>
                ) : spotsLeftNext > 0 ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      hapticImpact('medium');
                      setQuickJoinedGameId(nextGame.id);
                      api.joinGame(nextGame.id).then(() => {
                        api.getGames().then((data) => {
                          setGames(mapGames(data as any[]));
                        });
                      }).catch((err) => {
                        setQuickJoinedGameId(null);
                        hapticNotification('error');
                        const msg = err?.message || '';
                        if (msg.includes('Already joined')) {
                          showToast('Ты уже записан', 'info');
                        } else if (msg.includes('No spots')) {
                          showToast('Мест нет', 'error');
                        } else {
                          showToast('Не удалось записаться', 'error');
                        }
                      });
                    }}
                    className="px-3 py-1 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                    }}
                  >
                    Записаться
                  </button>
                ) : (
                  <span className="text-text-muted text-xs font-semibold">Мест нет</span>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div
          className="rounded-[20px] py-8 px-5 mb-4 text-center"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.08)',
          }}
        >
          <div className="text-5xl mb-3">🃏</div>
          <div className="text-text-primary text-[17px] font-bold mb-1.5">
            Нет предстоящих игр
          </div>
          <div className="text-text-muted text-[13px] leading-relaxed mb-5">
            Запишись на ближайшую игру или пригласи друзей — вместе веселее
          </div>
          <button
            onClick={() => navigate('/games')}
            className="px-8 py-3.5 rounded-[14px] border-none text-white text-[15px] font-bold cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
              boxShadow: '0 6px 24px rgba(239,68,68,0.3)',
            }}
          >
            🎮 Найти игру
          </button>
        </div>
      )}

      <div className="flex gap-2.5 mb-4">
        <button
          onClick={() => navigate('/rules')}
          className="flex-1 py-3.5 px-2.5 rounded-[14px] border-none text-white text-[13px] font-bold cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
            boxShadow: '0 4px 16px rgba(139,92,246,0.25)',
          }}
        >
          📖 Правила и роли
        </button>
        <button
          onClick={() => {
            const botUrl = 'https://t.me/OpiumMafia_bot';
            const text = 'Играй в мафию вместе со мной! Заходи в Opium Mafia 🎭';
            const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${encodeURIComponent(text)}`;
            api.trackShare().catch(() => {});
            window.open(shareUrl, '_blank');
          }}
          className="flex-1 py-3.5 px-2.5 rounded-[14px] text-[#C0C0D0] text-[13px] font-semibold cursor-pointer"
          style={{
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          📨 Пригласить друга
        </button>
      </div>

      <div className="mb-2">
        <div className="text-text-secondary text-[11px] font-semibold tracking-wider mb-2.5">
          НОВОСТИ КЛУБА
        </div>
        {news.length > 0 ? (
          <div className="flex flex-col gap-2">
            {news.map((item, i) => (
              <div
                key={i}
                className="flex gap-2.5 p-2.5 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <span className="text-base shrink-0">{item.icon}</span>
                <div className="flex-1">
                  <div className="text-[#C0C0D0] text-[13px] leading-snug">{item.text}</div>
                  <div className="text-text-dim text-[11px] mt-0.5">{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="p-5 rounded-[14px] text-center"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <div className="text-text-dim text-[13px]">
              Пока тихо... Новости появятся после первых игр
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
