import React, { useState } from 'react';
import type { NightActions, NightResult, GameState, CheckResult } from '@shared/types';
import { ROLE_META } from '@shared/types';
import { theme } from '../theme';

interface GameLogProps {
  game: GameState;
  nightResults: NightResult[];
}

function getPlayerLabel(game: GameState, seat: number): string {
  const p = game.players.find((pl) => pl.seat === seat);
  if (!p) return `место ${seat}`;
  const meta = ROLE_META[p.role];
  return `(${meta?.icon || ''} ${meta?.nameRu || p.role}) ${p.seat}. ${(p.nick || p.name).replace('@', '')}`;
}

function getRoleName(game: GameState, seat: number): string {
  const p = game.players.find((pl) => pl.seat === seat);
  return p ? ROLE_META[p.role].nameRu : '?';
}

const causeLabels: Record<string, string> = {
  mafia: 'мафия',
  maniac: 'маньяк',
  werewolf: 'оборотень',
  bodyguardTrade: 'размен',
  vote: 'голосование',
  foul: '3 фола',
  redCard: 'красная карточка',
  techKill: 'удалён',
};

const NightEntry: React.FC<{
  nightIndex: number;
  actions: NightActions;
  result: NightResult;
  game: GameState;
}> = ({ nightIndex, actions, result, game }) => {
  const [open, setOpen] = useState(false);
  const nightNum = nightIndex === 0 ? 0 : nightIndex;
  const label = nightNum === 0 ? 'Ночь 0 (Знакомство)' : `Ночь ${nightNum}`;
  const deathCount = result.deaths.length;

  return (
    <div style={{ marginBottom: 6 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          borderRadius: 8,
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.12)',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 12 }}>🌙</span>
        <span style={{ color: '#A78BFA', fontSize: 11, fontWeight: 700, flex: 1 }}>{label}</span>
        {deathCount > 0 && (
          <span style={{ color: '#EF4444', fontSize: 10, fontWeight: 700 }}>☠ {deathCount}</span>
        )}
        {deathCount === 0 && (
          <span style={{ color: '#22C55E', fontSize: 10 }}>мирная</span>
        )}
        <span style={{ color: theme.text.dim, fontSize: 10 }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={{ padding: '6px 8px 4px 20px', fontSize: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {actions.courtesanTarget !== undefined && (
            <div style={{ color: '#EC4899' }}>💋 Любовница → {getPlayerLabel(game, actions.courtesanTarget)}</div>
          )}
          {actions.mafiaTarget !== undefined && (
            <div style={{ color: '#EF4444' }}>
              🔫 Мафия → {getPlayerLabel(game, actions.mafiaTarget)}
              {actions.enforcerUsed && <span style={{ color: '#EF4444', fontWeight: 700 }}> 💪 ГРОМИЛА</span>}
              {result.werewolfImmune !== undefined && (
                <span style={{ color: '#8B5CF6', fontWeight: 700 }}> 🐺 ИММУНЕН</span>
              )}
            </div>
          )}
          {actions.framerTarget !== undefined && (
            <div style={{ color: '#EA580C' }}>🎭 Подставщик → {getPlayerLabel(game, actions.framerTarget)}</div>
          )}
          {result.enforcerResult && (
            <div style={{ color: result.enforcerResult.effective ? '#EF4444' : '#F97316', fontWeight: 700 }}>
              {result.enforcerResult.effective
                ? '💪 Громила → неблокируемое убийство'
                : result.werewolfImmune !== undefined
                  ? '💪 Громила → Оборотень иммунен, навык сохранён'
                  : result.enforcerResult.reason === 'don_blocked'
                    ? '💪 Громила → Дон заблокирован, навык сохранён'
                    : '💪 Громила → заблокирован Любовницей, навык сохранён'}
            </div>
          )}
          {actions.sheriffTarget !== undefined && (
            <div style={{ color: '#3B82F6' }}>
              🔍 Комиссар → {getPlayerLabel(game, actions.sheriffTarget)}
              {result.sheriffCheck && (
                <span style={{ color: result.sheriffCheck.result === 'mafia' ? '#EF4444' : '#22C55E', fontWeight: 700 }}>
                  {' '}= «{result.sheriffCheck.result === 'mafia' ? 'Мафия' : 'Мирный'}»
                  {result.sheriffCheck.isFramed && <span style={{ color: '#F97316' }}> ⚠️ ПОДСТАВА</span>}
                </span>
              )}
            </div>
          )}
          {actions.seerTargets && (
            <div style={{ color: '#06B6D4' }}>
              👁️ Провидец: {getPlayerLabel(game, actions.seerTargets[0])} & {getPlayerLabel(game, actions.seerTargets[1])}
              {result.seerCompare && (
                <span style={{ fontWeight: 700, color: result.seerCompare.result === 'sameTeam' ? '#3B82F6' : '#F97316' }}>
                  {' '}= «{result.seerCompare.result === 'sameTeam' ? 'Одна команда' : 'Разные'}»
                </span>
              )}
            </div>
          )}
          {actions.doctorTarget !== undefined && (
            <div style={{ color: '#22C55E' }}>💊 Доктор → {getPlayerLabel(game, actions.doctorTarget)}</div>
          )}
          {actions.bodyguardTarget !== undefined && (
            <div style={{ color: '#D97706' }}>🛡️ Телохранитель → {getPlayerLabel(game, actions.bodyguardTarget)}</div>
          )}
          {actions.maniacTarget !== undefined && (
            <div style={{ color: '#F97316' }}>🔪 Маньяк → {getPlayerLabel(game, actions.maniacTarget)}</div>
          )}
          {actions.werewolfTarget !== undefined && (
            <div style={{ color: '#8B5CF6' }}>🐺 Оборотень → {getPlayerLabel(game, actions.werewolfTarget)}</div>
          )}

          {result.saves.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 3, marginTop: 2 }}>
              {result.saves.map((s, i) => (
                <div key={i} style={{ color: '#22C55E', fontWeight: 600 }}>
                  ✅ Спасён: {getPlayerLabel(game, s.seat)} — {ROLE_META[s.savedBy]?.nameRu || s.savedBy}
                </div>
              ))}
            </div>
          )}
          {result.deaths.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 3, marginTop: 2 }}>
              {result.deaths.map((d, i) => (
                <div key={i} style={{ color: '#EF4444', fontWeight: 600 }}>
                  ☠️ {getPlayerLabel(game, d.seat)} ({getRoleName(game, d.seat)}) — {causeLabels[d.cause] || d.cause}
                </div>
              ))}
            </div>
          )}
          {result.werewolfActivated && (
            <div style={{ color: '#8B5CF6', fontWeight: 700, marginTop: 2 }}>🐺 Оборотень активирован!</div>
          )}
        </div>
      )}
    </div>
  );
};

const DayEntry: React.FC<{
  dayNumber: number;
  game: GameState;
}> = ({ dayNumber, game }) => {
  const [open, setOpen] = useState(false);

  const dayVotes = game.voteLog.filter((v) => v.day === dayNumber);
  const dayFouls = game.foulLog.filter((f) => f.day === dayNumber);
  const eliminated = dayVotes.find((v) => v.eliminated !== undefined);

  return (
    <div style={{ marginBottom: 6 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          borderRadius: 8,
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.12)',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 12 }}>☀️</span>
        <span style={{ color: '#F59E0B', fontSize: 11, fontWeight: 700, flex: 1 }}>День {dayNumber}</span>
        {eliminated && (
          <span style={{ color: '#EF4444', fontSize: 10, fontWeight: 700 }}>
            ☠ {getPlayerLabel(game, eliminated.eliminated!)}
          </span>
        )}
        {!eliminated && dayVotes.length > 0 && (
          <span style={{ color: '#22C55E', fontSize: 10 }}>без вывода</span>
        )}
        {dayFouls.length > 0 && (
          <span style={{ color: '#F59E0B', fontSize: 10 }}>⚠ {dayFouls.length}</span>
        )}
        <span style={{ color: theme.text.dim, fontSize: 10 }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={{ padding: '6px 8px 4px 20px', fontSize: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {dayFouls.length > 0 && (
            <div>
              {dayFouls.map((f, i) => (
                <div key={i} style={{ color: '#F59E0B' }}>
                  ⚠️ Фол: {getPlayerLabel(game, f.seat)}
                </div>
              ))}
            </div>
          )}

          {dayVotes.map((v, vi) => (
            <div key={vi} style={{ marginTop: vi > 0 ? 4 : 0 }}>
              <div style={{ color: theme.text.secondary, fontWeight: 700, marginBottom: 2 }}>
                {vi > 0 ? 'Переголосование' : 'Голосование'}
                {v.candidates.length > 0 && (
                  <span style={{ fontWeight: 400 }}>
                    {' '}— кандидаты: {v.candidates.map((s) => getPlayerLabel(game, s)).join(', ')}
                  </span>
                )}
              </div>
              {Object.entries(v.votes).map(([seat, count]) => (
                <div key={seat} style={{ color: theme.text.muted }}>
                  {getPlayerLabel(game, Number(seat))}: {count} голос{count === 1 ? '' : count < 5 ? 'а' : 'ов'}
                </div>
              ))}
              {v.eliminated !== undefined && (
                <div style={{ color: '#EF4444', fontWeight: 700, marginTop: 2 }}>
                  ☠️ Выведен: {getPlayerLabel(game, v.eliminated)} ({getRoleName(game, v.eliminated)})
                </div>
              )}
            </div>
          ))}

          {dayVotes.length === 0 && dayFouls.length === 0 && (
            <div style={{ color: theme.text.dim }}>Без событий</div>
          )}
        </div>
      )}
    </div>
  );
};

export const GameLog: React.FC<GameLogProps> = ({ game, nightResults }) => {
  const [expanded, setExpanded] = useState(true);

  const entries: Array<{ type: 'night' | 'day'; number: number }> = [];

  for (let i = 0; i < game.nightLog.length; i++) {
    entries.push({ type: 'night', number: i });
    entries.push({ type: 'day', number: i + 1 });
  }

  const maxDay = game.dayNumber;

  return (
    <div
      style={{
        marginTop: 8,
        borderTop: `1px solid ${theme.border.subtle}`,
        paddingTop: 8,
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          color: theme.text.muted,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1,
          marginBottom: 6,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        📋 ЖУРНАЛ ИГРЫ
        <span style={{ fontSize: 9 }}>{expanded ? '▾' : '▸'}</span>
      </div>
      {expanded && (
        <div>
          {game.nightLog.length === 0 && (
            <div style={{ color: theme.text.dim, fontSize: 10, padding: '4px 8px' }}>
              Игра только началась
            </div>
          )}
          {game.nightLog.map((actions, i) => {
            const result = nightResults[i];
            if (!result) return null;
            const dayNum = i + 1;
            return (
              <React.Fragment key={i}>
                <NightEntry nightIndex={i} actions={actions} result={result} game={game} />
                {dayNum <= maxDay && <DayEntry dayNumber={dayNum} game={game} />}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};
