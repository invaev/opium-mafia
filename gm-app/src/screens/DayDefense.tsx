import React from 'react';
import { theme } from '../theme';
import { useGameStore } from '../store/gameStore';
import { PlayerList } from '../components/PlayerList';
import { Timer } from '../components/Timer';
import { PhaseBadge } from '../components/PhaseBadge';
import { EyeToggle } from '../components/EyeToggle';
import { getTimerSettings } from '@shared/types';

export const DayDefense: React.FC = () => {
  const game = useGameStore((s) => s.game);
  const nominees = useGameStore((s) => s.nominees);
  const currentDefenseIndex = useGameStore((s) => s.currentDefenseIndex);
  const setDefenseIndex = useGameStore((s) => s.setDefenseIndex);
  const startVoting = useGameStore((s) => s.startVoting);

  if (!game) return null;

  const nomineePlayers = nominees
    .map((seat) => game.players.find((p) => p.seat === seat))
    .filter(Boolean) as typeof game.players;

  if (nomineePlayers.length === 0) return null;

  const cur = nomineePlayers[currentDefenseIndex];
  const timerSettings = getTimerSettings(game.playerCount);
  const avatarColors = cur?.avatar?.colors || ['#64748B', '#1E293B'];

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <EyeToggle />
      <PlayerList players={game.players} phase="ДЕНЬ" night={game.dayNumber} />
      <div
        style={{
          flex: 1,
          padding: '24px 24px 120px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflowY: 'auto',
        }}
      >
        <PhaseBadge
          icon="🛡️"
          label="ЗАЩИТНЫЕ РЕЧИ"
          color="#6366F1"
          sub={`День ${game.dayNumber} · Кандидат ${currentDefenseIndex + 1} из ${nomineePlayers.length}`}
        />

        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {nomineePlayers.map((_, i) => (
            <div
              key={i}
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                background: i <= currentDefenseIndex ? '#6366F1' : 'rgba(255,255,255,0.06)',
              }}
            />
          ))}
        </div>

        {cur && (
          <div
            style={{
              padding: 24,
              borderRadius: 18,
              textAlign: 'center',
              marginBottom: 20,
              background: theme.bg.card,
              border: `1px solid ${theme.border.default}`,
              minWidth: 300,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                margin: '0 auto 12px',
                background: `linear-gradient(135deg,${avatarColors[0]},${avatarColors[1]})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
              }}
            >
              {cur.avatar?.emoji || '👤'}
            </div>
            <div style={{ color: theme.text.primary, fontSize: 20, fontWeight: 700 }}>
              {cur.seat}. {(cur.nick || cur.name).replace('@', '')}
            </div>
            <div style={{ color: theme.text.dim, fontSize: 12, marginTop: 2 }}>
              Защитная речь · остальные молчат
            </div>
          </div>
        )}

        <Timer seconds={timerSettings.defense} label="Защита" interactive />

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {currentDefenseIndex > 0 && (
            <button
              onClick={() => setDefenseIndex(currentDefenseIndex - 1)}
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
              ← Пред.
            </button>
          )}
          {currentDefenseIndex < nomineePlayers.length - 1 ? (
            <button
              onClick={() => setDefenseIndex(currentDefenseIndex + 1)}
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
              Следующий →
            </button>
          ) : (
            <button
              onClick={startVoting}
              style={{
                padding: '10px 24px',
                borderRadius: 10,
                border: 'none',
                background: theme.gradient.mafia,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: theme.font,
              }}
            >
              🗳️ Голосование →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
