import React, { useState, useCallback, useEffect } from 'react';
import type { Player, Team } from '@shared/types';
import { ROLE_META } from '@shared/types';
import { theme } from '../theme';

const teamColors: Record<Team, string> = theme.team;

export interface MenuItem {
  icon: string;
  label: string;
  action: string;
  color?: string;
  hideIf?: (p: Player) => boolean;
}

interface CircleTableProps {
  players: Player[];
  onAction?: (action: string, player: Player) => void;
  selected?: number;
  showRole?: boolean;
  hideRoles?: boolean;
  confirmedSeats?: Set<number>;
  size?: number;
  seatSize?: number;
  menuItems?: MenuItem[];
  disabledSeats?: number[];
  highlightSeats?: number[];
  highlightColor?: string;
  voteCounts?: Record<number, number>;
  votedSeats?: Set<number>;
  selectedColor?: string;
  onSeatClick?: (player: Player) => void;
}

export const CircleTable: React.FC<CircleTableProps> = ({
  players,
  onAction,
  selected,
  showRole = false,
  hideRoles = false,
  confirmedSeats,
  size = 340,
  seatSize = 52,
  menuItems,
  disabledSeats = [],
  highlightSeats = [],
  highlightColor = '#A78BFA',
  voteCounts,
  votedSeats,
  selectedColor = '#A78BFA',
  onSeatClick,
}) => {
  const [menuSeat, setMenuSeat] = useState<number | null>(null);

  const slotHeight = seatSize + 28;
  const minRadius = (players.length * slotHeight) / (2 * Math.PI);
  const minSize = 2 * (minRadius + seatSize / 2 + 14);
  const effectiveSize = Math.max(size, minSize);

  const cx = effectiveSize / 2;
  const cy = effectiveSize / 2;
  const r = effectiveSize / 2 - seatSize / 2 - 14;

  const handleBackgroundClick = useCallback(() => {
    setMenuSeat(null);
  }, []);

  useEffect(() => {
    if (menuSeat === null) return;
    const handler = () => setMenuSeat(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [menuSeat]);

  return (
    <div
      style={{
        position: 'relative',
        width: effectiveSize,
        height: effectiveSize,
        margin: '0 auto',
      }}
      onClick={handleBackgroundClick}
    >
      <div
        style={{
          position: 'absolute',
          top: effectiveSize * 0.18,
          left: effectiveSize * 0.18,
          width: effectiveSize * 0.64,
          height: effectiveSize * 0.64,
          borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(255,255,255,0.03),rgba(255,255,255,0.01))',
          border: `1px solid ${theme.border.subtle}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: '#2A2A35', fontSize: 28 }}>{'\u{1F0CF}'}</div>
      </div>

      {players.map((p, i) => {
        const angle = (i / players.length) * 2 * Math.PI - Math.PI / 2;
        const x = cx + r * Math.cos(angle) - seatSize / 2;
        const y = cy + r * Math.sin(angle) - seatSize / 2;
        const isOpen = menuSeat === p.seat;
        const isOnLeft = x < cx;
        const isDisabled = disabledSeats.includes(p.seat);
        const isHighlighted = highlightSeats.includes(p.seat);
        const isSelected = selected === p.seat;
        const hasRole = (confirmedSeats ? confirmedSeats.has(p.seat) : showRole) && !hideRoles;
        const neutralColor = '#22C55E';
        const teamColor = hideRoles ? neutralColor : (teamColors[p.team] || '#64748B');
        const avatarColors = p.avatar?.colors || ['#64748B', '#1E293B'];

        let border = `2px solid ${p.alive ? (hasRole ? teamColor : avatarColors[0] + '60') : '#333'}`;
        let boxShadow = 'none';
        if (isOpen) {
          border = '3px solid #F59E0B';
          boxShadow = theme.shadow.glow('#F59E0B');
        } else if (isSelected) {
          border = `3px solid ${selectedColor}`;
          boxShadow = theme.shadow.glowSm(selectedColor);
        } else if (isHighlighted) {
          border = `3px solid ${highlightColor}`;
          boxShadow = theme.shadow.glowSm(highlightColor);
        }

        const bg = hasRole
          ? `linear-gradient(135deg,${teamColor}60,${teamColor}30)`
          : `linear-gradient(135deg,${avatarColors[0]},${avatarColors[1]})`;

        return (
          <div
            key={p.seat}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: seatSize + 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              cursor: p.alive && !isDisabled ? 'pointer' : 'default',
              zIndex: isOpen ? 20 : 1,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (p.alive && !isDisabled) {
                if (onSeatClick) {
                  onSeatClick(p);
                } else {
                  setMenuSeat(isOpen ? null : p.seat);
                }
              }
            }}
          >
            <div style={{ position: 'relative' }}>
              {hasRole && (
                <div
                  style={{
                    position: 'absolute',
                    top: -14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: players.length > 16 ? 7 : 8,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    color: teamColor,
                    background: theme.bg.primary,
                    borderRadius: 4,
                    padding: '1px 5px',
                    border: `1px solid ${teamColor}30`,
                    zIndex: 10,
                  }}
                >
                  {ROLE_META[p.role].nameRu}
                </div>
              )}

              <div
                style={{
                  width: seatSize - 6,
                  height: seatSize - 6,
                  borderRadius: '50%',
                  background: bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: p.alive ? (isDisabled ? 0.4 : 1) : 0.3,
                  border,
                  boxShadow,
                  transition: 'all 0.15s',
                }}
              >
                <span
                  style={{
                    fontSize: seatSize > 48 ? 18 : 15,
                    fontWeight: 800,
                    color: p.alive ? '#E8E8F0' : '#4A4A5A',
                  }}
                >
                  {p.seat}
                </span>
              </div>

              {!p.alive && (
                <div
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    fontSize: 11,
                    background: theme.bg.primary,
                    borderRadius: 6,
                    padding: '0 2px',
                  }}
                >
                  {'\u2620\uFE0F'}
                </div>
              )}

              {p.fouls > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    left: -2,
                    background: p.fouls >= 3 ? '#EF4444' : '#F59E0B',
                    color: '#fff',
                    fontSize: 7,
                    fontWeight: 800,
                    width: 13,
                    height: 13,
                    borderRadius: 7,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1.5px solid ${theme.bg.primary}`,
                  }}
                >
                  {p.fouls}
                </div>
              )}

              {voteCounts && voteCounts[p.seat] > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -8,
                    background: '#EF4444',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `2px solid ${theme.bg.primary}`,
                    padding: '0 3px',
                  }}
                >
                  {voteCounts[p.seat]}
                </div>
              )}

              {votedSeats && votedSeats.has(p.seat) && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -4,
                    background: '#22C55E',
                    color: '#fff',
                    fontSize: 8,
                    fontWeight: 800,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1.5px solid ${theme.bg.primary}`,
                  }}
                >
                  {'\u2713'}
                </div>
              )}

              {isOpen && menuItems && (
                <div
                  style={{
                    position: 'absolute',
                    top: -4,
                    [isOnLeft ? 'left' : 'right']: seatSize + 2,
                    background: theme.bg.elevated,
                    border: `1px solid ${theme.border.strong}`,
                    borderRadius: 12,
                    padding: 6,
                    minWidth: 140,
                    boxShadow: theme.shadow.popup,
                    zIndex: 30,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      padding: '4px 10px 6px',
                      marginBottom: 2,
                      borderBottom: `1px solid ${theme.border.subtle}`,
                    }}
                  >
                    <div style={{ color: theme.text.primary, fontSize: 11, fontWeight: 700 }}>
                      {hasRole && !hideRoles ? `(${ROLE_META[p.role].icon} ${ROLE_META[p.role].nameRu}) ` : ''}{p.seat}. {(p.nick || p.name).replace('@', '')}
                    </div>
                    <div style={{ color: theme.text.dim, fontSize: 9 }}>
                      {p.nick || p.name}
                      {hasRole && !hideRoles ? ` · ${ROLE_META[p.role].nameRu}` : ''}
                    </div>
                  </div>

                  {menuItems
                    .filter((m) => !m.hideIf || !m.hideIf(p))
                    .map((m, mi) => (
                      <div
                        key={mi}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAction?.(m.action, p);
                          setMenuSeat(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: 8,
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background =
                            theme.bg.cardHover;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                        }}
                      >
                        <span style={{ fontSize: 14 }}>{m.icon}</span>
                        <span
                          style={{
                            color: m.color || theme.text.secondary,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {m.label}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div
              style={{
                color: p.alive ? '#9090A0' : '#4A4A5A',
                fontSize: players.length > 16 ? 7 : 8,
                fontWeight: 600,
                textAlign: 'center',
                maxWidth: seatSize + 20,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                background: theme.bg.primary,
                borderRadius: 3,
                padding: '0 3px',
                position: 'relative',
                zIndex: 5,
              }}
            >
              {(p.nick || p.name).replace('@', '')}
            </div>
          </div>
        );
      })}
    </div>
  );
};
