import React, { useState, useCallback, useEffect, useRef } from 'react';
import { theme } from '../theme';
import { useGameStore } from '../store/gameStore';
import { CircleTable } from '../components/CircleTable';
import { ROLE_DISTRIBUTION, ROLE_META } from '@shared/types';
import { sendRoles, removePlayer as removePlayerFromServer } from '../api';
import type { GameRole } from '@shared/types';

const ROLE_DISPLAY: Array<{ key: GameRole; label: string; color: string }> = [
  { key: 'don', label: 'Дон', color: '#EF4444' },
  { key: 'mafia', label: 'Мафия', color: '#EF4444' },
  { key: 'framer', label: 'Подставщик', color: '#F97316' },
  { key: 'enforcer', label: 'Громила', color: '#991B1B' },
  { key: 'sheriff', label: 'Комиссар', color: '#3B82F6' },
  { key: 'doctor', label: 'Доктор', color: '#22C55E' },
  { key: 'hooker', label: 'Любовница', color: '#EC4899' },
  { key: 'maniac', label: 'Маньяк', color: '#F97316' },
  { key: 'bodyguard', label: 'Телохранитель', color: '#D97706' },
  { key: 'seer', label: 'Провидец', color: '#06B6D4' },
  { key: 'werewolf', label: 'Оборотень', color: '#8B5CF6' },
  { key: 'civilian', label: 'Мирные', color: '#64748B' },
];

export const Lobby: React.FC = () => {
  const game = useGameStore((s) => s.game);
  const roleMode = useGameStore((s) => s.roleMode);
  const rolesDealt = useGameStore((s) => s.rolesDealt);
  const setRoleMode = useGameStore((s) => s.setRoleMode);
  const dealRoles = useGameStore((s) => s.dealRoles);
  const redealRoles = useGameStore((s) => s.redealRoles);
  const removePlayer = useGameStore((s) => s.removePlayer);
  const reorderPlayers = useGameStore((s) => s.reorderPlayers);
  const startNight0 = useGameStore((s) => s.startNight0);

  const assignRole = useGameStore((s) => s.assignRole);
  const confirmedSeats = useGameStore((s) => s.confirmedSeats);

  const [numerating, setNumerating] = useState(false);
  const [numOrder, setNumOrder] = useState<number[]>([]);
  const [rolePickerSeat, setRolePickerSeat] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const startNumeration = useCallback(() => {
    setNumerating(true);
    setNumOrder([]);
  }, []);

  const cancelNumeration = useCallback(() => {
    setNumerating(false);
    setNumOrder([]);
  }, []);

  const handleNumerationTap = useCallback((seat: number) => {
    setNumOrder(prev => {
      if (prev.includes(seat)) return prev;
      return [...prev, seat];
    });
  }, []);

  const playerCount = game?.players.length ?? 0;
  const pendingReorder = useRef(false);

  useEffect(() => {
    if (numerating && numOrder.length === playerCount && playerCount > 0 && !pendingReorder.current) {
      pendingReorder.current = true;
      const order = [...numOrder];
      setNumerating(false);
      setNumOrder([]);
      setTimeout(() => {
        reorderPlayers(order);
        pendingReorder.current = false;
      }, 0);
    }
  }, [numOrder, numerating, playerCount, reorderPlayers]);

  if (!game) return null;

  const dist = ROLE_DISTRIBUTION[game.playerCount] || ROLE_DISTRIBUTION[10];

  const baseCircleSize = Math.max(420, game.playerCount * 40);
  const circleSize = Math.min(baseCircleSize, typeof window !== 'undefined' ? window.innerHeight - 280 : 600);
  const circleSeatSize = game.playerCount > 16 ? 40 : game.playerCount > 14 ? 44 : 48;

  const specialPool: GameRole[] = [];
  for (const [role, count] of Object.entries(dist as unknown as Record<string, number>)) {
    if (role !== 'civilian') {
      for (let i = 0; i < count; i++) specialPool.push(role as GameRole);
    }
  }
  const assignedSpecial = game.players.filter(p => p.role !== 'civilian').map(p => p.role);
  const availableRoles: GameRole[] = [...specialPool];
  for (const r of assignedSpecial) {
    const idx = availableRoles.indexOf(r);
    if (idx !== -1) availableRoles.splice(idx, 1);
  }
  const availableCount = new Map<GameRole, number>();
  for (const r of availableRoles) {
    availableCount.set(r, (availableCount.get(r) || 0) + 1);
  }

  const hasManualRoles = game.players.some(p => p.role !== 'civilian');
  const allRolesAssigned = specialPool.length > 0 && availableRoles.length === 0;

  const numAssigned = new Map(numOrder.map((seat, i) => [seat, i + 1]));

  const handleStartGame = async () => {
    if (!game) return;
    setSending(true);
    setSendError(null);

    try {
      const mafiaRoles = ['don', 'mafia', 'framer', 'enforcer'];
      const mafiaSeats = game.players
        .filter(p => mafiaRoles.includes(p.role))
        .map(p => p.seat);

      const playersPayload = game.players.map(p => ({
        seat: p.seat,
        userId: p.userId ? Number(p.userId) : undefined,
        displayName: p.name,
        role: p.role as string,
        team: ROLE_META[p.role].team as string,
        teammates: mafiaRoles.includes(p.role)
          ? mafiaSeats.filter(s => s !== p.seat)
          : undefined,
      }));

      await sendRoles(game.id, playersPayload);
      startNight0();
    } catch (err: any) {
      console.error('Failed to send roles:', err);
      setSendError(err.message || 'Failed to send roles');
    } finally {
      setSending(false);
    }
  };

  const circleMenuItems = [
    {
      icon: '🔄',
      label: 'Сменить роль',
      action: 'changeRole',
      color: theme.accent.purple,
    },
    {
      icon: '❌',
      label: 'Снять роль',
      action: 'unassignRole',
      color: '#F59E0B',
      hideIf: (p: any) => p.role === 'civilian',
    },
    {
      icon: '🪑',
      label: 'Убрать со стола',
      action: 'remove',
      color: '#EF4444',
    },
    {
      icon: '🚫',
      label: 'Убрать и забанить',
      action: 'removeAndBan',
      color: '#991B1B',
    },
  ];

  return (
    <div style={{ padding: '16px 20px 120px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{
            color: theme.text.primary, fontSize: 20, fontWeight: 700,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60vw',
          }}>
            Лобби — {game.name}
          </div>
          <div style={{ color: theme.text.dim, fontSize: 12 }}>
            {game.playerCount} игроков
          </div>
        </div>
        <div />
      </div>

      {numerating && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ color: '#F59E0B', fontSize: 13, fontWeight: 700 }}>
              Нумерация: нажимайте на игроков по порядку
            </div>
            <div style={{ color: theme.text.dim, fontSize: 11 }}>
              {numOrder.length} / {game.players.length}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setNumOrder(prev => prev.slice(0, -1))}
              disabled={numOrder.length === 0}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid rgba(245,158,11,0.3)',
                background: numOrder.length > 0 ? 'rgba(245,158,11,0.1)' : 'transparent',
                color: numOrder.length > 0 ? '#F59E0B' : theme.text.dark,
                fontSize: 11,
                fontWeight: 600,
                cursor: numOrder.length > 0 ? 'pointer' : 'not-allowed',
                fontFamily: theme.font,
              }}
            >
              Назад
            </button>
          <button
            onClick={cancelNumeration}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: `1px solid ${theme.border.medium}`,
              background: 'transparent',
              color: theme.text.muted,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: theme.font,
            }}
          >
            Отмена
          </button>
          </div>
        </div>
      )}

      {!numerating && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 10,
            background: theme.bg.card,
            border: `1px solid ${theme.border.subtle}`,
          }}
        >
          {ROLE_DISPLAY.filter((r) => (dist as unknown as Record<string, number>)[r.key] > 0).map((r) => (
            <span
              key={r.key}
              style={{
                padding: '3px 8px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 600,
                color: r.color,
                background: `${r.color}15`,
                border: `1px solid ${r.color}25`,
              }}
            >
              {r.label} ×
              {(dist as unknown as Record<string, number>)[r.key]}
            </span>
          ))}
        </div>
      )}

      <div
        style={{
          padding: 8,
          borderRadius: 18,
          marginBottom: 14,
          background: theme.bg.card,
          border: `1px solid ${numerating ? 'rgba(245,158,11,0.3)' : theme.border.subtle}`,
          display: 'flex',
          justifyContent: 'center',
          overflow: 'auto',
        }}
      >
        {numerating ? (
          <NumerationCircle
            players={game.players}
            numOrder={numOrder}
            numAssigned={numAssigned}
            onTap={handleNumerationTap}
            size={circleSize}
            seatSize={circleSeatSize}
          />
        ) : (
          <CircleTable
            players={game.players.map((p) => ({ ...p, alive: true }))}
            confirmedSeats={confirmedSeats}
            size={circleSize}
            seatSize={circleSeatSize}
            menuItems={circleMenuItems}
            onAction={(action, p) => {
              if (action === 'remove') {
                const player = game.players.find(pp => pp.seat === p.seat);
                if (player?.userId) {
                  removePlayerFromServer(game.id, Number(player.userId), false).catch(err => console.error('Remove failed:', err));
                }
                removePlayer(p.seat);
              } else if (action === 'removeAndBan') {
                const player = game.players.find(pp => pp.seat === p.seat);
                if (player?.userId) {
                  removePlayerFromServer(game.id, Number(player.userId), true).catch(err => console.error('Ban failed:', err));
                }
                removePlayer(p.seat);
              } else if (action === 'changeRole') {
                setRolePickerSeat(p.seat);
              } else if (action === 'unassignRole') {
                assignRole(p.seat, 'civilian' as GameRole);
              }
            }}
          />
        )}
      </div>

      {sendError && (
        <div
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#EF4444',
            fontSize: 12,
            marginBottom: 10,
            textAlign: 'center',
          }}
        >
          {sendError}
        </div>
      )}

      {numerating ? null : (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {!rolesDealt && !hasManualRoles && (
            <button
              onClick={startNumeration}
              style={{
                padding: '14px 24px',
                borderRadius: 14,
                border: '1px solid rgba(245,158,11,0.3)',
                background: 'rgba(245,158,11,0.1)',
                color: '#F59E0B',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: theme.font,
              }}
            >
              #  Нумерация
            </button>
          )}

          {!allRolesAssigned && (
            <button
              onClick={dealRoles}
              style={{
                padding: '14px 40px',
                borderRadius: 14,
                border: 'none',
                background: theme.gradient.mafia,
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 6px 24px rgba(239,68,68,0.3)',
                fontFamily: theme.font,
              }}
            >
              🃏 Раздать роли
            </button>
          )}

          {(rolesDealt || hasManualRoles) && (
            <button
              onClick={redealRoles}
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                border: `1px solid ${theme.border.medium}`,
                background: 'transparent',
                color: theme.text.muted,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: theme.font,
              }}
            >
              🔄 Сбросить роли
            </button>
          )}

          {allRolesAssigned && (
            <button
              onClick={handleStartGame}
              disabled={sending}
              style={{
                padding: '14px 36px',
                borderRadius: 14,
                border: 'none',
                background: sending ? '#555' : theme.gradient.indigo,
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: sending ? 'not-allowed' : 'pointer',
                fontFamily: theme.font,
                boxShadow: '0 6px 24px rgba(99,102,241,0.3)',
                opacity: sending ? 0.7 : 1,
              }}
            >
              {sending ? '⏳ Отправка...' : '🚀 Начать игру'}
            </button>
          )}
        </div>
      )}

      {rolePickerSeat !== null && (() => {
        const player = game.players.find(p => p.seat === rolePickerSeat);
        if (!player) return null;

        const pickerAvailable = new Map(availableCount);
        if (player.role !== 'civilian') {
          pickerAvailable.set(player.role, (pickerAvailable.get(player.role) || 0) + 1);
        }

        return (
          <div
            onClick={() => setRolePickerSeat(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: theme.bg.elevated,
                border: `1px solid ${theme.border.strong}`,
                borderRadius: 16,
                padding: 20,
                width: 300,
                maxWidth: '90vw',
                maxHeight: '70vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
            >
              <div style={{ color: theme.text.primary, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                ({ROLE_META[player.role].icon} {ROLE_META[player.role].nameRu}) {player.seat}. {(player.nick || player.name).replace('@', '')}
              </div>
              <div style={{ color: theme.text.dim, fontSize: 11, marginBottom: 14 }}>
                {player.role !== 'civilian' ? `Текущая: ${ROLE_META[player.role].nameRu}` : 'Роль не назначена'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ROLE_DISPLAY.filter(r => r.key !== 'civilian' && (pickerAvailable.get(r.key) || 0) > 0).map(r => {
                  const count = pickerAvailable.get(r.key) || 0;
                  const isCurrent = player.role === r.key;
                  return (
                    <div
                      key={r.key}
                      onClick={() => {
                        assignRole(rolePickerSeat, r.key);
                        setRolePickerSeat(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        background: isCurrent ? `${r.color}15` : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isCurrent ? `${r.color}40` : theme.border.subtle}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14 }}>{ROLE_META[r.key].icon}</span>
                        <span style={{ color: r.color, fontSize: 13, fontWeight: 600 }}>{r.label}</span>
                      </div>
                      <span style={{ color: theme.text.dim, fontSize: 11 }}>
                        {isCurrent ? '✓' : `×${count}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setRolePickerSeat(null)}
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: '8px',
                  borderRadius: 8,
                  border: `1px solid ${theme.border.medium}`,
                  background: 'transparent',
                  color: theme.text.muted,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: theme.font,
                }}
              >
                Закрыть
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

const NumerationCircle: React.FC<{
  players: Array<{ seat: number; name: string; nick: string; avatar?: { colors: [string, string] } }>;
  numOrder: number[];
  numAssigned: Map<number, number>;
  onTap: (seat: number) => void;
  size?: number;
  seatSize?: number;
}> = ({ players, numOrder, numAssigned, onTap, size = 420, seatSize = 48 }) => {
  const labelFontSize = players.length > 16 ? 7 : 8;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - seatSize / 2 - 14;

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <div
        style={{
          position: 'absolute',
          top: size * 0.18,
          left: size * 0.18,
          width: size * 0.64,
          height: size * 0.64,
          borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(245,158,11,0.03),rgba(255,255,255,0.01))',
          border: `1px solid rgba(245,158,11,0.15)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: '#F59E0B', fontSize: 14, fontWeight: 700 }}>
          {numOrder.length}/{players.length}
        </div>
      </div>

      {players.map((p, i) => {
        const angle = (i / players.length) * 2 * Math.PI - Math.PI / 2;
        const x = cx + r * Math.cos(angle) - seatSize / 2;
        const y = cy + r * Math.sin(angle) - seatSize / 2;
        const assigned = numAssigned.get(p.seat);
        const isAssigned = assigned !== undefined;
        const avatarColors = p.avatar?.colors || ['#64748B', '#1E293B'];

        return (
          <div
            key={p.seat}
            onClick={() => !isAssigned && onTap(p.seat)}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: seatSize + 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              cursor: isAssigned ? 'default' : 'pointer',
            }}
          >
            <div style={{ position: 'relative' }}>
              {isAssigned && (
                <div
                  style={{
                    position: 'absolute',
                    top: -10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#000',
                    background: '#F59E0B',
                    borderRadius: 6,
                    padding: '1px 7px',
                    zIndex: 2,
                  }}
                >
                  {assigned}
                </div>
              )}

              <div
                style={{
                  width: seatSize - 6,
                  height: seatSize - 6,
                  borderRadius: '50%',
                  background: isAssigned
                    ? 'rgba(245,158,11,0.2)'
                    : `linear-gradient(135deg,${avatarColors[0]},${avatarColors[1]})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: isAssigned
                    ? '3px solid #F59E0B'
                    : `2px solid ${avatarColors[0]}60`,
                  boxShadow: isAssigned ? '0 0 12px rgba(245,158,11,0.3)' : 'none',
                  opacity: isAssigned ? 0.7 : 1,
                  transition: 'all 0.15s',
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: isAssigned ? '#F59E0B' : '#E8E8F0',
                  }}
                >
                  {isAssigned ? assigned : p.seat}
                </span>
              </div>
            </div>

            <div
              style={{
                color: isAssigned ? '#F59E0B' : '#9090A0',
                fontSize: labelFontSize,
                fontWeight: 600,
                textAlign: 'center',
                maxWidth: seatSize + 20,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
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
