import React, { useState, useMemo } from 'react';
import { ROLE_META } from '@shared/types';
import { theme } from '../theme';
import { useGameStore } from '../store/gameStore';
import { PlayerList } from '../components/PlayerList';
import { CircleTable } from '../components/CircleTable';
import { PhaseBadge } from '../components/PhaseBadge';
import { Timer } from '../components/Timer';
import { EyeToggle } from '../components/EyeToggle';

export const Voting: React.FC = () => {
  const game = useGameStore((s) => s.game);
  const votes = useGameStore((s) => s.votes);
  const isRevote = useGameStore((s) => s.isRevote);
  const revoteCandidates = useGameStore((s) => s.revoteCandidates);
  const eliminatedThisVote = useGameStore((s) => s.eliminatedThisVote);
  const recordVote = useGameStore((s) => s.recordVote);
  const clearVote = useGameStore((s) => s.clearVote);
  const resolveVoting = useGameStore((s) => s.resolveVoting);
  const confirmElimination = useGameStore((s) => s.confirmElimination);
  const startRevote = useGameStore((s) => s.startRevote);
  const startNight = useGameStore((s) => s.startNight);
  const endGame = useGameStore((s) => s.endGame);
  const rolesHidden = useGameStore((s) => s.rolesHidden);

  const [activeVoter, setActiveVoter] = useState<number | null>(null);
  const [votingStarted, setVotingStarted] = useState(false);
  const [result, setResult] = useState<'eliminated' | 'tie' | 'doubleTie' | null>(null);
  const [timerKey, setTimerKey] = useState(0);

  if (!game) return null;

  const alive = game.players.filter((p) => p.alive);
  const aliveSeats = alive.map((p) => p.seat).sort((a, b) => a - b);

  const voters = isRevote
    ? aliveSeats.filter((s) => !revoteCandidates.includes(s))
    : aliveSeats;

  const voteCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const p of alive) counts[p.seat] = 0;
    for (const target of Object.values(votes)) {
      if (target !== undefined && counts[target] !== undefined) {
        counts[target]++;
      }
    }
    return counts;
  }, [votes, alive]);

  const votedSeats = useMemo(() => new Set(Object.keys(votes).map(Number)), [votes]);

  const totalVoted = votedSeats.size;
  const totalVoters = voters.length;

  const getNextVoter = (currentSeat: number): number | null => {
    const currentIdx = voters.indexOf(currentSeat);
    for (let i = 1; i < voters.length; i++) {
      const candidate = voters[(currentIdx + i) % voters.length];
      if (!votes[candidate] && candidate !== currentSeat) {
        return candidate;
      }
    }
    return null;
  };

  const handleResolve = () => {
    const r = resolveVoting();
    setResult(r);
    setActiveVoter(null);
    setVotingStarted(false);
  };

  const handleSeatClick = (seat: number) => {
    if (result) return;

    if (!votingStarted) {
      if (voters.includes(seat) && !votedSeats.has(seat)) {
        setActiveVoter(seat);
        setVotingStarted(true);
        setTimerKey((k) => k + 1);
      }
      return;
    }

    if (activeVoter === null) return;

    if (activeVoter === seat) {
      return;
    }

    if (isRevote && !revoteCandidates.includes(seat)) {
      return;
    }

    recordVote(activeVoter, seat);

    const nextVoter = getNextVoter(activeVoter);
    setActiveVoter(nextVoter);
    if (nextVoter) {
      setTimerKey((k) => k + 1);
    }
  };

  const disabledSeats = useMemo(() => {
    const disabled: number[] = [];
    if (isRevote) {
      disabled.push(...revoteCandidates);
    }
    return disabled;
  }, [isRevote, revoteCandidates]);

  const highlightSeats = isRevote ? revoteCandidates : [];

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <EyeToggle />
      <PlayerList
        players={game.players}
        phase="ДЕНЬ"
        night={game.dayNumber}
      />

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
            icon="🗳️"
            label={isRevote ? 'ПЕРЕГОЛОСОВАНИЕ' : 'ГОЛОСОВАНИЕ'}
            color={theme.accent.red}
            sub={`День ${game.dayNumber} · Проголосовало: ${totalVoted}/${totalVoters}`}
          />
          {activeVoter !== null && (
            <Timer
              key={timerKey}
              seconds={30}
              label={`Игрок ${activeVoter}`}
              interactive
              autoStart
              presets={[30, 15, 10]}
            />
          )}
        </div>

        {!result && (
          <div
            style={{
              textAlign: 'center',
              marginBottom: 12,
              color: activeVoter !== null ? '#F59E0B' : theme.text.dim,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {!votingStarted
              ? 'Нажмите на игрока, с которого начинается голосование'
              : activeVoter !== null
                ? isRevote
                  ? `Игрок ${activeVoter} голосует — выберите кандидата`
                  : `Игрок ${activeVoter} голосует — нажмите на цель`
                : 'Все проголосовали'}
          </div>
        )}

        {isRevote && !result && (
          <div
            style={{
              textAlign: 'center',
              marginBottom: 8,
              color: theme.accent.orange,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {`Кандидаты: ${revoteCandidates.join(', ')}`}
          </div>
        )}

        {!result && (
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
              seatSize={48}
              selected={activeVoter ?? undefined}
              selectedColor="#F59E0B"
              voteCounts={voteCounts}
              votedSeats={votedSeats}
              highlightSeats={highlightSeats}
              highlightColor="#EF4444"
              onSeatClick={(p) => handleSeatClick(p.seat)}
            />
          </div>
        )}

        {totalVoted > 0 && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: theme.bg.card,
              border: `1px solid ${theme.border.subtle}`,
              marginBottom: 14,
              maxHeight: 120,
              overflowY: 'auto',
            }}
          >
            <div style={{ color: theme.text.dim, fontSize: 9, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
              ГОЛОСА
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {Object.entries(votes).map(([voterStr, candidate]) => {
                const voter = Number(voterStr);
                return (
                  <span
                    key={voter}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.15)',
                      color: theme.text.secondary,
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    {voter} → {candidate}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {result && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            {result === 'eliminated' && (() => {
              const ep = game.players.find((p) => p.seat === eliminatedThisVote);
              return (
                <div>
                  <div style={{ color: '#EF4444', fontSize: 18, fontWeight: 800 }}>
                    ☠️ Игрок изгнан!
                  </div>
                  {ep && (
                    <div style={{ color: theme.text.secondary, fontSize: 14, fontWeight: 600, marginTop: 6 }}>
                      {!rolesHidden ? `(${ROLE_META[ep.role].icon} ${ROLE_META[ep.role].nameRu}) ` : ''}{ep.seat}. {(ep.nick || ep.name).replace('@', '')}
                    </div>
                  )}
                </div>
              );
            })()}
            {result === 'tie' && (
              <div style={{ color: theme.accent.orange, fontSize: 18, fontWeight: 800 }}>
                ⚠️ Ничья! Переголосование
              </div>
            )}
            {result === 'doubleTie' && (
              <div style={{ color: theme.accent.blue, fontSize: 18, fontWeight: 800 }}>
                🤝 Повторная ничья — никто не уходит
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {!result && votingStarted && (
            <button
              onClick={handleResolve}
              disabled={totalVoted === 0}
              style={{
                padding: '12px 28px',
                borderRadius: 12,
                border: 'none',
                background: totalVoted > 0 ? theme.gradient.mafia : 'rgba(255,255,255,0.06)',
                color: totalVoted > 0 ? '#fff' : theme.text.dim,
                fontSize: 14,
                fontWeight: 700,
                cursor: totalVoted > 0 ? 'pointer' : 'default',
                fontFamily: theme.font,
              }}
            >
              Подвести итоги
            </button>
          )}

          {result === 'eliminated' && (
            <button
              onClick={() => {
                if (game.winner) {
                  endGame();
                } else {
                  confirmElimination();
                }
              }}
              style={{
                padding: '12px 28px',
                borderRadius: 12,
                border: 'none',
                background: game.winner ? theme.gradient.mafia : theme.gradient.indigo,
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: theme.font,
              }}
            >
              {game.winner ? '🏁 Конец игры' : '💬 Последнее слово'}
            </button>
          )}

          {result === 'tie' && (
            <button
              onClick={() => {
                startRevote();
                setResult(null);
                setActiveVoter(null);
                setVotingStarted(false);
                setTimerKey((k) => k + 1);
              }}
              style={{
                padding: '12px 28px',
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
              🔄 Переголосовать
            </button>
          )}

          {result === 'doubleTie' && (
            <button
              onClick={startNight}
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
              🌙 Перейти к ночи
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
