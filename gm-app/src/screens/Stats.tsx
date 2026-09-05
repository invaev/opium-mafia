import React, { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { useGameStore } from '../store/gameStore';
import { fetchGames, fetchUsers, ServerGame, ServerUser } from '../api';

const statusLabels: Record<string, { text: string; color: string; bg: string }> = {
  lobby: { text: 'ЛОББИ', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  active: { text: 'ИДЁТ', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  finished: { text: 'ЗАВЕРШЕНА', color: '#8888A0', bg: 'rgba(136,136,160,0.12)' },
};

const winnerLabels: Record<string, { text: string; color: string }> = {
  peaceful: { text: 'Мирные', color: '#3B82F6' },
  mafia: { text: 'Мафия', color: '#EF4444' },
  werewolf: { text: 'Оборотень', color: '#8B5CF6' },
};

export const Stats: React.FC = () => {
  const setScreen = useGameStore((s) => s.setScreen);
  const setSelectedGameId = useGameStore((s) => s.setSelectedGameId);
  const restoreFromServer = useGameStore((s) => s.restoreFromServer);
  const loadServerGame = useGameStore((s) => s.loadServerGame);

  const [games, setGames] = useState<ServerGame[]>([]);
  const [users, setUsers] = useState<ServerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'lobby' | 'active' | 'finished'>('all');
  const [gameSearch, setGameSearch] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [g, u] = await Promise.all([fetchGames(), fetchUsers()]);
      setGames(g);
      setUsers(u);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const totalGames = games.length;
  const finishedGames = games.filter((g) => g.status === 'finished');
  const peacefulWins = finishedGames.filter((g) => g.winner === 'peaceful').length;
  const mafiaWins = finishedGames.filter((g) => g.winner === 'mafia').length;
  const werewolfWins = finishedGames.filter((g) => g.winner === 'werewolf').length;
  const totalPlayers = users.length;
  const avgRating = users.length > 0
    ? Math.round(users.reduce((sum, u) => sum + u.totalRating, 0) / users.length)
    : 0;

  const gameSearchLower = gameSearch.toLowerCase();
  const filteredGames = games
    .filter((g) => filter === 'all' || g.status === filter)
    .filter((g) =>
      !gameSearch ||
      g.title.toLowerCase().includes(gameSearchLower) ||
      g.place.toLowerCase().includes(gameSearchLower) ||
      g.players.some((p) => p.name.toLowerCase().includes(gameSearchLower))
    );

  const playerSearchLower = playerSearch.toLowerCase();
  const topPlayers = [...users]
    .filter((u) => !u.banned)
    .filter((u) =>
      !playerSearch ||
      u.displayName.toLowerCase().includes(playerSearchLower) ||
      (u.nickname || '').toLowerCase().includes(playerSearchLower)
    )
    .sort((a, b) => b.totalRating - a.totalRating)
    .slice(0, 10);

  const handleGameClick = async (g: ServerGame) => {
    if (g.status === 'active') {
      const restored = await restoreFromServer(g.id);
      if (!restored) {
        setSelectedGameId(g.id);
        setScreen('gameDetails');
      }
    } else {
      setSelectedGameId(g.id);
      setScreen('gameDetails');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px 28px', color: theme.text.dim }}>Загрузка...</div>
    );
  }

  return (
    <div style={{ padding: '24px 28px 120px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ color: theme.text.primary, fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
        Статистика
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
        {[
          { l: 'Игр', v: String(totalGames) },
          { l: 'Баланс побед', v: `${peacefulWins}/${mafiaWins}${werewolfWins > 0 ? `/${werewolfWins}` : ''}` },
          { l: 'Ср. рейтинг', v: String(avgRating) },
          { l: 'Игроков', v: String(totalPlayers) },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 14,
              background: theme.bg.card,
              border: `1px solid ${theme.border.default}`,
            }}
          >
            <div style={{ color: theme.text.dim, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
              {s.l}
            </div>
            <div style={{ color: theme.text.primary, fontSize: 24, fontWeight: 800 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {finishedGames.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
            БАЛАНС ПОБЕД
          </div>
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
            {peacefulWins > 0 && (
              <div style={{ flex: peacefulWins, background: '#3B82F6', transition: 'flex 0.3s' }} />
            )}
            {mafiaWins > 0 && (
              <div style={{ flex: mafiaWins, background: '#EF4444', transition: 'flex 0.3s' }} />
            )}
            {werewolfWins > 0 && (
              <div style={{ flex: werewolfWins, background: '#8B5CF6', transition: 'flex 0.3s' }} />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ color: '#3B82F6', fontSize: 10, fontWeight: 700 }}>Мирные {peacefulWins}</span>
            <span style={{ color: '#EF4444', fontSize: 10, fontWeight: 700 }}>Мафия {mafiaWins}</span>
            {werewolfWins > 0 && <span style={{ color: '#8B5CF6', fontSize: 10, fontWeight: 700 }}>Оборотень {werewolfWins}</span>}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
            ТОП ИГРОКОВ
          </div>
          <input
            value={playerSearch}
            onChange={(e) => setPlayerSearch(e.target.value)}
            placeholder="Поиск игрока..."
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${theme.border.medium}`,
              color: theme.text.primary,
              fontSize: 12,
              outline: 'none',
              width: 180,
              fontFamily: theme.font,
            }}
          />
        </div>
        {topPlayers.length > 0 ? (
          <div
            style={{
              borderRadius: 12,
              background: theme.bg.card,
              border: `1px solid ${theme.border.subtle}`,
              overflow: 'hidden',
            }}
          >
            {topPlayers.map((u, i) => (
              <div
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 14px',
                  borderBottom: i < topPlayers.length - 1 ? `1px solid ${theme.border.subtle}` : 'none',
                }}
              >
                <div style={{
                  width: 22,
                  textAlign: 'center',
                  color: i < 3 ? '#F59E0B' : theme.text.dim,
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: theme.text.primary, fontSize: 13, fontWeight: 600 }}>
                    {u.displayName}
                  </div>
                  <div style={{ color: theme.text.dim, fontSize: 10 }}>
                    {u.gamesPlayed} игр · {u.gamesWon} побед
                  </div>
                </div>
                <div style={{ color: '#F59E0B', fontSize: 14, fontWeight: 800 }}>
                  {u.totalRating}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: '24px 14px',
              borderRadius: 12,
              background: theme.bg.card,
              border: `1px solid ${theme.border.subtle}`,
              color: theme.text.dim,
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            Нет данных. Проведите первую игру.
          </div>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
            ВСЕ ИГРЫ ({filteredGames.length})
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'lobby', 'active', 'finished'] as const).map((f) => (
                <div
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: filter === f ? 'rgba(139,92,246,0.15)' : 'transparent',
                    color: filter === f ? theme.accent.purple : theme.text.dim,
                    border: filter === f ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
                  }}
                >
                  {f === 'all' ? 'Все' : f === 'lobby' ? 'Лобби' : f === 'active' ? 'Активные' : 'Завершённые'}
                </div>
              ))}
            </div>
            <input
              value={gameSearch}
              onChange={(e) => setGameSearch(e.target.value)}
              placeholder="Поиск игр..."
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${theme.border.medium}`,
                color: theme.text.primary,
                fontSize: 12,
                outline: 'none',
                width: 180,
                fontFamily: theme.font,
              }}
            />
          </div>
        </div>

        {filteredGames.length === 0 ? (
          <div
            style={{
              padding: '20px 14px',
              borderRadius: 12,
              background: theme.bg.card,
              border: `1px solid ${theme.border.subtle}`,
              color: theme.text.dim,
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            {filter === 'all' ? 'Нет игр' : 'Нет игр с этим статусом'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredGames.map((g) => {
              const st = statusLabels[g.status] || statusLabels.lobby;
              const winner = g.winner ? winnerLabels[g.winner] : null;
              return (
                <div
                  key={g.id}
                  onClick={() => handleGameClick(g)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 14,
                    background: theme.bg.card,
                    border: `1px solid ${theme.border.default}`,
                    cursor: 'pointer',
                    opacity: g.status === 'finished' ? 0.8 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ color: theme.text.primary, fontSize: 14, fontWeight: 700 }}>
                        {g.title}
                      </div>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: 6,
                          fontSize: 9,
                          fontWeight: 700,
                          background: st.bg,
                          color: st.color,
                        }}
                      >
                        {st.text}
                      </span>
                    </div>
                    <div style={{ color: theme.text.dim, fontSize: 12 }}>#{g.id}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 14, color: theme.text.muted, fontSize: 11, flexWrap: 'wrap' }}>
                    <span>📅 {[g.date, g.time].filter(Boolean).join(' ')}</span>
                    <span>📍 {g.place}</span>
                    <span>👥 {g.taken}/{g.spots}</span>
                    {g.price && <span>💰 {g.price}</span>}
                    {winner && (
                      <span style={{ color: winner.color, fontWeight: 700 }}>
                        🏆 {winner.text}
                      </span>
                    )}
                  </div>
                  {g.players.length > 0 && (
                    <div style={{ marginTop: 4, color: theme.text.dim, fontSize: 10, lineHeight: 1.4 }}>
                      {g.players.slice(0, 6).map((p) => p.name).join(', ')}
                      {g.players.length > 6 && ` +${g.players.length - 6}`}
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
