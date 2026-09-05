import React from 'react';
import { theme } from '../theme';
import { useGameStore } from '../store/gameStore';
import { PlayerList } from '../components/PlayerList';
import { CircleTable } from '../components/CircleTable';
import { Timer } from '../components/Timer';
import { PhaseBadge } from '../components/PhaseBadge';
import { EyeToggle } from '../components/EyeToggle';
import { getTimerSettings } from '@shared/types';

export const DayOpium: React.FC = () => {
  const game = useGameStore((s) => s.game);
  const addFoul = useGameStore((s) => s.addFoul);
  const redCard = useGameStore((s) => s.redCard);
  const techKill = useGameStore((s) => s.techKill);
  const startVoting = useGameStore((s) => s.startVoting);
  const startNight = useGameStore((s) => s.startNight);
  const rolesHidden = useGameStore((s) => s.rolesHidden);

  if (!game) return null;

  const alive = game.players.filter((p) => p.alive);
  const timerSettings = getTimerSettings(game.playerCount);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <EyeToggle />
      <PlayerList players={game.players} phase="ДЕНЬ" night={game.dayNumber} />
      <div style={{ flex: 1, padding: '20px 24px 120px', overflowY: 'auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <PhaseBadge
            icon="🔥"
            label="OPIUM MAFIA"
            color="#EF4444"
            sub={`День ${game.dayNumber} · Свободная дискуссия`}
          />
          <Timer seconds={timerSettings.opium} label="Opium" interactive presets={[120, 60, 30]} />
        </div>

        <div
          style={{
            padding: 8,
            borderRadius: 16,
            marginBottom: 14,
            background: theme.bg.card,
            border: `1px solid ${theme.border.subtle}`,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <CircleTable
            players={alive}
            showRole={true}
            hideRoles={rolesHidden}
            size={400}
            seatSize={46}
            menuItems={[
              {
                icon: '⚠️',
                label: 'Фол',
                action: 'foul',
                color: '#F59E0B',
              },
              {
                icon: '🔴',
                label: 'Красная карточка',
                action: 'redCard',
                color: '#EF4444',
              },
              {
                icon: '☠️',
                label: 'Удалить (3 фола)',
                action: 'techKill',
                color: '#EF4444',
                hideIf: (p) => p.fouls < 2,
              },
            ]}
            onAction={(action, p) => {
              switch (action) {
                case 'foul':
                  addFoul(p.seat);
                  break;
                case 'redCard':
                  redCard(p.seat);
                  break;
                case 'techKill':
                  techKill(p.seat);
                  break;
              }
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
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
          <button
            onClick={startNight}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: '1px solid rgba(99,102,241,0.2)',
              background: 'rgba(99,102,241,0.06)',
              color: theme.accent.purple,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: theme.font,
            }}
          >
            Пропустить → Ночь
          </button>
        </div>
      </div>
    </div>
  );
};
