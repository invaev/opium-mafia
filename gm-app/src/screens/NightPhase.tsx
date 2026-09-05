import React, { useMemo } from 'react';
import { theme } from '../theme';
import { useGameStore, getActiveNightSteps } from '../store/gameStore';
import { PlayerList } from '../components/PlayerList';
import { CircleTable } from '../components/CircleTable';
import { EyeToggle } from '../components/EyeToggle';
import { ROLE_META, NIGHT_STEPS } from '@shared/types';

function seatLabel(players: { seat: number; name: string; nick: string; role: string }[], seat: number): string {
  const p = players.find(pl => pl.seat === seat);
  if (!p) return `место ${seat}`;
  const meta = ROLE_META[p.role as keyof typeof ROLE_META];
  return `(${meta?.icon || ''} ${meta?.nameRu || p.role}) ${seat}. ${(p.nick || p.name).replace('@', '')}`;
}

export const NightPhase: React.FC = () => {
  const game = useGameStore((s) => s.game);
  const nightPhase = useGameStore((s) => s.nightPhase);
  const setNightStep = useGameStore((s) => s.setNightStep);
  const recordNightAction = useGameStore((s) => s.recordNightAction);
  const setEnforcerUsed = useGameStore((s) => s.setEnforcerUsed);
  const resolveCurrentNight = useGameStore((s) => s.resolveCurrentNight);
  const startDayAnnounce = useGameStore((s) => s.startDayAnnounce);
  const setScreen = useGameStore((s) => s.setScreen);
  const rolesHidden = useGameStore((s) => s.rolesHidden);

  if (!game) return null;

  const activeSteps = useMemo(() => getActiveNightSteps(game), [game]);
  const step = nightPhase.currentStep;
  const cur = activeSteps[step];
  const alive = game.players.filter((p) => p.alive);

  const getTargets = (stepDef: typeof NIGHT_STEPS[0]) => {
    if (stepDef.isGroup) return alive.filter((p) => p.team !== 'mafia');
    if (stepDef.role === 'bodyguard') {
      const bgSeat = game.players.find((p) => p.alive && p.role === 'bodyguard')?.seat;
      const prevBgTarget = game.previousBodyguardTarget;
      return alive.filter((p) => p.seat !== bgSeat && p.seat !== prevBgTarget);
    }
    if (stepDef.role === 'maniac') return alive;
    if (stepDef.role === 'doctor') {
      if (game.doctorConsecutiveCount >= 2 && game.doctorLastTarget !== undefined) {
        return alive.filter((p) => p.seat !== game.doctorLastTarget);
      }
      return alive;
    }
    if (stepDef.role === 'hooker') {
      const hookerSeat = game.players.find((p) => p.alive && p.role === 'hooker')?.seat;
      const prevCourtesanTarget = game.previousCourtesanTarget;
      return alive.filter((p) => p.seat !== hookerSeat && p.seat !== prevCourtesanTarget);
    }
    if (stepDef.role === 'seer') return alive.filter((p) => p.role !== 'seer');
    if (stepDef.role === 'sheriff') {
      const sheriffSeat = game.players.find((p) => p.alive && p.role === 'sheriff')?.seat;
      return alive.filter((p) => p.seat !== sheriffSeat);
    }
    if (stepDef.role === 'framer') return alive.filter((p) => p.team === 'peaceful');
    if (stepDef.role === 'werewolf') return alive.filter((p) => p.role !== 'werewolf');
    return alive.filter((p) => p.role !== stepDef.role);
  };

  const getSelectedSeat = (): number | undefined => {
    if (!cur) return undefined;
    const a = nightPhase.actions;
    switch (cur.role) {
      case 'hooker': return a.courtesanTarget;
      case 'don': return a.mafiaTarget;
      case 'framer': return a.framerTarget;
      case 'sheriff': return a.sheriffTarget;
      case 'seer': return a.seerTargets?.[0];
      case 'doctor': return a.doctorTarget;
      case 'bodyguard': return a.bodyguardTarget;
      case 'maniac': return a.maniacTarget;
      case 'werewolf': return a.werewolfTarget;
    }
    return undefined;
  };

  const selectedSeat = getSelectedSeat();
  const isPassed = nightPhase.passed[step];

  const getCheckResult = () => {
    if (nightPhase.result?.sheriffCheck) {
      const { seat, result, isFramed } = nightPhase.result.sheriffCheck;
      const p = game.players.find((pl) => pl.seat === seat);
      return { seat, result, isFramed, name: p?.name };
    }
    return null;
  };

  const getSeerResult = () => {
    if (nightPhase.result?.seerCompare) {
      return nightPhase.result.seerCompare;
    }
    return null;
  };

  const handleFinishNight = () => {
    resolveCurrentNight();
  };

  const handleGoToDay = () => {
    startDayAnnounce();
  };

  const hasEnforcer = game.players.some((p) => p.alive && p.role === 'enforcer');
  const enforcerAlreadyUsed = game.enforcerUsed;

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <EyeToggle />
      <PlayerList players={game.players} phase="НОЧЬ" night={game.dayNumber} />
      <div style={{ flex: 1, padding: '20px 24px 120px', overflowY: 'auto' }}>
        <div style={{ color: '#A78BFA', fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>
          🌙 НОЧЬ {game.dayNumber}
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {activeSteps.map((ns, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background:
                  i < step ? '#22C55E' : i === step ? ns.color : 'rgba(255,255,255,0.06)',
                cursor: 'pointer',
              }}
              onClick={() => {
                if (i <= step) setNightStep(i);
              }}
            />
          ))}
        </div>

        {step < activeSteps.length && !nightPhase.result ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 42, marginBottom: 4 }}>{cur.icon}</div>
              <div style={{ color: theme.text.primary, fontSize: 22, fontWeight: 800 }}>
                «{cur.nameRu} просыпается»
              </div>
              <div style={{ color: theme.text.muted, fontSize: 13, marginTop: 4 }}>
                {cur.actionRu}
              </div>
              <div
                style={{
                  color: cur.color,
                  fontSize: 11,
                  marginTop: 4,
                  fontStyle: 'italic',
                }}
              >
                {cur.note}
              </div>

              {!rolesHidden && (cur.isGroup ? (
                (() => {
                  const mafiaAlive = game.players.filter((p) => p.alive && p.team === 'mafia');
                  const donAlive = mafiaAlive.some((p) => p.role === 'don');
                  const isLastManFramer = mafiaAlive.length === 1 && mafiaAlive[0].role === 'framer';
                  return (
                    <div style={{ color: '#EF4444', fontSize: 11, marginTop: 4 }}>
                      Мафия ({mafiaAlive.length}):{' '}
                      {mafiaAlive.map((p) => `${p.seat}`).join(', ')}
                      {!donAlive && mafiaAlive.length > 0 && (
                        <span style={{ color: theme.text.dim }}> (без Дона)</span>
                      )}
                      {isLastManFramer && (
                        <span style={{ color: '#F97316' }}> — Подставщик единственный</span>
                      )}
                    </div>
                  );
                })()
              ) : (
                (() => {
                  const rolePlayer = game.players.find(
                    (p) => p.alive && p.role === cur.role
                  );
                  return rolePlayer ? (
                    <div style={{ color: cur.color, fontSize: 11, marginTop: 4 }}>
                      Игрок: ({cur.icon} {cur.nameRu}) {rolePlayer.seat}. {(rolePlayer.nick || rolePlayer.name).replace('@', '')}
                    </div>
                  ) : null;
                })()
              ))}

              {cur.isGroup && hasEnforcer && !enforcerAlreadyUsed && (
                <div
                  onClick={() => {
                    if (!nightPhase.actions.enforcerUsed) {
                      if (window.confirm('Навык Громилы будет использован. Отменить нельзя. Продолжить?')) {
                        setEnforcerUsed(true);
                      }
                    }
                  }}
                  style={{
                    marginTop: 10,
                    padding: '10px 18px',
                    borderRadius: 12,
                    background: nightPhase.actions.enforcerUsed
                      ? 'rgba(239,68,68,0.15)'
                      : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${nightPhase.actions.enforcerUsed ? '#EF4444' : 'rgba(255,255,255,0.1)'}`,
                    cursor: nightPhase.actions.enforcerUsed ? 'default' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 18 }}>💪</span>
                  <div>
                    <div style={{
                      color: nightPhase.actions.enforcerUsed ? '#EF4444' : theme.text.secondary,
                      fontSize: 13,
                      fontWeight: 700,
                    }}>
                      {nightPhase.actions.enforcerUsed ? 'Громила АКТИВИРОВАН' : 'Громила'}
                    </div>
                    <div style={{
                      color: nightPhase.actions.enforcerUsed ? '#EF4444' : theme.text.dim,
                      fontSize: 10,
                    }}>
                      {nightPhase.actions.enforcerUsed
                        ? 'Неблокируемое убийство (Доктор/Телохранитель не спасут)'
                        : 'Одноразовое неблокируемое убийство'}
                    </div>
                  </div>
                </div>
              )}
              {cur.isGroup && hasEnforcer && enforcerAlreadyUsed && (
                <div style={{ marginTop: 8, color: theme.text.dim, fontSize: 11 }}>
                  💪 Громила уже использован
                </div>
              )}
            </div>

            {!isPassed && (
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
                  players={getTargets(cur)}
                  selected={selectedSeat}
                  showRole={true}
                  hideRoles={rolesHidden}
                  menuItems={[
                    {
                      icon: '🎯',
                      label: 'Выбрать',
                      action: 'select',
                      color: cur.color,
                    },
                  ]}
                  onAction={(_action, p) => {
                    recordNightAction(step, p.seat);
                  }}
                  size={260}
                  seatSize={42}
                />
              </div>
            )}

            {cur.role === 'seer' && nightPhase.actions.seerTargets?.[0] && !nightPhase.actions.seerTargets?.[1] && (
              <div style={{ textAlign: 'center', marginBottom: 10, color: theme.accent.cyan, fontSize: 12 }}>
                Выберите второго игрока для сравнения
              </div>
            )}

            {step > 0 && !rolesHidden && (
              <div
                style={{
                  marginBottom: 14,
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${theme.border.subtle}`,
                }}
              >
                <div style={{ color: theme.text.dim, fontSize: 9, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
                  ДЕЙСТВИЯ ЭТОЙ НОЧИ
                </div>
                {activeSteps.slice(0, step).map((ns, i) => {
                  const a = nightPhase.actions;
                  const pl = game.players;
                  let targetText = '—';
                  if (nightPhase.passed[i]) {
                    targetText = 'Пас';
                  } else {
                    switch (ns.role) {
                      case 'hooker': targetText = a.courtesanTarget ? seatLabel(pl, a.courtesanTarget) : '—'; break;
                      case 'don': targetText = a.mafiaTarget ? `${seatLabel(pl, a.mafiaTarget)}${a.enforcerUsed ? ' (Громила)' : ''}` : '—'; break;
                      case 'framer': targetText = a.framerTarget ? seatLabel(pl, a.framerTarget) : '—'; break;
                      case 'sheriff': targetText = a.sheriffTarget ? seatLabel(pl, a.sheriffTarget) : '—'; break;
                      case 'seer': targetText = a.seerTargets ? `${seatLabel(pl, a.seerTargets[0])} и ${seatLabel(pl, a.seerTargets[1])}` : '—'; break;
                      case 'doctor': targetText = a.doctorTarget ? seatLabel(pl, a.doctorTarget) : '—'; break;
                      case 'bodyguard': targetText = a.bodyguardTarget ? seatLabel(pl, a.bodyguardTarget) : '—'; break;
                      case 'maniac': targetText = a.maniacTarget ? seatLabel(pl, a.maniacTarget) : '—'; break;
                      case 'werewolf': targetText = a.werewolfTarget ? seatLabel(pl, a.werewolfTarget) : '—'; break;
                    }
                  }
                  return (
                    <div key={i} style={{ color: ns.color, fontSize: 11, lineHeight: '18px' }}>
                      {ns.icon} {ns.nameRu} → {targetText}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {step > 0 && (
                <button
                  onClick={() => setNightStep(step - 1)}
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
                  ← Назад
                </button>
              )}
              {cur.canPass && (
                <button
                  onClick={() => recordNightAction(step, 'pass')}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: `1px solid ${theme.border.medium}`,
                    background: 'transparent',
                    color: theme.text.dim,
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: theme.font,
                  }}
                >
                  Пас
                </button>
              )}
              <button
                onClick={() => {
                  if (step === activeSteps.length - 1) {
                    handleFinishNight();
                  } else {
                    setNightStep(step + 1);
                  }
                }}
                style={{
                  padding: '10px 24px',
                  borderRadius: 10,
                  border: 'none',
                  background:
                    selectedSeat || isPassed
                      ? `linear-gradient(135deg,${cur.color},${cur.color}CC)`
                      : 'rgba(255,255,255,0.06)',
                  color: selectedSeat || isPassed ? '#fff' : theme.text.dim,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: theme.font,
                }}
              >
                {step === activeSteps.length - 1
                  ? 'Завершить ночь'
                  : `«${cur.nameRu} засыпает» →`}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>☀️</div>
            <div
              style={{
                color: theme.text.primary,
                fontSize: 22,
                fontWeight: 800,
                marginBottom: 16,
              }}
            >
              Ночь завершена
            </div>

            {!rolesHidden && (
            <div
              style={{
                display: 'inline-flex',
                flexDirection: 'column',
                gap: 6,
                padding: '14px 20px',
                borderRadius: 12,
                background: theme.bg.card,
                border: `1px solid ${theme.border.default}`,
                textAlign: 'left',
              }}
            >
              {activeSteps.map((ns, i) => {
                const a = nightPhase.actions;
                let targetText = '—';
                if (nightPhase.passed[i]) {
                  targetText = 'Пас';
                } else {
                  const pl = game.players;
                  switch (ns.role) {
                    case 'hooker': targetText = a.courtesanTarget ? seatLabel(pl, a.courtesanTarget) : '—'; break;
                    case 'don': targetText = a.mafiaTarget ? `${seatLabel(pl, a.mafiaTarget)}${a.enforcerUsed ? ' (Громила)' : ''}` : '—'; break;
                    case 'framer': targetText = a.framerTarget ? seatLabel(pl, a.framerTarget) : '—'; break;
                    case 'sheriff': targetText = a.sheriffTarget ? seatLabel(pl, a.sheriffTarget) : '—'; break;
                    case 'seer': targetText = a.seerTargets ? `${seatLabel(pl, a.seerTargets[0])} и ${seatLabel(pl, a.seerTargets[1])}` : '—'; break;
                    case 'doctor': targetText = a.doctorTarget ? seatLabel(pl, a.doctorTarget) : '—'; break;
                    case 'bodyguard': targetText = a.bodyguardTarget ? seatLabel(pl, a.bodyguardTarget) : '—'; break;
                    case 'maniac': targetText = a.maniacTarget ? seatLabel(pl, a.maniacTarget) : '—'; break;
                    case 'werewolf': targetText = a.werewolfTarget ? seatLabel(pl, a.werewolfTarget) : '—'; break;
                  }
                }
                return (
                  <div key={i} style={{ color: ns.color, fontSize: 13 }}>
                    {ns.icon} {ns.nameRu} → {targetText}
                  </div>
                );
              })}

              {nightPhase.result && (nightPhase.result.saves.length > 0 || nightPhase.result.sheriffCheck || nightPhase.result.seerCompare || nightPhase.result.enforcerResult || nightPhase.result.werewolfImmune !== undefined) && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${theme.border.default}` }}>
                  {nightPhase.result.werewolfImmune !== undefined && (
                    <div style={{ color: '#8B5CF6', fontSize: 12, fontWeight: 600 }}>
                      {`🐺 Оборотень (${seatLabel(game.players, nightPhase.result.werewolfImmune)}) — иммунен, покушение провалено ❌`}
                    </div>
                  )}
                  {nightPhase.result.saves.map((s, i) => (
                    <div key={i} style={{ color: '#22C55E', fontSize: 12, fontWeight: 600 }}>
                      ✅ Спасён ({seatLabel(game.players, s.seat)}) — {s.savedBy}
                    </div>
                  ))}
                  {nightPhase.result.enforcerResult && (
                    <div style={{
                      color: nightPhase.result.enforcerResult.effective ? '#EF4444' : '#F97316',
                      fontSize: 12,
                      fontWeight: 600,
                    }}>
                      {nightPhase.result.enforcerResult.effective
                        ? `💪 Громила → неблокируемое убийство (место ${nightPhase.actions.mafiaTarget})`
                        : nightPhase.result.werewolfImmune !== undefined
                          ? '💪 Громила → Оборотень иммунен, навык сохранён'
                          : nightPhase.result.enforcerResult.reason === 'don_blocked'
                            ? '💪 Громила → Дон заблокирован, убийства нет, навык сохранён'
                            : nightPhase.result.enforcerResult.reason === 'enforcer_blocked'
                              ? `💪 Громила → заблокирован Любовницей, убийство обычное (место ${nightPhase.actions.mafiaTarget})`
                              : `💪 Громила → навык не сработал (место ${nightPhase.actions.mafiaTarget})`
                      }
                    </div>
                  )}
                  {nightPhase.result.sheriffCheck && (
                    <div
                      style={{
                        color: nightPhase.result.sheriffCheck.result === 'mafia' ? '#EF4444' : '#22C55E',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      🔍 Комиссар → {seatLabel(game.players, nightPhase.result.sheriffCheck.seat)} ={' '}
                      {nightPhase.result.sheriffCheck.result === 'mafia' ? '«Мафия»' : '«Мирный»'}
                      {nightPhase.result.sheriffCheck.isFramed && (
                        <span style={{ color: '#F97316' }}> ⚠️ ПОДСТАВА</span>
                      )}
                    </div>
                  )}
                  {nightPhase.result.seerCompare && (
                    <div
                      style={{
                        color: nightPhase.result.seerCompare.result === 'sameTeam' ? '#3B82F6' : '#F97316',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      👁️ Провидец: {seatLabel(game.players, nightPhase.result.seerCompare.seats[0])} & {seatLabel(game.players, nightPhase.result.seerCompare.seats[1])} ={' '}
                      {nightPhase.result.seerCompare.result === 'sameTeam'
                        ? '«Одна команда»'
                        : '«Разные»'}
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            {nightPhase.result && (
              <div
                style={{
                  marginTop: 14,
                  padding: '12px 24px',
                  borderRadius: 12,
                  background: nightPhase.result.deaths.length > 0
                    ? 'rgba(239,68,68,0.08)'
                    : 'rgba(34,197,94,0.08)',
                  border: `1px solid ${nightPhase.result.deaths.length > 0
                    ? 'rgba(239,68,68,0.2)'
                    : 'rgba(34,197,94,0.2)'}`,
                  display: 'inline-flex',
                  flexDirection: 'column',
                  gap: 6,
                  textAlign: 'left',
                }}
              >
                {nightPhase.result.deaths.length === 0 ? (
                  <div style={{ color: '#22C55E', fontSize: 14, fontWeight: 700 }}>
                    ☀️ Без смертей
                  </div>
                ) : (
                  nightPhase.result.deaths.map((d, i) => {
                    const p = game.players.find((pl) => pl.seat === d.seat);
                    const isEnforcerKill = d.cause === 'mafia' && nightPhase.result?.enforcerResult?.effective && d.seat === nightPhase.actions.mafiaTarget;
                    const causeText: Record<string, string> = {
                      mafia: 'мафия',
                      maniac: 'маньяк',
                      werewolf: 'оборотень',
                      bodyguardTrade: 'размен',
                    };
                    return (
                      <div key={i} style={{ color: '#EF4444', fontSize: 14, fontWeight: 700 }}>
                        ☠️ {!rolesHidden && `(${ROLE_META[p!.role].icon} ${ROLE_META[p!.role].nameRu}) `}{p?.seat}. {(p?.nick || p?.name || '').replace('@', '')}
                        {!rolesHidden && <span style={{ color: theme.text.dim, fontSize: 11, fontWeight: 500 }}>
                          {' '}({causeText[d.cause] || d.cause})
                        </span>}
                        {isEnforcerKill && (
                          <span style={{ color: '#EF4444', fontSize: 10, fontWeight: 700 }}>
                            {' '}💪 ГРОМИЛА
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div style={{ marginTop: 8 }}>
              {game.winner ? (
                <button
                  onClick={() => {
                    useGameStore.getState().endGame();
                  }}
                  style={{
                    padding: '12px 32px',
                    borderRadius: 12,
                    border: 'none',
                    background: theme.gradient.mafia,
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: theme.font,
                  }}
                >
                  🏁 Конец игры
                </button>
              ) : (
                <button
                  onClick={handleGoToDay}
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
                  ☀️ «Город просыпается»
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
