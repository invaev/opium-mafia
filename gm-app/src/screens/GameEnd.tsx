import React, { useState } from 'react';
import { theme } from '../theme';
import { useGameStore } from '../store/gameStore';
import { cloneGame } from '../api';
import { ROLE_META } from '@shared/types';
import { EyeToggle } from '../components/EyeToggle';

export const GameEnd: React.FC = () => {
  const game = useGameStore((s) => s.game);
  const ratings = useGameStore((s) => s.ratings);
  const setScreen = useGameStore((s) => s.setScreen);
  const rolesHidden = useGameStore((s) => s.rolesHidden);

  const [cloning, setCloning] = useState(false);

  if (!game) return null;

  const winnerLabels: Record<string, { text: string; color: string; icon: string; gradient: string }> = {
    peaceful: {
      text: 'Победа мирных!',
      color: '#3B82F6',
      icon: '🕊️',
      gradient: theme.gradient.peaceful,
    },
    mafia: {
      text: 'Победа мафии!',
      color: '#EF4444',
      icon: '🎩',
      gradient: theme.gradient.mafia,
    },
    werewolf: {
      text: 'Победа мафии!',
      color: '#8B5CF6',
      icon: '🐺',
      gradient: 'linear-gradient(135deg,#8B5CF6,#6D28D9)',
    },
  };

  const winnerInfo = winnerLabels[game.winner || 'peaceful'] || winnerLabels.peaceful;

  const sortedPlayers = [...game.players].sort((a, b) => {
    const ra = ratings.get(a.seat)?.total || 0;
    const rb = ratings.get(b.seat)?.total || 0;
    return rb - ra;
  });

  return (
    <div style={{ padding: '20px 24px 120px', overflowY: 'auto', height: '100%', maxWidth: 900, margin: '0 auto' }}>
      <EyeToggle />
      <div
        style={{
          textAlign: 'center',
          padding: '28px 32px',
          borderRadius: 20,
          background: winnerInfo.gradient,
          marginBottom: 20,
          boxShadow: `0 8px 32px ${winnerInfo.color}40`,
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 8 }}>{winnerInfo.icon}</div>
        <div style={{ color: '#fff', fontSize: 28, fontWeight: 800 }}>
          {winnerInfo.text}
        </div>
        {game.winner === 'werewolf' && (
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: 600, marginTop: 4 }}>
            🐺 Оборотень завершил дело мафии
          </div>
        )}
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 }}>
          {game.name} · {game.dayNumber} дней
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Игроков', v: String(game.playerCount), c: theme.accent.blue },
          { l: 'Дней', v: String(game.dayNumber), c: theme.accent.orange },
          { l: 'Выжило', v: String(game.players.filter((p) => p.alive).length), c: theme.accent.green },
          { l: 'Погибло', v: String(game.players.filter((p) => !p.alive).length), c: theme.accent.red },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              padding: '12px 14px',
              borderRadius: 12,
              background: theme.bg.card,
              border: `1px solid ${theme.border.default}`,
              textAlign: 'center',
            }}
          >
            <div style={{ color: s.c, fontSize: 24, fontWeight: 800 }}>{s.v}</div>
            <div style={{ color: theme.text.dim, fontSize: 10, fontWeight: 600 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          borderRadius: 14,
          background: theme.bg.card,
          border: `1px solid ${theme.border.default}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.02)',
            borderBottom: `1px solid ${theme.border.default}`,
          }}
        >
          <div style={{ width: 40, color: theme.text.dim, fontSize: 9, fontWeight: 700 }}>#</div>
          <div style={{ flex: 1, color: theme.text.dim, fontSize: 9, fontWeight: 700 }}>ИГРОК</div>
          <div style={{ width: 120, color: theme.text.dim, fontSize: 9, fontWeight: 700 }}>РОЛЬ</div>
          <div style={{ width: 60, color: theme.text.dim, fontSize: 9, fontWeight: 700, textAlign: 'center' }}>СТАТУС</div>
          <div style={{ width: 60, color: theme.text.dim, fontSize: 9, fontWeight: 700, textAlign: 'center' }}>ФОЛЫ</div>
          <div style={{ width: 80, color: theme.text.dim, fontSize: 9, fontWeight: 700, textAlign: 'right' }}>РЕЙТИНГ</div>
        </div>

        {sortedPlayers.map((p, i) => {
          const meta = ROLE_META[p.role];
          const rating = ratings.get(p.seat);
          const teamColor = theme.team[p.team] || '#64748B';
          const isWinnerTeam =
            (game.winner === 'peaceful' && p.team === 'peaceful' && p.role !== 'werewolf') ||
            (game.winner === 'mafia' && p.team === 'mafia') ||
            (game.winner === 'werewolf' && (p.role === 'werewolf' || p.team === 'mafia'));

          return (
            <div
              key={p.seat}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 14px',
                borderBottom: `1px solid ${theme.border.subtle}`,
                background: isWinnerTeam ? `${winnerInfo.color}08` : 'transparent',
              }}
            >
              <div style={{ width: 40, color: theme.text.dim, fontSize: 12, fontWeight: 700 }}>
                {p.seat}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    background: `linear-gradient(135deg,${p.avatar?.colors[0] || '#64748B'},${p.avatar?.colors[1] || '#1E293B'})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    opacity: p.alive ? 1 : 0.4,
                    border: `1.5px solid ${teamColor}40`,
                  }}
                >
                  {p.avatar?.emoji || '👤'}
                </div>
                <div>
                  <div style={{ color: p.alive ? theme.text.primary : theme.text.dead, fontSize: 12, fontWeight: 600 }}>
                    {p.name}
                  </div>
                  <div style={{ color: theme.text.dim, fontSize: 9 }}>{p.nick}</div>
                </div>
              </div>
              <div style={{ width: 120 }}>
                {rolesHidden ? (
                  <span style={{ color: '#22C55E', fontSize: 11, fontWeight: 700 }}>Игрок</span>
                ) : (
                  <span style={{ color: meta.color, fontSize: 11, fontWeight: 700 }}>
                    {meta.icon} {meta.nameRu}
                  </span>
                )}
              </div>
              <div style={{ width: 60, textAlign: 'center' }}>
                <span
                  style={{
                    color: p.alive ? '#22C55E' : '#EF4444',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {p.alive ? 'Жив' : '☠️'}
                </span>
              </div>
              <div style={{ width: 60, textAlign: 'center' }}>
                {p.fouls > 0 ? (
                  <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    {Array.from({ length: p.fouls }).map((_, fi) => (
                      <div
                        key={fi}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          background: fi >= 2 ? '#EF4444' : '#F59E0B',
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <span style={{ color: theme.text.dark, fontSize: 10 }}>—</span>
                )}
              </div>
              <div style={{ width: 80, textAlign: 'right' }}>
                {rating ? (
                  <span
                    style={{
                      color: rating.total >= 0 ? '#22C55E' : '#EF4444',
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    {rating.total > 0 ? '+' : ''}{rating.total}
                  </span>
                ) : (
                  <span style={{ color: theme.text.dark, fontSize: 10 }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {ratings.size > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: '14px 16px',
            borderRadius: 12,
            background: theme.bg.card,
            border: `1px solid ${theme.border.default}`,
          }}
        >
          <div style={{ color: theme.text.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
            РАСКЛАДКА РЕЙТИНГОВ
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {sortedPlayers.map((p) => {
              const rating = ratings.get(p.seat);
              if (!rating) return null;
              return (
                <div
                  key={p.seat}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${theme.border.subtle}`,
                    minWidth: 180,
                  }}
                >
                  <div style={{ color: theme.text.secondary, fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    ({ROLE_META[p.role].icon} {ROLE_META[p.role].nameRu}) {p.seat}. {(p.nick || p.name).replace('@', '')} ({rating.total > 0 ? '+' : ''}{rating.total})
                  </div>
                  {rating.details.map((d, i) => (
                    <div key={i} style={{ color: theme.text.dim, fontSize: 9 }}>
                      {d}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, paddingBottom: 20 }}>
        <button
          onClick={() => setScreen('dashboard')}
          style={{
            padding: '12px 28px',
            borderRadius: 12,
            border: 'none',
            background: theme.gradient.indigo,
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: theme.font,
          }}
        >
          🏠 На главную
        </button>
        <button
          onClick={async () => {
            try {
              setCloning(true);
              const result = await cloneGame(game.id);
              alert(`Игра "${result.name}" создана! Добавлено ${result.playersAdded} игроков.`);
              setScreen('dashboard');
            } catch (err: any) {
              alert(`Ошибка: ${err.message}`);
            } finally {
              setCloning(false);
            }
          }}
          disabled={cloning}
          style={{
            padding: '12px 24px',
            borderRadius: 12,
            border: 'none',
            background: cloning ? '#555' : 'linear-gradient(135deg, #F59E0B, #D97706)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: cloning ? 'not-allowed' : 'pointer',
            fontFamily: theme.font,
            opacity: cloning ? 0.7 : 1,
          }}
        >
          {cloning ? '⏳ Создание...' : '🔄 Создать из этой'}
        </button>
        <button
          onClick={() => {
            setScreen('gameSetup');
          }}
          style={{
            padding: '12px 24px',
            borderRadius: 12,
            border: `1px solid ${theme.border.medium}`,
            background: 'transparent',
            color: theme.text.muted,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: theme.font,
          }}
        >
          ➕ Новая игра
        </button>
      </div>
    </div>
  );
};
