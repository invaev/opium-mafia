import type { Player } from '@shared/types';

export type VictoryResult =
  | { winner: 'peaceful'; reason: string }
  | { winner: 'mafia'; reason: string }
  | { winner: 'werewolf'; reason: string }
  | { winner: null; werewolfActivated?: boolean };

export function checkVictory(
  players: Player[],
  werewolfActive: boolean
): VictoryResult {
  const alive = players.filter(p => p.alive);
  const mafiaAlive = alive.filter(p => p.team === 'mafia');
  const peacefulAlive = alive.filter(p => p.team === 'peaceful');
  const werewolfPlayer = alive.find(p => p.role === 'werewolf');

  const nonMafiaAlive = alive.filter(p => p.team !== 'mafia');

  if (mafiaAlive.length > 0 && mafiaAlive.length >= nonMafiaAlive.length) {
    return {
      winner: 'mafia',
      reason: `\u041C\u0430\u0444\u0438\u044F (${mafiaAlive.length}) \u2265 \u041C\u0438\u0440\u043D\u044B\u0435 (${nonMafiaAlive.length})`,
    };
  }

  if (mafiaAlive.length === 0) {
    if (werewolfPlayer && werewolfActive) {
      const nonWerewolfAlive = alive.filter(p => p.role !== 'werewolf').length;
      if (nonWerewolfAlive <= 1) {
        return {
          winner: 'werewolf',
          reason: `\u041E\u0431\u043E\u0440\u043E\u0442\u0435\u043D\u044C (1) \u2265 \u041C\u0438\u0440\u043D\u044B\u0445 (${nonWerewolfAlive})`,
        };
      }
      return { winner: null };
    }

    if (werewolfPlayer && !werewolfActive) {
      return {
        winner: null,
        werewolfActivated: true,
      };
    }

    return {
      winner: 'peaceful',
      reason: '\u0412\u0441\u044F \u043C\u0430\u0444\u0438\u044F \u0443\u0441\u0442\u0440\u0430\u043D\u0435\u043D\u0430',
    };
  }

  return { winner: null };
}
