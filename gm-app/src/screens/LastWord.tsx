import React from 'react';
import { theme } from '../theme';
import { useGameStore } from '../store/gameStore';
import { PlayerList } from '../components/PlayerList';
import { Timer } from '../components/Timer';
import { PhaseBadge } from '../components/PhaseBadge';
import { EyeToggle } from '../components/EyeToggle';
import { ROLE_META, getTimerSettings } from '@shared/types';

export const LastWord: React.FC = () => {
  const game = useGameStore((s) => s.game);
  const lastWordSeat = useGameStore((s) => s.lastWordSeat);
  const startNight = useGameStore((s) => s.startNight);
  const endGame = useGameStore((s) => s.endGame);
  const sheriffDeathshot = useGameStore((s) => s.sheriffDeathshot);
  const rolesHidden = useGameStore((s) => s.rolesHidden);

  if (!game || lastWordSeat === null) return null;

  const player = game.players.find((p) => p.seat === lastWordSeat);
  if (!player) return null;

  const meta = ROLE_META[player.role];
  const timerSettings = getTimerSettings(game.playerCount);
  const isSheriff = player.role === 'sheriff';
  const deathshotTargets = isSheriff
    ? game.sheriffChecks
        .filter((check) => check.result === 'mafia')
        .map((check) => game.players.find((p) => p.seat === check.seat))
        .filter((p): p is NonNullable<typeof p> => p != null && p.alive && p.seat !== lastWordSeat)
    : [];

  const handleFinish = () => {
    if (game.winner) {
      endGame();
    } else {
      startNight();
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <EyeToggle />
      <PlayerList players={game.players} phase="ДЕНЬ" night={game.dayNumber} />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 24px 120px',
          overflowY: 'auto',
        }}
      >
        <PhaseBadge
          icon="💬"
          label="ПОСЛЕДНЕЕ СЛОВО"
          color={theme.text.muted}
          sub={`День ${game.dayNumber}`}
        />

        <div
          style={{
            textAlign: 'center',
            padding: '28px 40px',
            borderRadius: 18,
            background: theme.bg.card,
            border: `1px solid ${theme.border.default}`,
            marginBottom: 24,
            minWidth: 360,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              background: `linear-gradient(135deg,${player.avatar?.colors[0] || '#64748B'},${player.avatar?.colors[1] || '#1E293B'})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 800,
              color: '#E8E8F0',
              margin: '0 auto 14px',
              border: `3px solid ${meta.color}50`,
              opacity: 0.7,
            }}
          >
            {player.seat}
          </div>

          <div style={{ color: theme.text.primary, fontSize: 22, fontWeight: 700 }}>
            {player.seat}. {(player.nick || player.name).replace('@', '')}
          </div>
          <div style={{ color: theme.text.dim, fontSize: 12, marginTop: 4 }}>
            {player.name}
          </div>

          {!rolesHidden && (
          <div
            style={{
              marginTop: 12,
              padding: '6px 14px',
              borderRadius: 8,
              display: 'inline-block',
              background: `${meta.color}15`,
              border: `1px solid ${meta.color}30`,
            }}
          >
            <span style={{ color: meta.color, fontSize: 13, fontWeight: 700 }}>
              {meta.icon} {meta.nameRu}
            </span>
          </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Timer
              seconds={timerSettings.lastWord}
              label="Последнее слово"
              interactive
              presets={[20, 30, 45]}
            />
          </div>
        </div>

        {isSheriff && deathshotTargets.length > 0 && !rolesHidden && (
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 14,
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.2)',
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            <div style={{ color: '#3B82F6', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
              🔫 Предсмертный выстрел Комиссара
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {deathshotTargets.map((p) => (
                <div
                  key={p.seat}
                  onClick={() => {
                    if (confirm(`Выстрелить в (${ROLE_META[p.role].icon} ${ROLE_META[p.role].nameRu}) ${p.seat}. ${(p.nick || p.name).replace('@', '')}?`)) {
                      sheriffDeathshot(p.seat);
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: 'rgba(59,130,246,0.1)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    color: theme.text.secondary,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  ({ROLE_META[p.role].icon} {ROLE_META[p.role].nameRu}) {p.seat}. {(p.nick || p.name).replace('@', '')}
                </div>
              ))}
            </div>
            <div style={{ color: theme.text.dim, fontSize: 10, marginTop: 8 }}>
              Комиссар может выстрелить в ранее проверенного мафиози
            </div>
          </div>
        )}

        <button
          onClick={handleFinish}
          style={{
            padding: '14px 36px',
            borderRadius: 14,
            border: 'none',
            background: game.winner ? theme.gradient.mafia : theme.gradient.indigo,
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: theme.font,
          }}
        >
          {game.winner
            ? '🏁 Конец игры'
            : '🌙 Перейти к ночи'}
        </button>
      </div>
    </div>
  );
};
