import React, { useRef, useState, useEffect } from 'react';
import { theme } from '../theme';
import { useGameStore } from '../store/gameStore';
import { fetchGames, updateGame, deleteGame, fetchUsers, ensureAuth, removePlayer as removePlayerFromServer, ServerGame, ServerUser } from '../api';
import { PlayerPopup } from '../components/PlayerPopup';
import { ROLE_META } from '@shared/types';

export const GameDetails: React.FC = () => {
  const setScreen = useGameStore((s) => s.setScreen);
  const selectedGameId = useGameStore((s) => s.selectedGameId);

  const [game, setGame] = useState<ServerGame | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [cost, setCost] = useState('');
  const [hostTelegram, setHostTelegram] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(15);
  const [isRanked, setIsRanked] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [starting, setStarting] = useState(false);
  const [usersMap, setUsersMap] = useState<Map<number, ServerUser>>(new Map());
  const [selectedUser, setSelectedUser] = useState<ServerUser | null>(null);
  const loadServerGame = useGameStore((s) => s.loadServerGame);
  const restoreFromServer = useGameStore((s) => s.restoreFromServer);
  const [resuming, setResuming] = useState(false);

  const [orig, setOrig] = useState({ name: '', date: '', time: '', location: '', locationUrl: '', cost: '', hostTelegram: '', maxPlayers: 15, isRanked: true });

  const hasChanges = name !== orig.name || date !== orig.date || time !== orig.time || location !== orig.location || locationUrl !== orig.locationUrl || cost !== orig.cost || hostTelegram !== orig.hostTelegram || maxPlayers !== orig.maxPlayers || isRanked !== orig.isRanked;

  const refreshGame = () => {
    if (!selectedGameId) return;
    fetchGames().then((games) => {
      const g = games.find((g) => g.id === selectedGameId);
      if (g) setGame(g);
    }).catch(() => {});
  };

  useEffect(() => {
    if (!selectedGameId) {
      setScreen('dashboard');
      return;
    }
    const loadGame = () => {
      fetchGames().then((games) => {
        const g = games.find((g) => g.id === selectedGameId);
        if (!g) {
          setScreen('dashboard');
          return;
        }
        setGame(g);
        if (!initializedRef.current) {
          initializedRef.current = true;
          const priceNum = g.price?.replace(/[^0-9]/g, '') || '';
          const origValues = {
            name: g.title,
            date: g.date,
            time: g.time,
            location: g.place,
            locationUrl: (g as any).placeUrl || '',
            cost: priceNum,
            hostTelegram: (g as any).hostTelegram || '',
            maxPlayers: g.spots,
            isRanked: g.rated,
          };
          setName(origValues.name);
          setDate(origValues.date);
          setTime(origValues.time);
          setLocation(origValues.location);
          setLocationUrl(origValues.locationUrl);
          setCost(origValues.cost);
          setHostTelegram(origValues.hostTelegram);
          setMaxPlayers(origValues.maxPlayers);
          setIsRanked(origValues.isRanked);
          setOrig(origValues);
          setLoading(false);
        }
      }).catch(() => setScreen('dashboard'));
    };
    loadGame();
    let ws: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const connectWs = async () => {
      try {
        const t = await ensureAuth();
        ws = new WebSocket(`wss://opium-server-production.up.railway.app/ws?token=${t}`);
        ws.onopen = () => {
          attempts = 0;
          pingTimer = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
          }, 25000);
        };
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'games:refresh' || msg.type === 'player:joined' || msg.type === 'player:left') {
              loadGame();
            }
          } catch {}
        };
        ws.onclose = () => {
          if (pingTimer) clearInterval(pingTimer);
          if (attempts < 10) {
            reconnectTimer = setTimeout(() => { attempts++; connectWs(); }, Math.min(1000 * 2 ** attempts, 30000));
          }
        };
      } catch {}
    };
    connectWs();

    const interval = setInterval(loadGame, 30000);
    return () => {
      clearInterval(interval);
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [selectedGameId]);

  useEffect(() => {
    fetchUsers().then((users) => {
      const map = new Map<number, ServerUser>();
      users.forEach((u) => map.set(u.id, u));
      setUsersMap(map);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!game || saving) return;
    setSaving(true);
    try {
      await updateGame(game.id, {
        name,
        date,
        time,
        location,
        locationUrl: locationUrl || undefined,
        cost: cost ? Number(cost) : undefined,
        maxPlayers,
        isRanked,
        hostTelegram: hostTelegram.replace(/^@/, '') || undefined,
      });
      setOrig({ name, date, time, location, locationUrl, cost, hostTelegram, maxPlayers, isRanked });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert('Ошибка при сохранении');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!game || deleting) return;
    const confirmed = window.confirm(`Отменить игру "${name}"?\n\nВсем игрокам придёт уведомление об отмене.`);
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteGame(game.id);
      setScreen('dashboard');
    } catch (err) {
      alert('Ошибка при удалении игры');
      setDeleting(false);
    }
  };

  const canStart = game && game.status === 'lobby';

  const handleStart = async () => {
    if (!game || starting) return;
    setStarting(true);
    loadServerGame(game);
  };

  const isFinished = game?.status === 'finished';
  const isActive = game?.status === 'active';
  const isLobby = game?.status === 'lobby';

  const handleResume = async () => {
    if (!game || resuming) return;
    setResuming(true);
    try {
      const restored = await restoreFromServer(game.id);
      if (!restored) {
        loadServerGame(game);
      }
    } catch {
      loadServerGame(game);
    }
    setResuming(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${theme.border.medium}`,
    color: theme.text.primary,
    fontSize: 14,
    outline: 'none',
    fontFamily: theme.font,
  };

  if (loading) {
    return (
      <div style={{ padding: '24px 28px', color: theme.text.dim }}>Загрузка...</div>
    );
  }

  return (
    <div style={{ padding: '24px 28px 120px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div
          onClick={() => setScreen('dashboard')}
          style={{ color: theme.text.muted, fontSize: 13, cursor: 'pointer' }}
        >
          ← Назад
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {game && (
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                background: game.status === 'lobby' ? 'rgba(59,130,246,0.12)' : game.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(136,136,160,0.12)',
                color: game.status === 'lobby' ? '#3B82F6' : game.status === 'active' ? '#22C55E' : '#8888A0',
              }}
            >
              {game.status === 'lobby' ? 'ЛОББИ' : game.status === 'active' ? 'ИДЁТ' : 'ЗАВЕРШЕНА'}
            </span>
          )}
        </div>
      </div>

      <div style={{ color: theme.text.primary, fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
        Детали игры
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Название</div>
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={isFinished} style={{ ...inputStyle, opacity: isFinished ? 0.5 : 1 }} />
      </div>

      <div style={{ marginBottom: 12, display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Дата</div>
          <input
            type="text"
            value={date}
            placeholder="дд/мм/гггг"
            maxLength={10}
            disabled={isFinished}
            onChange={(e) => {
              let v = e.target.value.replace(/[^0-9/]/g, '');
              const digits = v.replace(/\//g, '');
              if (digits.length <= 2) v = digits;
              else if (digits.length <= 4) v = `${digits.slice(0, 2)}/${digits.slice(2)}`;
              else v = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
              setDate(v);
            }}
            style={{ ...inputStyle, opacity: isFinished ? 0.5 : 1 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Время</div>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={isFinished}
            style={{ ...inputStyle, colorScheme: 'dark', opacity: isFinished ? 0.5 : 1 }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Место</div>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Название места"
          disabled={isFinished}
          style={{ ...inputStyle, marginBottom: 6, opacity: isFinished ? 0.5 : 1 }}
        />
        <input
          value={locationUrl}
          onChange={(e) => setLocationUrl(e.target.value)}
          placeholder="Ссылка на Google Maps"
          disabled={isFinished}
          style={{ ...inputStyle, opacity: isFinished ? 0.5 : 1 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Стоимость (PLN)</div>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={cost}
          onChange={(e) => setCost(e.target.value.replace(/[^0-9]/g, ''))}
          disabled={isFinished}
          style={{ ...inputStyle, opacity: isFinished ? 0.5 : 1 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Telegram ведущего</div>
        <input
          value={hostTelegram}
          onChange={(e) => setHostTelegram(e.target.value)}
          placeholder="@username"
          disabled={isFinished}
          style={{ ...inputStyle, opacity: isFinished ? 0.5 : 1 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
          Макс. игроков: {maxPlayers}
        </div>
        <input
          type="range"
          min={10}
          max={20}
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(Number(e.target.value))}
          disabled={isFinished}
          style={{ width: '100%', accentColor: theme.accent.purple, opacity: isFinished ? 0.5 : 1 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', color: theme.text.dim, fontSize: 10 }}>
          <span>10</span><span>20</span>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Тип</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[true, false].map((ranked) => (
            <div
              key={String(ranked)}
              onClick={() => !isFinished && setIsRanked(ranked)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 10,
                cursor: isFinished ? 'default' : 'pointer',
                textAlign: 'center',
                background: isRanked === ranked ? 'rgba(139,92,246,0.15)' : theme.bg.card,
                border: `1px solid ${isRanked === ranked ? 'rgba(139,92,246,0.3)' : theme.border.default}`,
                color: isRanked === ranked ? theme.accent.purple : theme.text.dim,
                fontSize: 13,
                fontWeight: 600,
                opacity: isFinished ? 0.5 : 1,
              }}
            >
              {ranked ? '🏆 Рейтинговая' : '🤝 Товарищеская'}
            </div>
          ))}
        </div>
      </div>

      {isFinished && game && game.players.length > 0 && (() => {
        const winnerLabels: Record<string, { text: string; color: string; icon: string }> = {
          peaceful: { text: 'Победа мирных!', color: '#3B82F6', icon: '🕊️' },
          mafia: { text: 'Победа мафии!', color: '#EF4444', icon: '🎩' },
          werewolf: { text: 'Победа мафии!', color: '#8B5CF6', icon: '🐺' },
        };
        const winnerInfo = winnerLabels[game.winner || 'peaceful'] || winnerLabels.peaceful;
        const sortedPlayers = [...game.players].sort((a, b) => (b.gameRating || 0) - (a.gameRating || 0));

        return (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                textAlign: 'center',
                padding: '16px 20px',
                borderRadius: 14,
                background: `${winnerInfo.color}15`,
                border: `1px solid ${winnerInfo.color}30`,
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 4 }}>{winnerInfo.icon}</div>
              <div style={{ color: winnerInfo.color, fontSize: 18, fontWeight: 800 }}>
                {winnerInfo.text}
              </div>
              {game.winner === 'werewolf' && (
                <div style={{ color: '#8B5CF6', fontSize: 12, marginTop: 2 }}>
                  Оборотень завершил дело мафии
                </div>
              )}
            </div>

            <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
              РЕЗУЛЬТАТЫ ({sortedPlayers.length} игроков)
            </div>
            <div
              style={{
                borderRadius: 12,
                background: theme.bg.card,
                border: `1px solid ${theme.border.default}`,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.02)',
                  borderBottom: `1px solid ${theme.border.default}`,
                }}
              >
                <div style={{ width: 30, color: theme.text.dim, fontSize: 9, fontWeight: 700 }}>#</div>
                <div style={{ width: 30, color: theme.text.dim, fontSize: 9, fontWeight: 700 }}>М</div>
                <div style={{ flex: 1, color: theme.text.dim, fontSize: 9, fontWeight: 700 }}>ИГРОК</div>
                <div style={{ width: 110, color: theme.text.dim, fontSize: 9, fontWeight: 700 }}>РОЛЬ</div>
                <div style={{ width: 50, color: theme.text.dim, fontSize: 9, fontWeight: 700, textAlign: 'center' }}>СТАТУС</div>
                <div style={{ width: 40, color: theme.text.dim, fontSize: 9, fontWeight: 700, textAlign: 'center' }}>ФОЛЫ</div>
                <div style={{ width: 70, color: theme.text.dim, fontSize: 9, fontWeight: 700, textAlign: 'right' }}>РЕЙТИНГ</div>
              </div>

              {sortedPlayers.map((p, i) => {
                const meta = p.role ? ROLE_META[p.role as keyof typeof ROLE_META] : null;
                const teamColor = meta?.color || '#64748B';
                const mafiaRoles = ['don', 'mafia', 'framer', 'enforcer'];
                const isMafia = p.role ? mafiaRoles.includes(p.role) : false;
                const isWerewolf = p.role === 'werewolf';
                const isWinnerTeam =
                  (game.winner === 'peaceful' && !isMafia && !isWerewolf) ||
                  (game.winner === 'mafia' && isMafia) ||
                  (game.winner === 'werewolf' && (isWerewolf || isMafia));

                return (
                  <div
                    key={i}
                    onClick={() => {
                      if (p.userId && usersMap.has(p.userId)) {
                        setSelectedUser(usersMap.get(p.userId)!);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderBottom: `1px solid ${theme.border.subtle}`,
                      background: isWinnerTeam ? `${winnerInfo.color}06` : 'transparent',
                      cursor: p.userId && usersMap.has(p.userId) ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ width: 30, color: i < 3 ? '#F59E0B' : theme.text.dim, fontSize: 12, fontWeight: 700 }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                    </div>
                    <div style={{ width: 30, color: theme.text.dim, fontSize: 11, fontWeight: 600 }}>
                      {p.seat || '—'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: p.alive === false ? theme.text.dim : theme.text.primary, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </div>
                      {p.nick && (
                        <div style={{ color: theme.text.dim, fontSize: 9 }}>{p.nick}</div>
                      )}
                    </div>
                    <div style={{ width: 110 }}>
                      {meta ? (
                        <span style={{ color: teamColor, fontSize: 11, fontWeight: 700 }}>
                          {meta.icon} {meta.nameRu}
                        </span>
                      ) : (
                        <span style={{ color: theme.text.dim, fontSize: 11 }}>—</span>
                      )}
                    </div>
                    <div style={{ width: 50, textAlign: 'center' }}>
                      <span style={{ color: p.alive ? '#22C55E' : '#EF4444', fontSize: 10, fontWeight: 700 }}>
                        {p.alive ? 'Жив' : '☠️'}
                      </span>
                    </div>
                    <div style={{ width: 40, textAlign: 'center' }}>
                      {(p.fouls || 0) > 0 ? (
                        <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                          {Array.from({ length: p.fouls || 0 }).map((_, fi) => (
                            <div
                              key={fi}
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: 3,
                                background: fi >= 2 ? '#EF4444' : '#F59E0B',
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: theme.text.dim, fontSize: 10 }}>—</span>
                      )}
                    </div>
                    <div style={{ width: 70, textAlign: 'right' }}>
                      {p.gameRating !== undefined ? (
                        <span
                          style={{
                            color: p.gameRating >= 0 ? '#22C55E' : '#EF4444',
                            fontSize: 14,
                            fontWeight: 800,
                          }}
                        >
                          {p.gameRating > 0 ? '+' : ''}{p.gameRating}
                        </span>
                      ) : (
                        <span style={{ color: theme.text.dim, fontSize: 10 }}>—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {sortedPlayers.some(p => p.ratingBreakdown) && (
              <div
                style={{
                  marginTop: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: theme.bg.card,
                  border: `1px solid ${theme.border.default}`,
                }}
              >
                <div style={{ color: theme.text.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
                  РАСКЛАДКА РЕЙТИНГОВ
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {sortedPlayers.filter(p => p.ratingBreakdown).map((p, i) => {
                    const bd = p.ratingBreakdown!;
                    const meta = p.role ? ROLE_META[p.role as keyof typeof ROLE_META] : null;
                    return (
                      <div
                        key={i}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.02)',
                          border: `1px solid ${theme.border.subtle}`,
                          minWidth: 170,
                        }}
                      >
                        <div style={{ color: theme.text.secondary, fontSize: 10, fontWeight: 700, marginBottom: 3 }}>
                          {meta ? `(${meta.icon} ${meta.nameRu}) ` : ''}{p.seat || ''}. {p.nick || p.name} ({(bd.total || 0) > 0 ? '+' : ''}{bd.total || 0})
                        </div>
                        {bd.details?.map((d: string, di: number) => (
                          <div key={di} style={{ color: theme.text.dim, fontSize: 9 }}>{d}</div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {!isFinished && game && game.players.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
            Записаны ({game.taken}/{game.spots})
          </div>
          <div style={{
            padding: '10px 14px',
            borderRadius: 10,
            background: theme.bg.card,
            border: `1px solid ${theme.border.subtle}`,
          }}>
            {game.players.map((p, i) => (
              <div
                key={i}
                onClick={() => {
                  if (p.userId && usersMap.has(p.userId)) {
                    setSelectedUser(usersMap.get(p.userId)!);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 0',
                  borderBottom: i < game.players.length - 1 ? `1px solid ${theme.border.subtle}` : 'none',
                  cursor: p.userId && usersMap.has(p.userId) ? 'pointer' : 'default',
                }}
              >
                <span style={{ color: theme.text.dim, fontSize: 11, width: 20 }}>{i + 1}</span>
                <span style={{ color: theme.text.primary, fontSize: 13, flex: 1 }}>{p.name}</span>
                {p.guests != null && p.guests > 0 && (
                  <span style={{ color: theme.text.dim, fontSize: 11 }}>+{p.guests}</span>
                )}
                {isLobby && p.userId && (
                  <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        if (!window.confirm(`Убрать ${p.name} из игры?\n\nИгрок сможет записаться снова.`)) return;
                        removePlayerFromServer(game!.id, p.userId!, false)
                          .then(() => refreshGame())
                          .catch(err => alert(`Ошибка: ${err.message}`));
                      }}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        border: '1px solid rgba(239,68,68,0.3)',
                        background: 'rgba(239,68,68,0.08)',
                        color: '#F87171',
                        fontSize: 10,
                        cursor: 'pointer',
                        fontFamily: theme.font,
                        fontWeight: 600,
                      }}
                    >
                      ✕
                    </button>
                    <button
                      onClick={() => {
                        if (!window.confirm(`Убрать и забанить ${p.name}?\n\nИгрок НЕ сможет записаться на эту игру снова.`)) return;
                        removePlayerFromServer(game!.id, p.userId!, true)
                          .then(() => refreshGame())
                          .catch(err => alert(`Ошибка: ${err.message}`));
                      }}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        border: '1px solid rgba(239,68,68,0.5)',
                        background: 'rgba(239,68,68,0.15)',
                        color: '#EF4444',
                        fontSize: 10,
                        cursor: 'pointer',
                        fontFamily: theme.font,
                        fontWeight: 600,
                      }}
                    >
                      🚫
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isFinished && (
        <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingBottom: 20 }}>
          <button
            onClick={() => setScreen('dashboard')}
            style={{
              padding: '10px 24px',
              borderRadius: 10,
              border: 'none',
              background: theme.gradient.indigo,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: theme.font,
            }}
          >
            ← Назад
          </button>
        </div>
      )}
      {!isFinished && (
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            onClick={() => setScreen('dashboard')}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: `1px solid ${theme.border.medium}`,
              background: 'transparent',
              color: theme.text.muted,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: theme.font,
            }}
          >
            Назад
          </button>
          {isLobby && (
            <button
              onClick={handleStart}
              disabled={starting || !canStart}
              title={!canStart ? `Нужно ${game?.spots} игроков (сейчас ${game?.taken})` : ''}
              style={{
                padding: '10px 24px',
                borderRadius: 10,
                border: 'none',
                background: canStart ? theme.gradient.indigo : 'rgba(255,255,255,0.06)',
                color: canStart ? '#fff' : 'rgba(255,255,255,0.25)',
                fontSize: 13,
                fontWeight: 700,
                cursor: starting ? 'wait' : canStart ? 'pointer' : 'not-allowed',
                fontFamily: theme.font,
              }}
            >
              {starting ? 'Запуск...' : `Начать игру${!canStart ? ` (${game?.taken}/${game?.spots})` : ''}`}
            </button>
          )}
          {isActive && (
            <button
              onClick={handleResume}
              disabled={resuming}
              style={{
                padding: '10px 24px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #22C55E, #059669)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: resuming ? 'wait' : 'pointer',
                fontFamily: theme.font,
                boxShadow: '0 4px 16px rgba(34,197,94,0.3)',
              }}
            >
              {resuming ? 'Загрузка...' : '▶ Продолжить игру'}
            </button>
          )}
          {(hasChanges || saved) && (
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              style={{
                padding: '10px 24px',
                borderRadius: 10,
                border: 'none',
                background: saved ? 'rgba(34,197,94,0.2)' : hasChanges ? theme.gradient.green : 'rgba(255,255,255,0.06)',
                color: saved ? '#22C55E' : hasChanges ? '#fff' : 'rgba(255,255,255,0.25)',
                fontSize: 13,
                fontWeight: 700,
                cursor: saving ? 'wait' : hasChanges ? 'pointer' : 'not-allowed',
                fontFamily: theme.font,
              }}
            >
              {saving ? 'Сохраняю...' : saved ? '✓ Сохранено' : '✓ Сохранить'}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.1)',
              color: '#EF4444',
              fontSize: 13,
              fontWeight: 600,
              cursor: deleting ? 'wait' : 'pointer',
              fontFamily: theme.font,
            }}
          >
            {deleting ? '...' : 'Отменить игру'}
          </button>
        </div>
      )}

      {selectedUser && (
        <PlayerPopup
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onUserUpdated={() => {
            refreshGame();
            fetchUsers().then((users) => {
              const map = new Map<number, ServerUser>();
              users.forEach((u) => map.set(u.id, u));
              setUsersMap(map);
            }).catch(() => {});
          }}
        />
      )}
    </div>
  );
};
