import React, { useState, useEffect } from 'react';
import { theme } from '../theme';
import { useGameStore } from '../store/gameStore';
import { PlayerList } from '../components/PlayerList';
import { PhaseBadge } from '../components/PhaseBadge';
import { Timer } from '../components/Timer';
import { EyeToggle } from '../components/EyeToggle';
import { ROLE_META, getTimerSettings } from '@shared/types';

export const DayAnnounce: React.FC = () => {
  const game = useGameStore((s) => s.game);
  const nightResults = useGameStore((s) => s.nightResults);
  const nightPhase = useGameStore((s) => s.nightPhase);
  const startOpium = useGameStore((s) => s.startOpium);
  const endGame = useGameStore((s) => s.endGame);
  const sheriffDeathshot = useGameStore((s) => s.sheriffDeathshot);
  const rolesHidden = useGameStore((s) => s.rolesHidden);

  const [phase, setPhase] = useState<'announce' | 'lastWord' | 'deathshot' | 'done'>('announce');
  const [currentDeathIdx, setCurrentDeathIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 800);
    return () => clearTimeout(timer);
  }, []);

  if (!game) return null;

  const lastResult = nightPhase.result || (nightResults.length > 0 ? nightResults[nightResults.length - 1] : null);
  const lastActions = nightPhase.actions;
  const isNight0 = game.dayNumber === 1 && !lastResult;
  const deaths = lastResult?.deaths || [];
  const saves = lastResult?.saves || [];
  const peacefulNight = deaths.length === 0;
  const timerSettings = getTimerSettings(game.playerCount);

  const sheriffDeath = deaths.find(d => {
    const p = game.players.find(pl => pl.seat === d.seat);
    return p?.role === 'sheriff';
  });
  const sheriffPlayer = sheriffDeath ? game.players.find(p => p.seat === sheriffDeath.seat) : null;
  const deathshotTargets = sheriffPlayer
    ? game.sheriffChecks
        .filter(check => check.result === 'mafia')
        .map(check => game.players.find(p => p.seat === check.seat))
        .filter((p): p is NonNullable<typeof p> => p != null && p.alive)
    : [];

  const currentDeath = deaths[currentDeathIdx];
  const currentDeadPlayer = currentDeath ? game.players.find(p => p.seat === currentDeath.seat) : null;

  const blockedSeat = lastResult?.blocked;
  const blockedPlayer = blockedSeat !== undefined ? game.players.find((p) => p.seat === blockedSeat) : undefined;
  const framerTarget = lastActions?.framerTarget;
  const framerPlayer = framerTarget !== undefined ? game.players.find((p) => p.seat === framerTarget) : undefined;
  const doctorTarget = lastActions?.doctorTarget;
  const doctorPlayer = doctorTarget !== undefined ? game.players.find((p) => p.seat === doctorTarget) : undefined;
  const werewolfImmuneSeat = lastResult?.werewolfImmune;
  const werewolfImmunePlayer = werewolfImmuneSeat !== undefined ? game.players.find((p) => p.seat === werewolfImmuneSeat) : undefined;
  const hasGmInfo = blockedPlayer || framerPlayer || lastResult?.sheriffCheck || lastResult?.seerCompare || doctorPlayer || werewolfImmunePlayer;

  const handleProceedFromAnnounce = () => {
    if (game.winner) {
      endGame();
      return;
    }
    if (deaths.length > 0) {
      setCurrentDeathIdx(0);
      setPhase('lastWord');
    } else {
      startOpium();
    }
  };

  const handleNextLastWord = () => {
    const nextIdx = currentDeathIdx + 1;
    if (nextIdx < deaths.length) {
      setCurrentDeathIdx(nextIdx);
    } else if (sheriffPlayer && deathshotTargets.length > 0) {
      setPhase('deathshot');
    } else if (game.winner) {
      endGame();
    } else {
      startOpium();
    }
  };

  const handleDeathshot = (targetSeat: number) => {
    const targetPlayer = game.players.find(p => p.seat === targetSeat);
    const targetMeta = targetPlayer ? ROLE_META[targetPlayer.role] : null;
    if (confirm(`Выстрелить в ${targetMeta ? `(${targetMeta.icon} ${targetMeta.nameRu}) ` : ''}${targetSeat}. ${targetPlayer?.nick.replace('@', '') || targetPlayer?.name}?`)) {
      sheriffDeathshot(targetSeat);
      const updatedGame = useGameStore.getState().game;
      if (updatedGame?.winner) {
        endGame();
      } else {
        startOpium();
      }
    }
  };

  const handleSkipDeathshot = () => {
    if (game.winner) {
      endGame();
    } else {
      startOpium();
    }
  };

  if (phase === 'lastWord' && currentDeadPlayer) {
    const meta = ROLE_META[currentDeadPlayer.role];
    const causeText: Record<string, string> = {
      mafia: 'Убит мафией',
      maniac: 'Убит маньяком',
      werewolf: 'Убит оборотнем',
      bodyguardTrade: 'Погиб в размене',
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
            sub={`Ночные жертвы — ${currentDeathIdx + 1} из ${deaths.length}`}
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
                background: `linear-gradient(135deg,${currentDeadPlayer.avatar?.colors[0] || '#64748B'},${currentDeadPlayer.avatar?.colors[1] || '#1E293B'})`,
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
              {currentDeadPlayer.seat}
            </div>

            <div style={{ color: theme.text.primary, fontSize: 22, fontWeight: 700 }}>
              {currentDeadPlayer.seat}. {(currentDeadPlayer.nick || currentDeadPlayer.name).replace('@', '')}
            </div>
            <div style={{ color: theme.text.dim, fontSize: 12, marginTop: 4 }}>
              {currentDeadPlayer.name}
            </div>

            <div style={{ color: theme.text.dim, fontSize: 11, marginTop: 6 }}>
              {causeText[currentDeath.cause] || currentDeath.cause}
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

          <button
            onClick={handleNextLastWord}
            style={{
              padding: '14px 36px',
              borderRadius: 14,
              border: 'none',
              background: currentDeathIdx + 1 < deaths.length
                ? theme.gradient.indigo
                : (sheriffPlayer && deathshotTargets.length > 0)
                  ? 'linear-gradient(135deg, #3B82F6, #6366F1)'
                  : theme.gradient.orange,
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: theme.font,
            }}
          >
            {currentDeathIdx + 1 < deaths.length
              ? `💬 Следующий (${currentDeathIdx + 2}/${deaths.length})`
              : (sheriffPlayer && deathshotTargets.length > 0)
                ? '🔫 Выстрел Комиссара'
                : '🔥 Opium Mafia!'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'deathshot' && sheriffPlayer) {
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
            icon="🔫"
            label="ВЫСТРЕЛ КОМИССАРА"
            color="#3B82F6"
            sub={`(${ROLE_META[sheriffPlayer.role].icon} ${ROLE_META[sheriffPlayer.role].nameRu}) ${sheriffPlayer.seat}. ${(sheriffPlayer.nick || sheriffPlayer.name).replace('@', '')} — предсмертный выстрел`}
          />

          <div
            style={{
              padding: '20px 24px',
              borderRadius: 14,
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.2)',
              marginBottom: 24,
              textAlign: 'center',
              maxWidth: 420,
              width: '100%',
            }}
          >
            <div style={{ color: '#3B82F6', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
              Комиссар может выстрелить в ранее проверенного мафиози
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {deathshotTargets.map((p) => {
                const pMeta = ROLE_META[p.role];
                return (
                <div
                  key={p.seat}
                  onClick={() => handleDeathshot(p.seat)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: 'rgba(59,130,246,0.12)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    color: theme.text.primary,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  🔫 ({pMeta.icon} {pMeta.nameRu}) {p.seat}. {(p.nick || p.name).replace('@', '')}
                </div>
              );
              })}
            </div>
          </div>

          <button
            onClick={handleSkipDeathshot}
            style={{
              padding: '12px 28px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: theme.text.secondary,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: theme.font,
            }}
          >
            Пропустить выстрел → Opium
          </button>
        </div>
      </div>
    );
  }

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
          icon="📢"
          label={`ДЕНЬ ${game.dayNumber}`}
          color={theme.accent.orange}
          sub="Город просыпается..."
        />

        <div
          style={{
            width: '100%',
            maxWidth: 420,
            opacity: revealed ? 1 : 0,
            transition: 'opacity 0.6s ease',
          }}
        >
          <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>
            📢 ОБЪЯВИТЬ
          </div>

          {isNight0 || peacefulNight ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>☀️</div>
              <div style={{ color: theme.text.primary, fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
                Спокойная ночь
              </div>
              <div style={{ color: theme.text.dim, fontSize: 14 }}>
                Никто не погиб.
                {saves.length > 0 && (
                  <span style={{ color: theme.accent.green }}>
                    {' '}Но кое-кого спасли...
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {deaths.map((d, i) => {
                const p = game.players.find((pl) => pl.seat === d.seat);
                if (!p) return null;
                const causeText: Record<string, string> = {
                  mafia: 'Убит мафией',
                  maniac: 'Убит маньяком',
                  werewolf: 'Убит оборотнем',
                  bodyguardTrade: 'Погиб в размене',
                };
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 24px',
                      borderRadius: 14,
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      animation: 'fadeSlideIn 0.5s ease',
                      animationDelay: `${i * 0.3}s`,
                      animationFillMode: 'both',
                    }}
                  >
                    <div style={{ fontSize: 28 }}>☠️</div>
                    <div>
                      <div style={{ color: '#EF4444', fontSize: 16, fontWeight: 700 }}>
                        {p.seat}. {(p.nick || p.name).replace('@', '')}
                      </div>
                      <div style={{ color: theme.text.dim, fontSize: 12, marginTop: 2 }}>
                        {causeText[d.cause] || d.cause}
                      </div>
                    </div>
                  </div>
                );
              })}

              {saves.filter(s => s.savedBy === 'doctor').length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 24px',
                    borderRadius: 14,
                    background: 'rgba(34,197,94,0.08)',
                    border: '1px solid rgba(34,197,94,0.2)',
                  }}
                >
                  <div style={{ fontSize: 24 }}>✅</div>
                  <div>
                    <div style={{ color: '#22C55E', fontSize: 14, fontWeight: 700 }}>
                      Покушение не удалось
                    </div>
                  </div>
                </div>
              )}

              {lastResult?.werewolfImmune !== undefined && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 24px',
                    borderRadius: 14,
                    background: 'rgba(34,197,94,0.08)',
                    border: '1px solid rgba(34,197,94,0.2)',
                  }}
                >
                  <div style={{ fontSize: 24 }}>✅</div>
                  <div>
                    <div style={{ color: '#22C55E', fontSize: 14, fontWeight: 700 }}>
                      Покушение не удалось
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {!isNight0 && hasGmInfo && !rolesHidden && (
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              marginTop: 20,
              padding: 16,
              borderRadius: 14,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              opacity: revealed ? 0.7 : 0,
              transition: 'opacity 0.6s ease',
            }}
          >
            <div style={{ color: theme.text.dim, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>
              🔒 НЕ ОБЪЯВЛЯТЬ (для ведущего)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {blockedPlayer && (
                <div style={{ color: theme.text.dim, fontSize: 12 }}>
                  {`💋 Куртизанка заблокировала место ${blockedPlayer.seat} (${blockedPlayer.name})`}
                </div>
              )}
              {framerPlayer && (
                <div style={{ color: theme.text.dim, fontSize: 12 }}>
                  {`🎭 Фреймер подставил место ${framerPlayer.seat} (${framerPlayer.name})`}
                </div>
              )}
              {lastResult?.sheriffCheck && (
                <div style={{ color: theme.text.dim, fontSize: 12 }}>
                  {`🔍 Комиссар проверил место ${lastResult.sheriffCheck.seat}: `}
                  <span style={{ color: lastResult.sheriffCheck.result === 'mafia' ? '#EF4444' : '#22C55E' }}>
                    {lastResult.sheriffCheck.result === 'mafia' ? '«Мафия»' : '«Мирный»'}
                  </span>
                  {lastResult.sheriffCheck.isFramed && (
                    <span style={{ color: '#F97316', fontSize: 10 }}> (ПОДСТАВА!)</span>
                  )}
                </div>
              )}
              {lastResult?.seerCompare && (
                <div style={{ color: theme.text.dim, fontSize: 12 }}>
                  {`👁️ Провидец: ${lastResult.seerCompare.seats[0]} & ${lastResult.seerCompare.seats[1]} = `}
                  <span style={{ color: lastResult.seerCompare.result === 'sameTeam' ? '#3B82F6' : '#F97316' }}>
                    {lastResult.seerCompare.result === 'sameTeam' ? '«Одна команда»' : '«Разные»'}
                  </span>
                </div>
              )}
              {doctorPlayer && (
                <div style={{ color: theme.text.dim, fontSize: 12 }}>
                  {`🩺 Доктор лечил место ${doctorPlayer.seat} (${doctorPlayer.name})`}
                </div>
              )}
              {werewolfImmunePlayer && (
                <div style={{ color: '#8B5CF6', fontSize: 12 }}>
                  {`🐺 Мафия целилась в Оборотня (${werewolfImmunePlayer.seat}) — иммунен (не Доктор)`}
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: 32 }}>
          <button
            onClick={handleProceedFromAnnounce}
            style={{
              padding: '14px 36px',
              borderRadius: 14,
              border: 'none',
              background: game.winner
                ? theme.gradient.mafia
                : deaths.length > 0
                  ? theme.gradient.indigo
                  : theme.gradient.orange,
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: theme.font,
            }}
          >
            {game.winner
              ? '🏁 Конец игры'
              : deaths.length > 0
                ? '💬 Последнее слово'
                : '🔥 Opium Mafia!'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
