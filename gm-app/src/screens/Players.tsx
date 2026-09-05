import React, { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { fetchUsers, ServerUser } from '../api';
import { PlayerPopup } from '../components/PlayerPopup';

const AVATAR_STYLE_COLORS: Array<[string, string]> = [
  ['#3B82F6', '#8B5CF6'],
  ['#EF4444', '#F59E0B'],
  ['#22C55E', '#059669'],
  ['#06B6D4', '#3B82F6'],
  ['#F59E0B', '#EC4899'],
  ['#6366F1', '#1E1B4B'],
  ['#64748B', '#1E293B'],
  ['#DC2626', '#991B1B'],
];

const FALLBACK_COLORS: Array<[string, string]> = [
  ['#3B82F6', '#8B5CF6'],
  ['#EC4899', '#F59E0B'],
  ['#EF4444', '#DC2626'],
  ['#06B6D4', '#3B82F6'],
  ['#64748B', '#1E293B'],
  ['#6366F1', '#1E1B4B'],
  ['#F59E0B', '#DC2626'],
  ['#22C55E', '#059669'],
];

export const Players: React.FC = () => {
  const [search, setSearch] = useState('');
  const [players, setPlayers] = useState<ServerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ServerUser | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'banned'>('all');

  const loadUsers = useCallback(() => {
    setLoading(true);
    fetchUsers()
      .then(setPlayers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const searchLower = search.toLowerCase();
  const filtered = players
    .filter((p) => {
      if (filter === 'banned') return p.banned;
      if (filter === 'active') return !p.banned;
      return true;
    })
    .filter(
      (p) =>
        p.displayName.toLowerCase().includes(searchLower) ||
        (p.nickname || '').toLowerCase().includes(searchLower) ||
        (p.instagramUsername || '').toLowerCase().includes(searchLower)
    )
    .sort((a, b) => {
      if (a.banned !== b.banned) return a.banned ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const bannedCount = players.filter((p) => p.banned).length;

  return (
    <div style={{ padding: '20px 24px 80px', maxWidth: 900, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div style={{ color: theme.text.primary, fontSize: 20, fontWeight: 700 }}>
          Игроки <span style={{ color: theme.text.dim, fontSize: 14, fontWeight: 500 }}>({players.length})</span>
          {bannedCount > 0 && (
            <span style={{ color: '#EF4444', fontSize: 12, fontWeight: 600, marginLeft: 8 }}>
              {bannedCount} бан
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'active', 'banned'] as const).map((f) => (
              <div
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: filter === f ? (f === 'banned' ? 'rgba(239,68,68,0.15)' : 'rgba(139,92,246,0.15)') : 'transparent',
                  color: filter === f ? (f === 'banned' ? '#EF4444' : theme.accent.purple) : theme.text.dim,
                  border: filter === f ? `1px solid ${f === 'banned' ? 'rgba(239,68,68,0.3)' : 'rgba(139,92,246,0.3)'}` : '1px solid transparent',
                }}
              >
                {f === 'all' ? 'Все' : f === 'active' ? 'Активные' : 'Забанены'}
              </div>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, @username, инсте..."
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${theme.border.medium}`,
              color: theme.text.primary,
              fontSize: 13,
              outline: 'none',
              width: 280,
              fontFamily: theme.font,
            }}
          />
        </div>
      </div>

      {loading && (
        <div style={{ color: theme.text.dim, fontSize: 13, textAlign: 'center', padding: 24 }}>
          Загрузка...
        </div>
      )}

      {error && (
        <div style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', padding: 24 }}>
          Ошибка: {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
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
          {filter === 'banned' ? 'Нет забаненных игроков.' : 'Нет игроков.'}
        </div>
      )}

      {filtered.map((p, i) => {
        const colors = p.avatarColorIndex != null
          ? AVATAR_STYLE_COLORS[p.avatarColorIndex] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]
          : FALLBACK_COLORS[i % FALLBACK_COLORS.length];
        return (
          <div
            key={p.id}
            onClick={() => setSelected(p)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 10,
              marginBottom: 4,
              cursor: 'pointer',
              background: selected?.id === p.id ? 'rgba(255,255,255,0.06)' : theme.bg.card,
              border: `1px solid ${p.banned ? 'rgba(239,68,68,0.3)' : selected?.id === p.id ? theme.border.medium : theme.border.subtle}`,
              opacity: p.banned ? 0.6 : 1,
            }}
          >
            {p.avatarEmoji ? (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  background: p.banned
                    ? 'linear-gradient(135deg,#EF4444,#991B1B)'
                    : `linear-gradient(135deg,${colors[0]},${colors[1]})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {p.avatarEmoji}
              </div>
            ) : p.avatarUrl ? (
              <img
                src={p.avatarUrl}
                alt=""
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  objectFit: 'cover',
                  flexShrink: 0,
                  border: p.banned ? '2px solid #EF4444' : 'none',
                }}
              />
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  background: p.banned
                    ? 'linear-gradient(135deg,#EF4444,#991B1B)'
                    : `linear-gradient(135deg,${colors[0]},${colors[1]})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                {p.displayName.charAt(0)}
              </div>
            )}

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: theme.text.primary, fontSize: 13, fontWeight: 600 }}>
                  {p.displayName}
                </span>
                {p.banned && (
                  <span style={{
                    padding: '1px 5px',
                    borderRadius: 4,
                    fontSize: 8,
                    fontWeight: 700,
                    background: 'rgba(239,68,68,0.15)',
                    color: '#EF4444',
                    border: '1px solid rgba(239,68,68,0.3)',
                  }}>
                    БАН
                  </span>
                )}
              </div>
              <div style={{ color: theme.text.dim, fontSize: 11 }}>
                {p.nickname ? `@${p.nickname}` : ''}{p.nickname && p.instagramUsername ? ' · ' : ''}{p.instagramUsername ? `@${p.instagramUsername}` : ''} {p.gamesPlayed > 0 ? `· ${p.gamesPlayed} игр` : ''}
              </div>
            </div>

            <span style={{ color: p.banned ? '#EF4444' : theme.accent.orange, fontSize: 13, fontWeight: 700 }}>
              {p.totalRating}
            </span>
          </div>
        );
      })}

      {selected && (
        <PlayerPopup
          user={selected}
          onClose={() => setSelected(null)}
          onUserUpdated={loadUsers}
        />
      )}
    </div>
  );
};
