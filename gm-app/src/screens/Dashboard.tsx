import React, { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { useGameStore } from '../store/gameStore';
import { fetchStats, GlobalStats, fetchGames, deleteGame, ServerGame } from '../api';

const statusLabels: Record<string, { text: string; color: string; bg: string }> = {
  lobby: { text: 'ЛОББИ', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  active: { text: 'ИДЁТ', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  finished: { text: 'ЗАВЕРШЕНА', color: '#8888A0', bg: 'rgba(136,136,160,0.12)' },
};

export const Dashboard: React.FC = () => {
  const setScreen = useGameStore((s) => s.setScreen);
  const setSelectedGameId = useGameStore((s) => s.setSelectedGameId);
  const loadServerGame = useGameStore((s) => s.loadServerGame);
  const restoreFromServer = useGameStore((s) => s.restoreFromServer);
  const [stats, setStats] = useState<GlobalStats>({ totalPlayers: 0, totalGames: 0 });
  const [games, setGames] = useState<ServerGame[]>([]);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'lobby' | 'active' | 'finished'>('all');

  const loadData = useCallback(() => {
    fetchStats().then(setStats).catch(() => {});
    fetchGames().then(setGames).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleDelete = async (game: ServerGame) => {
    if (game.status === 'finished') return;
    const confirmed = window.confirm(`Отменить игру "${game.title}"?\n\nВсем игрокам придёт уведомление об отмене.`);
    if (!confirmed) return;
    setDeleting(game.id);
    try {
      await deleteGame(game.id);
      setGames((prev) => prev.filter((g) => g.id !== game.id));
    } catch (err) {
      alert('Ошибка при удалении игры');
    }
    setDeleting(null);
  };

  const searchLower = search.toLowerCase();
  const filtered = games
    .filter((g) => filter === 'all' || g.status === filter)
    .filter((g) =>
      !search ||
      g.title.toLowerCase().includes(searchLower) ||
      g.place.toLowerCase().includes(searchLower) ||
      g.players.some((p) => p.name.toLowerCase().includes(searchLower))
    );
  const activeGames = filtered.filter((g) => g.status !== 'finished' && g.status !== 'cancelled');
  const finishedGames = filtered.filter((g) => g.status === 'finished');

  return (
    <div style={{ padding: '24px 28px 120px', maxWidth: 800, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ color: theme.text.primary, fontSize: 26, fontWeight: 800 }}>
            Opium Mafia
          </div>
          <div style={{ color: theme.text.dim, fontSize: 13, marginTop: 2 }}>
            Game Master Panel
          </div>
        </div>
        <div
          onClick={() => setScreen('gameSetup')}
          style={{
            padding: '8px 16px',
            borderRadius: 12,
            cursor: 'pointer',
            background: theme.gradient.mafia,
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          + Новая игра
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[
          { l: 'Игроков', v: String(stats.totalPlayers), i: '👥', c: '#3B82F6' },
          { l: 'Игр', v: String(stats.totalGames), i: '🎮', c: '#22C55E' },
        ].map((s, i) => (
          <div
            key={i}
            onClick={() => setScreen(i === 0 ? 'players' : 'stats')}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 14,
              background: theme.bg.card,
              border: `1px solid ${theme.border.default}`,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 18 }}>{s.i}</span>
              <span style={{ color: s.c, fontSize: 10, fontWeight: 700 }}>{s.l}</span>
            </div>
            <div style={{ color: theme.text.primary, fontSize: 26, fontWeight: 800 }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
            ИГРЫ ({filtered.length})
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

        {activeGames.length === 0 && finishedGames.length === 0 ? (
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
            Нет игр. Нажмите «+ Новая игра» чтобы начать.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeGames.map((g) => {
              const st = statusLabels[g.status] || statusLabels.lobby;
              return (
                <div
                  key={g.id}
                  onClick={async () => {
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
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: theme.bg.card,
                    border: `1px solid ${theme.border.default}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ color: theme.text.primary, fontSize: 15, fontWeight: 700 }}>
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
                    <div
                      onClick={(e) => { e.stopPropagation(); handleDelete(g); }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 8,
                        cursor: deleting === g.id ? 'wait' : 'pointer',
                        background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        color: '#F87171',
                        fontSize: 12,
                        fontWeight: 600,
                        opacity: deleting === g.id ? 0.5 : 1,
                      }}
                    >
                      {deleting === g.id ? '...' : 'Отменить'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, color: theme.text.muted, fontSize: 12 }}>
                    <span>📅 {[g.date, g.time].filter(Boolean).join(' ')}</span>
                    <span>📍 {g.place}</span>
                    {g.price && <span>💰 {g.price}</span>}
                    <span>👥 {g.taken}/{g.spots}</span>
                  </div>
                </div>
              );
            })}

            {finishedGames.length > 0 && (
              <>
                <div
                  style={{
                    color: theme.text.dim,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1,
                    marginTop: 8,
                    marginBottom: 2,
                  }}
                >
                  ЗАВЕРШЁННЫЕ
                </div>
                {finishedGames.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => {
                      setSelectedGameId(g.id);
                      setScreen('gameDetails');
                    }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 14,
                      background: theme.bg.card,
                      border: `1px solid ${theme.border.subtle}`,
                      opacity: 0.6,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: theme.text.secondary, fontSize: 14, fontWeight: 600 }}>
                        {g.title}
                      </div>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: 6,
                          fontSize: 9,
                          fontWeight: 700,
                          background: 'rgba(136,136,160,0.12)',
                          color: '#8888A0',
                        }}
                      >
                        ЗАВЕРШЕНА
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, color: theme.text.dim, fontSize: 11, marginTop: 4 }}>
                      <span>📅 {[g.date, g.time].filter(Boolean).join(' ')}</span>
                      <span>👥 {g.taken}/{g.spots}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
