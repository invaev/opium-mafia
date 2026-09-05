import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { useGameStore, type GamePlayer } from '../store/gameStore';
import { useTelegramMainButton } from '../hooks/useTelegramMainButton';
import { hapticImpact, hapticNotification } from '../hooks/useHaptic';
import { showToast } from '../components/Toast';
import { api } from '../services/api';
import { useUserStore } from '../store/userStore';
import { wsService } from '../services/ws';
import { mapGames } from '../utils/mapGames';

const PlayerProfile: React.FC<{
  player: GamePlayer;
  onBack: () => void;
}> = ({ player, onBack }) => {
  const [avatarFull, setAvatarFull] = useState(false);
  const avatarUrl = (player as any).avatarUrl as string | null;

  return (
    <div className="relative">
      {avatarFull && (
        <div
          onClick={() => setAvatarFull(false)}
          className="fixed inset-0 z-20 flex flex-col items-center justify-center cursor-pointer"
          style={{ background: 'rgba(0,0,0,0.93)' }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={player.name}
              style={{
                width: 200, height: 200, borderRadius: 100, objectFit: 'cover',
                boxShadow: '0 0 80px rgba(255,255,255,0.1)',
              }}
            />
          ) : (
            <div
              className="flex items-center justify-center text-[80px]"
              style={{
                width: 200, height: 200, borderRadius: 100,
                background: `linear-gradient(135deg, ${player.colors[0]}, ${player.colors[1]})`,
                boxShadow: `0 0 80px ${player.colors[0]}40`,
              }}
            >
              {player.name[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div className="mt-5 text-text-primary text-lg font-bold">{player.name}</div>
          <div className="mt-4 text-[#3A3A4A] text-xs">нажми чтобы закрыть</div>
        </div>
      )}

      <BackButton label="Игра" onClick={onBack} />

      <div className="px-5 py-6">
        <div className="text-center mb-6">
          <div
            onClick={() => setAvatarFull(true)}
            className="inline-block cursor-pointer relative"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={player.name}
                style={{
                  width: 88, height: 88, borderRadius: 44, objectFit: 'cover',
                  boxShadow: '0 8px 32px rgba(255,255,255,0.1)',
                }}
              />
            ) : (
              <div
                className="flex items-center justify-center text-[40px] font-bold text-white"
                style={{
                  width: 88, height: 88, borderRadius: 44,
                  background: `linear-gradient(135deg, ${player.colors[0]}, ${player.colors[1]})`,
                  boxShadow: `0 8px 32px ${player.colors[0]}30`,
                }}
              >
                {player.name[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <div className="text-text-muted text-[11px] mt-1.5">нажми на аватар</div>
          <div className="text-text-primary text-[22px] font-bold mt-3">{player.name}</div>
          <div className="text-text-link text-sm mt-1">{player.nick}</div>
          {player.bio && (
            <div className="text-text-secondary text-[13px] mt-2.5 italic">
              &laquo;{player.bio}&raquo;
            </div>
          )}
          {player.insta && (
            <div
              className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(228,64,95,0.1), rgba(131,58,180,0.1))',
                border: '1px solid rgba(228,64,95,0.2)',
              }}
            >
              <span className="text-[15px]">📸</span>
              <span className="text-text-primary text-[13px] font-semibold">{player.insta}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Рейтинг', value: player.rating, color: '#F59E0B' },
            { label: 'Игр', value: player.games, color: '#E8E8F0' },
            { label: 'Побед', value: player.winRate, color: '#22C55E' },
          ].map((s, i) => (
            <div
              key={i}
              className="rounded-[14px] py-3.5 px-2.5 text-center"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="text-[22px] font-extrabold" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="text-text-muted text-[11px] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const GameDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { games, setGames, activeGame, setActiveGame } = useGameStore();
  const setRoleRevealed = useGameStore((s) => s.setRoleRevealed);
  const myUserId = useUserStore((s) => s.profile?.id);

  const [viewingPlayer, setViewingPlayer] = useState<number | null>(null);
  const [guests, setGuests] = useState(0);
  const [showJoinPanel, setShowJoinPanel] = useState(false);
  const loadingRef = React.useRef(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [myRole, setMyRole] = useState<{ role: string; team: string } | null>(null);

  const game = games.find((g) => g.id === Number(id));

  const refreshGames = useCallback(() => {
    api.getGames().then((data) => {
      setGames(mapGames(data as any[]));
    }).catch(() => {});
  }, [setGames]);

  useEffect(() => { refreshGames(); }, []);

  useEffect(() => {
    const unsubscribe = wsService.subscribe((event) => {
      if (event.type === 'games:refresh' || event.type === 'player:joined' || event.type === 'player:left') {
        refreshGames();
      }
    });
    return () => { unsubscribe(); };
  }, [refreshGames]);

  useEffect(() => {
    if (!game || game.status !== 'active' || !myUserId) return;
    const playerIds: number[] = (game as any)._playerUserIds || [];
    if (!playerIds.includes(myUserId)) return;
    api.getMyRole(game.id).then((data) => {
      if (data.assigned && data.role) {
        setMyRole({ role: data.role, team: data.team || 'peaceful' });
        setActiveGame({
          id: game.id,
          title: game.title,
          place: game.place,
          role: data.role as any,
          team: data.team as any,
        });
      }
    }).catch(() => {});
  }, [game?.id, game?.status, myUserId]);

  const playerUserIds: number[] = game ? (game as any)._playerUserIds || [] : [];
  const joined = game && myUserId && (playerUserIds.includes(myUserId) || hasJoined);
  const myPlayerIndex = joined ? playerUserIds.indexOf(myUserId!) : -1;
  const spotsLeft = game ? Math.max(0, game.spots - game.taken) : 0;
  const joinedGuests = joined && myPlayerIndex >= 0 ? game.players[myPlayerIndex]?.guests ?? 0 : 0;

  const handleJoinGame = useCallback(async () => {
    if (!game || joined || loadingRef.current) return;
    const spotsNeeded = 1 + guests;
    if (spotsNeeded > spotsLeft) {
      showToast('Недостаточно мест', 'error');
      return;
    }
    loadingRef.current = true;

    try {
      await api.joinGame(game.id, guests);
      hapticNotification('success');
      setHasJoined(true);
      setShowJoinPanel(false);
      showToast('Ты записан на игру!');
      refreshGames();
    } catch (err: any) {
      const serverMsg = err?.message || '';
      const errorMap: Record<string, string> = {
        'You already joined this game': 'Ты уже записан',
        'Not enough spots': 'Недостаточно мест',
        'Game is not in lobby phase': 'Запись закрыта',
        'Game not found': 'Игра не найдена',
        'Your account is banned': 'Аккаунт заблокирован',
        'You are banned from this game': 'Вы заблокированы в этой игре',
        'Game master cannot join as a player': 'Ведущий не может записаться',
      };
      showToast(errorMap[serverMsg] || 'Ошибка записи', 'error');
    }
    loadingRef.current = false;
  }, [joined, spotsLeft, game?.id, guests, refreshGames]);

  const handleLeaveGame = useCallback(async () => {
    if (!game || loadingRef.current) return;
    loadingRef.current = true;

    try {
      await api.leaveGame(game.id);
      hapticImpact('medium');
      setHasJoined(false);
      setGuests(0);
      showToast('Запись отменена', 'info');
      refreshGames();
    } catch (err: any) {
      console.error('Leave game error:', err);
      showToast(`Ошибка отмены: ${err?.message || 'unknown'}`, 'error');
    }
    loadingRef.current = false;
  }, [game?.id, refreshGames]);

  useTelegramMainButton(null, () => {});

  if (!game) return <div className="p-5 text-text-muted">Загрузка...</div>;

  if (viewingPlayer !== null) {
    return (
      <PlayerProfile
        player={game.players[viewingPlayer]}
        onBack={() => setViewingPlayer(null)}
      />
    );
  }

  return (
    <div>
      <BackButton label="Игры" to="/games" />
      <div className="px-5 py-4">
        <div className="flex justify-between items-start mb-3.5">
          <div className="text-text-primary text-xl font-bold flex-1 leading-snug">
            {game.title}
          </div>
          {game.rated && (
            <div
              className="px-2.5 py-1 rounded-lg shrink-0 ml-2 text-[11px] font-bold"
              style={{
                background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(245,158,11,0.2)',
                color: '#F59E0B',
              }}
            >
              РЕЙТИНГОВАЯ
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 mb-3.5">
          {[
            { icon: '📅', text: [game.date, game.time].filter(Boolean).join(' ') },
            { icon: '📍', text: game.place, url: game.placeUrl },
            { icon: '💰', text: game.price },
            { icon: '👥', text: `${game.taken} из ${game.spots} мест` },
          ].map((r: any, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="text-sm">{r.icon}</span>
              {r.url ? (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm underline" style={{ color: '#60A5FA' }}>{r.text}</a>
              ) : (
                <span className="text-[#A0A0B0] text-sm">{r.text}</span>
              )}
            </div>
          ))}
        </div>

        <div
          className="p-2.5 px-3 rounded-xl mb-4 flex items-center gap-2.5"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #DC2626)' }}
          >
            🎙️
          </div>
          <span className="text-text-secondary text-xs">Ведущий: </span>
          <span className="text-text-primary text-[13px] font-semibold">{game.host.name}</span>
          {game.host.nick && (
            <a
              href={`https://t.me/${game.host.nick.replace(/^@/, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline"
              style={{ color: '#60A5FA' }}
              onClick={(e) => e.stopPropagation()}
            >
              @{game.host.nick.replace(/^@/, '')}
            </a>
          )}
        </div>

        {game.status === 'active' && (
          <div
            className="py-2.5 px-4 rounded-xl mb-4 flex items-center justify-between"
            style={{
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.2)',
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[#4ADE80] text-sm font-semibold">Игра идёт</span>
            </div>
            {(myRole || activeGame?.role) && (
              <button
                onClick={() => {
                  hapticImpact('medium');
                  setRoleRevealed(false);
                  navigate('/role-reveal');
                }}
                className="px-4 py-2 rounded-xl border-none text-white text-xs font-bold cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                  boxShadow: '0 4px 16px rgba(139,92,246,0.3)',
                }}
              >
                🎭 Посмотреть роль
              </button>
            )}
          </div>
        )}

        {game.status === 'lobby' && !joined ? (
          <div className="mb-4">
            {!showJoinPanel ? (
              <button
                onClick={() => {
                  if (spotsLeft > 0) {
                    hapticImpact('light');
                    setShowJoinPanel(true);
                  }
                }}
                className="w-full py-4 rounded-2xl border-none text-base font-bold cursor-pointer"
                style={{
                  background: spotsLeft > 0
                    ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                    : 'rgba(255,255,255,0.06)',
                  color: spotsLeft > 0 ? '#fff' : '#5A5A70',
                  boxShadow: spotsLeft > 0 ? '0 8px 32px rgba(239,68,68,0.3)' : 'none',
                }}
              >
                {spotsLeft > 0 ? 'Записаться на игру' : 'Мест нет'}
              </button>
            ) : (
              <div
                className="p-4 rounded-2xl"
                style={{
                  background: 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.15)',
                }}
              >
                <div className="text-text-primary text-[15px] font-semibold mb-3.5">
                  Записаться
                </div>
                <div className="mb-3.5">
                  <div className="text-text-secondary text-xs font-semibold mb-2">
                    Со мной придут (без аккаунта):
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        hapticImpact('light');
                        setGuests(Math.max(0, guests - 1));
                      }}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl cursor-pointer"
                      style={{
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.04)',
                        color: '#C0C0D0',
                      }}
                    >
                      −
                    </button>
                    <div className="flex-1 text-center text-text-primary text-[28px] font-extrabold">
                      {guests}
                    </div>
                    <button
                      onClick={() => {
                        hapticImpact('light');
                        setGuests(Math.min(spotsLeft - 1, guests + 1));
                      }}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl cursor-pointer"
                      style={{
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.04)',
                        color: '#C0C0D0',
                      }}
                    >
                      +
                    </button>
                  </div>
                  <div className="text-text-muted text-[11px] text-center mt-1.5">
                    {guests > 0 ? `Итого: ты + ${guests} = ${1 + guests} мест` : 'Только ты'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowJoinPanel(false)}
                    className="flex-1 py-3.5 rounded-xl text-sm font-semibold cursor-pointer"
                    style={{
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'transparent',
                      color: '#8888A0',
                    }}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleJoinGame}
                    className="flex-[2] py-3.5 rounded-xl border-none text-sm font-bold text-white cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                      boxShadow: '0 4px 16px rgba(239,68,68,0.3)',
                    }}
                  >
                    Подтвердить
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : game.status === 'lobby' && joined ? (
          <div
            className="py-3.5 px-4 rounded-[14px] mb-4 flex items-center justify-between"
            style={{
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.2)',
            }}
          >
            <div>
              <div className="text-success text-sm font-semibold">
                ✓ Ты записан{joinedGuests > 0 ? ` (+${joinedGuests})` : ''}
              </div>
              <div className="text-text-muted text-xs mt-0.5">
                {joinedGuests > 0
                  ? `Ты + ${joinedGuests} гост${joinedGuests === 1 ? 'ь' : 'ей'}`
                  : 'Ждем тебя!'}
              </div>
            </div>
            <button
              onClick={handleLeaveGame}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
              style={{
                border: '1px solid rgba(239,68,68,0.2)',
                background: 'rgba(239,68,68,0.08)',
                color: '#F87171',
              }}
            >
              Отменить
            </button>
          </div>
        ) : null}

        <div className="text-text-secondary text-[13px] font-semibold mb-2.5">
          Участники ({game.players.length})
        </div>
        <div className="flex flex-col gap-1.5">
          {game.players.map((p, i) => (
            <div
              key={i}
              onClick={() => {
                hapticImpact('light');
                setViewingPlayer(i);
              }}
              className="flex items-center gap-3 rounded-[14px] py-2.5 px-3.5 cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {(p as any).avatarUrl ? (
                <img
                  src={(p as any).avatarUrl}
                  alt={p.name}
                  className="shrink-0"
                  style={{
                    width: 38, height: 38, borderRadius: 19, objectFit: 'cover',
                  }}
                />
              ) : (
                <div
                  className="shrink-0 flex items-center justify-center text-[15px] font-bold text-white"
                  style={{
                    width: 38, height: 38, borderRadius: 19,
                    background: `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]})`,
                    boxShadow: `0 2px 8px ${p.colors[0]}20`,
                  }}
                >
                  {p.emoji}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-text-primary text-sm font-semibold">{p.name}</span>
                  {p.guests > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                      style={{
                        background: 'rgba(139,92,246,0.12)',
                        color: '#A78BFA',
                      }}
                    >
                      +{p.guests}
                    </span>
                  )}
                </div>
                <div className="text-text-muted text-[11px]">{p.nick}</div>
              </div>
              <div className="text-accent text-[13px] font-bold shrink-0">{p.rating}</div>
              <div className="text-[#3A3A4A] text-sm shrink-0">›</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameDetails;
