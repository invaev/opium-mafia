import React from 'react';
import { theme } from '../theme';
import { useGameStore } from '../store/gameStore';
import { PlayerList } from '../components/PlayerList';
import { EyeToggle } from '../components/EyeToggle';
import { ROLE_META } from '@shared/types';

export const Night0: React.FC = () => {
  const game = useGameStore((s) => s.game);
  const rolesHidden = useGameStore((s) => s.rolesHidden);
  const startDayAnnounce = useGameStore((s) => s.startDayAnnounce);

  if (!game) return null;

  const mafiaMembers = game.players.filter((p) => p.team === 'mafia');

  const handleNext = () => {
    startDayAnnounce();
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <EyeToggle />
      <PlayerList
        players={game.players.map((p) => ({ ...p, alive: true }))}
        phase="НОЧЬ"
        night={0}
      />
      <div
        style={{
          flex: 1,
          padding: '24px 24px 120px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflowY: 'auto',
        }}
      >
        <div style={{ color: '#A78BFA', fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
          🌙 НОЧЬ 0
        </div>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🤝</div>
        <div style={{ color: theme.text.primary, fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
          Ночь знакомства
        </div>
        <div
          style={{
            color: theme.text.dim,
            fontSize: 14,
            textAlign: 'center',
            maxWidth: 420,
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          «Город засыпает. Мафия просыпается и знакомится.»
          <br />
          Мафиози открывают глаза, видят друг друга.
          <br />
          Убийств нет. Первая ночь — ознакомительная.
        </div>

        {!rolesHidden && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              padding: '16px 20px',
              borderRadius: 14,
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.15)',
              marginBottom: 24,
            }}
          >
            {mafiaMembers.map((p) => {
              const meta = ROLE_META[p.role];
              const avatarColors = p.avatar?.colors || ['#EF4444', '#DC2626'];
              return (
                <div key={p.seat} style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      background: `linear-gradient(135deg,${avatarColors[0]},${avatarColors[1]})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      border: '2px solid #EF444450',
                    }}
                  >
                    {p.avatar?.emoji || meta.icon}
                  </div>
                  <div
                    style={{
                      color: '#EF4444',
                      fontSize: 9,
                      fontWeight: 700,
                      marginTop: 4,
                    }}
                  >
                    ({meta.icon} {meta.nameRu}) {p.seat}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={handleNext}
          style={{
            padding: '12px 32px',
            borderRadius: 12,
            border: 'none',
            background: theme.gradient.orange,
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: theme.font,
          }}
        >
          ☀️ «Город просыпается» → День 1
        </button>
      </div>
    </div>
  );
};
