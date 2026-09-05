import React, { useState } from 'react';
import type { Player } from '@shared/types';
import { ROLE_META } from '@shared/types';
import { theme } from '../theme';
import { useGameStore } from '../store/gameStore';
import { GameLog } from './GameLog';

interface PlayerListProps {
  players: Player[];
  phase: string;
  night?: number;
}

export const PlayerList: React.FC<PlayerListProps> = ({ players, phase, night }) => {
  const alive = players.filter((p) => p.alive);
  const peacefulAlive = alive.filter((p) => p.team === 'peaceful').length;
  const mafiaAlive = alive.filter((p) => p.team === 'mafia').length;

  const game = useGameStore((s) => s.game);
  const nightResults = useGameStore((s) => s.nightResults);
  const rolesHidden = useGameStore((s) => s.rolesHidden);
  const addFoul = useGameStore((s) => s.addFoul);
  const redCard = useGameStore((s) => s.redCard);
  const techKill = useGameStore((s) => s.techKill);

  const [menuSeat, setMenuSeat] = useState<number | null>(null);

  return (
    <div
      style={{
        width: 230,
        minWidth: 230,
        padding: '12px 10px',
        borderRight: `1px solid ${theme.border.default}`,
        overflowY: 'auto',
        overflowX: 'hidden',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {game && (
        <div
          style={{
            padding: '6px 8px',
            borderRadius: 8,
            marginBottom: 8,
            background: phase === 'НОЧЬ' ? 'rgba(99,102,241,0.08)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${phase === 'НОЧЬ' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)'}`,
            textAlign: 'center',
          }}
        >
          <div style={{ color: phase === 'НОЧЬ' ? '#A78BFA' : '#F59E0B', fontSize: 12, fontWeight: 800 }}>
            {phase === 'НОЧЬ' ? '🌙' : '☀️'} {phase} {night !== undefined ? night : game.dayNumber}
          </div>
          <div style={{ color: theme.text.dim, fontSize: 9, marginTop: 2 }}>
            {game.name}
          </div>
        </div>
      )}
      {!game && (
        <div style={{ color: theme.text.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
          СТОЛ · {phase}{night !== undefined ? ` ${night}` : ''}
        </div>
      )}

      {players.map((p) => {
        const meta = ROLE_META[p.role];
        const neutralColor = '#22C55E';
        const teamColor = rolesHidden ? neutralColor : (theme.team[p.team] || '#64748B');
        const avatarColors = p.avatar?.colors || ['#64748B', '#1E293B'];
        const isMenuOpen = menuSeat === p.seat;

        return (
          <div key={p.seat} style={{ position: 'relative' }}>
            <div
              onClick={() => {
                if (p.alive) setMenuSeat(isMenuOpen ? null : p.seat);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 8,
                marginBottom: 2,
                opacity: p.alive ? 1 : 0.3,
                cursor: p.alive ? 'pointer' : 'default',
                background: isMenuOpen ? 'rgba(255,255,255,0.06)' : 'transparent',
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  background: `linear-gradient(135deg,${avatarColors[0]},${avatarColors[1]})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  border: `1.5px solid ${teamColor}40`,
                  flexShrink: 0,
                }}
              >
                {p.avatar?.emoji || '\u{1F3E0}'}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: theme.text.secondary,
                    fontSize: 11,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {!rolesHidden && `(${meta.icon} ${meta.nameRu}) `}{p.seat}. {(p.nick || p.name).replace('@', '')}
                </div>
                <div style={{ color: teamColor, fontSize: 9, fontWeight: 600 }}>
                  {rolesHidden ? 'Игрок' : `${meta.icon} ${meta.nameRu}`}
                  {!rolesHidden && p.role === 'enforcer' && game?.enforcerUsed && (
                    <span style={{ color: theme.text.dim, fontSize: 8, marginLeft: 3 }}>
                      (использован)
                    </span>
                  )}
                  {!rolesHidden && p.role === 'sheriff' && game && game.sheriffChecks.length > 0 && (
                    <span style={{ color: theme.text.dim, fontSize: 8, marginLeft: 3 }}>
                      (проверок: {game.sheriffChecks.length})
                    </span>
                  )}
                  {!rolesHidden && game && game.framerTarget === p.seat && game.framerExpiry !== undefined && game.framerExpiry > game.dayNumber && (
                    <div style={{ color: '#F97316', fontSize: 8, fontWeight: 700 }}>
                      🎭 подставлен (до дня {game.framerExpiry - 1})
                    </div>
                  )}
                </div>
              </div>

              {p.fouls > 0 && (
                <div style={{ display: 'flex', gap: 2 }}>
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
              )}

              {!p.alive && <span style={{ fontSize: 10 }}>{'\u2620\uFE0F'}</span>}
            </div>

            {isMenuOpen && p.alive && (() => {
              const playerIndex = players.indexOf(p);
              const isNearBottom = playerIndex >= players.length - 3;
              return (
              <div
                style={{
                  position: 'absolute',
                  left: 8,
                  right: 8,
                  ...(isNearBottom ? { bottom: '100%' } : { top: '100%' }),
                  zIndex: 50,
                  padding: '6px',
                  borderRadius: 10,
                  background: theme.bg.elevated,
                  border: `1px solid ${theme.border.strong}`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  display: 'flex',
                  gap: 4,
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addFoul(p.seat);
                    setMenuSeat(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    borderRadius: 6,
                    border: '1px solid rgba(245,158,11,0.3)',
                    background: 'rgba(245,158,11,0.08)',
                    color: '#F59E0B',
                    fontSize: 9,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: theme.font,
                  }}
                >
                  {'\u26A0\uFE0F'} Фол
                </button>
                {p.fouls >= 2 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Удалить (${meta.icon} ${meta.nameRu}) ${p.seat}. ${(p.nick || p.name).replace('@', '')} (3 фола)?`)) {
                        techKill(p.seat);
                      }
                      setMenuSeat(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 4px',
                      borderRadius: 6,
                      border: '1px solid rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.08)',
                      color: '#EF4444',
                      fontSize: 9,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: theme.font,
                    }}
                  >
                    {'\u2620\uFE0F'} 3 фола
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Удалить (${meta.icon} ${meta.nameRu}) ${p.seat}. ${(p.nick || p.name).replace('@', '')} со стола?`)) {
                      redCard(p.seat);
                    }
                    setMenuSeat(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    borderRadius: 6,
                    border: '1px solid rgba(239,68,68,0.5)',
                    background: 'rgba(239,68,68,0.15)',
                    color: '#EF4444',
                    fontSize: 9,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: theme.font,
                  }}
                >
                  {'\u{1F534}'} Убрать
                </button>
              </div>
              );
            })()}
          </div>
        );
      })}

      {menuSeat !== null && (
        <div
          onClick={() => setMenuSeat(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 49,
          }}
        />
      )}

      <div
        style={{
          marginTop: 8,
          padding: 8,
          borderRadius: 8,
          background: theme.bg.card,
          border: `1px solid ${theme.border.subtle}`,
        }}
      >
        {!rolesHidden && (
          <>
            <div style={{ color: theme.team.peaceful, fontSize: 10 }}>
              Мирных: {peacefulAlive}
            </div>
            <div style={{ color: theme.team.mafia, fontSize: 10 }}>
              Мафия: {mafiaAlive}
            </div>
          </>
        )}
        <div style={{ color: theme.text.dim, fontSize: 10 }}>
          Живых: {alive.length}
        </div>
      </div>

      {game && <GameLog game={game} nightResults={nightResults} />}
    </div>
  );
};
