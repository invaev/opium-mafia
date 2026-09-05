import type { Player, GameState, NightResult, GameRatingBreakdown, GameRole } from '@shared/types';

export interface RatingConfig {
  victory: number;
  defeat: number;
  survived: number;
  foul1: number;
  foul2: number;
  foul3TechKill: number;
  redCard: number;
  firstEliminatedDay1: number;
}

export const DEFAULT_RATING_CONFIG: RatingConfig = {
  victory: 10,
  defeat: 2,
  survived: 3,
  foul1: -1,
  foul2: -2,
  foul3TechKill: -5,
  redCard: -5,
  firstEliminatedDay1: -1,
};

export function calculateRating(
  player: Player,
  state: GameState,
  nightResults: NightResult[],
  config: RatingConfig = DEFAULT_RATING_CONFIG
): GameRatingBreakdown {
  const details: string[] = [];
  let total = 0;

  const winner = state.winner;
  const playerWon =
    (winner === 'peaceful' && player.team === 'peaceful' && (player.role !== 'werewolf' || !state.werewolfActive)) ||
    (winner === 'mafia' && player.team === 'mafia') ||
    (winner === 'werewolf' && (player.role === 'werewolf' || player.team === 'mafia'));

  const base = playerWon ? config.victory : config.defeat;
  total += base;
  details.push(playerWon ? `\u041F\u043E\u0431\u0435\u0434\u0430: +${config.victory}` : `\u041F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u0435: +${config.defeat}`);

  const survivalValue = playerWon ? config.survived : 1;
  const survival = player.alive ? survivalValue : 0;
  total += survival;
  if (player.alive) {
    details.push(`\u0414\u043E\u0436\u0438\u043B \u0434\u043E \u043A\u043E\u043D\u0446\u0430: +${survivalValue}`);
  }

  let roleBonus = 0;
  const addBonus = (points: number, reason: string) => {
    roleBonus += points;
    total += points;
    details.push(`${reason}: ${points > 0 ? '+' : ''}${points}`);
  };

  switch (player.role) {
    case 'sheriff': {
      for (const check of state.sheriffChecks) {
        const target = state.players.find(p => p.seat === check.seat);
        if (target) {
          if (check.result === 'mafia' && target.team === 'mafia') {
            addBonus(2, `Нашел мафиози (${check.seat})`);
          } else if (check.result === 'civilian' && target.team === 'peaceful') {
            addBonus(1, `Верная проверка мирного (${check.seat})`);
          }
        }
      }
      for (const check of state.sheriffChecks) {
        if (check.result === 'mafia') {
          const target = state.players.find(p => p.seat === check.seat);
          if (target && target.team === 'mafia' && target.eliminatedBy === 'vote') {
            addBonus(3, `Мафиози изгнан голосованием (${check.seat})`);
          }
        }
      }
      const deathshotTarget = state.players.find(
        p => p.eliminatedBy === 'sheriffShot'
      );
      if (deathshotTarget) {
        if (deathshotTarget.team === 'mafia') {
          addBonus(5, 'Предсмертный выстрел по мафиози');
        } else {
          addBonus(-3, 'Предсмертный выстрел по мирному');
        }
      }
      if ((player.alive && state.dayNumber >= 3) || (player.eliminatedDay !== undefined && player.eliminatedDay >= 3)) {
        addBonus(1, 'Дожил до 3-го дня');
      }
      break;
    }
    case 'doctor': {
      for (const nr of nightResults) {
        for (const save of nr.saves) {
          if (save.savedBy === 'doctor') {
            if (save.seat === player.seat) {
              addBonus(4, '\u0421\u043F\u0430\u0441 \u0441\u0435\u0431\u044F');
            } else {
              addBonus(3, `\u0423\u0441\u043F\u0435\u0448\u043D\u043E\u0435 \u043B\u0435\u0447\u0435\u043D\u0438\u0435 (${save.seat})`);
            }
          }
        }
      }
      if ((player.alive && state.dayNumber >= 3) || (player.eliminatedDay !== undefined && player.eliminatedDay >= 3)) {
        addBonus(1, 'Дожил до 3-го дня');
      }
      break;
    }
    case 'hooker': {
      for (let i = 0; i < nightResults.length; i++) {
        const nr = nightResults[i];
        if (nr.blocked !== undefined) {
          const blockedPlayer = state.players.find(p => p.seat === nr.blocked);
          if (blockedPlayer) {
            if (blockedPlayer.role === 'don') {
              addBonus(4, `\u0417\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043B\u0430 \u0414\u043E\u043D\u0430 (\u043D\u043E\u0447\u044C ${i + 1})`);
            } else if (blockedPlayer.team === 'mafia') {
              addBonus(1, `\u0417\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043B\u0430 \u043C\u0430\u0444\u0438\u043E\u0437\u0438 (\u043D\u043E\u0447\u044C ${i + 1})`);
            } else if (blockedPlayer.role === 'maniac') {
              addBonus(2, `\u0417\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043B\u0430 \u041C\u0430\u043D\u044C\u044F\u043A\u0430 (\u043D\u043E\u0447\u044C ${i + 1})`);
            } else if (blockedPlayer.role !== 'civilian') {
              addBonus(-2, `\u0417\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043B\u0430 \u0441\u043F\u0435\u0446\u0440\u043E\u043B\u044C (\u043D\u043E\u0447\u044C ${i + 1})`);
            }
          }
        }
      }
      break;
    }
    case 'maniac': {
      for (const nr of nightResults) {
        for (const death of nr.deaths) {
          if (death.cause === 'maniac') {
            const target = state.players.find(p => p.seat === death.seat);
            if (target) {
              if (target.seat === player.seat) {
                addBonus(-2, 'Убил себя');
              } else if (target.role === 'don') {
                addBonus(5, `\u0423\u0431\u0438\u043B \u0414\u043E\u043D\u0430`);
              } else if (target.team === 'mafia') {
                addBonus(4, `\u0423\u0431\u0438\u043B \u043C\u0430\u0444\u0438\u043E\u0437\u0438 (${death.seat})`);
              } else if (target.role === 'werewolf' && state.werewolfActive) {
                addBonus(4, `\u0423\u0431\u0438\u043B \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u041E\u0431\u043E\u0440\u043E\u0442\u043D\u044F (${death.seat})`);
              } else if (target.role === 'werewolf') {
                addBonus(-3, `\u0423\u0431\u0438\u043B \u041E\u0431\u043E\u0440\u043E\u0442\u043D\u044F (${death.seat})`);
              } else if (target.role !== 'civilian') {
                addBonus(-4, `\u0423\u0431\u0438\u043B \u0441\u043F\u0435\u0446\u0440\u043E\u043B\u044C (${death.seat})`);
              } else {
                addBonus(-3, `\u0423\u0431\u0438\u043B \u043C\u0438\u0440\u043D\u043E\u0433\u043E (${death.seat})`);
              }
            }
          }
        }
      }
      break;
    }
    case 'bodyguard': {
      let tradeFired = false;
      for (const nr of nightResults) {
        for (const death of nr.deaths) {
          if (death.cause === 'bodyguardTrade' && death.seat === player.seat) {
            addBonus(5, '\u0421\u0440\u0430\u0431\u043E\u0442\u0430\u043B \u0440\u0430\u0437\u043C\u0435\u043D');
            tradeFired = true;
          }
        }
      }
      if (player.alive && !tradeFired) {
        addBonus(1, 'Дожил до конца (размен не сработал)');
      }
      break;
    }
    case 'seer': {
      for (const nr of nightResults) {
        if (nr.seerCompare) {
          if (nr.seerCompare.result === 'differentTeam') {
            addBonus(2, `\u041D\u0430\u0448\u0435\u043B \u0440\u0430\u0437\u043D\u044B\u0435 \u043A\u043E\u043C\u0430\u043D\u0434\u044B`);
          } else {
            const [s1, s2] = nr.seerCompare.seats;
            const p1 = state.players.find(p => p.seat === s1);
            const p2 = state.players.find(p => p.seat === s2);
            if (p1?.team === 'mafia' && p2?.team === 'mafia') {
              addBonus(3, `\u041D\u0430\u0448\u0435\u043B \u043E\u0434\u043D\u0443 \u043A\u043E\u043C\u0430\u043D\u0434\u0443 (\u043E\u0431\u0430 \u043C\u0430\u0444\u0438\u044F)`);
            } else {
              addBonus(2, `\u041D\u0430\u0448\u0435\u043B \u043E\u0434\u043D\u0443 \u043A\u043E\u043C\u0430\u043D\u0434\u0443`);
            }
          }
        }
      }
      break;
    }
    case 'werewolf': {
      if (state.werewolfActive) {
        addBonus(3, '\u0410\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043B\u0441\u044F');
      }
      for (const nr of nightResults) {
        for (const death of nr.deaths) {
          if (death.cause === 'werewolf') {
            addBonus(2, `\u0423\u0431\u0438\u043B \u043F\u043E\u0441\u043B\u0435 \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0438 (${death.seat})`);
          }
        }
      }
      if (winner === 'werewolf') {
        addBonus(8, '\u041F\u043E\u0431\u0435\u0434\u0438\u043B 1 \u043D\u0430 1');
      }
      if (state.werewolfActive && player.eliminatedBy === 'vote') {
        addBonus(1, 'Изгнан голосованием после активации');
      }
      break;
    }
    case 'don': {
      if (player.alive) {
        addBonus(3, '\u0414\u043E\u043D \u0434\u043E\u0436\u0438\u043B \u0434\u043E \u043A\u043E\u043D\u0446\u0430');
      }
      const killedSpecials = state.players.filter(
        p => !p.alive && (p.role === 'sheriff' || p.role === 'doctor') && p.eliminatedBy === 'mafia'
      );
      for (const ks of killedSpecials) {
        addBonus(2, `\u041C\u0430\u0444\u0438\u044F \u0443\u0431\u0438\u043B\u0430 ${ks.role === 'sheriff' ? '\u041A\u043E\u043C\u0438\u0441\u0441\u0430\u0440\u0430' : '\u0414\u043E\u043A\u0442\u043E\u0440\u0430'}`);
      }
      if (player.eliminatedBy === 'vote' && player.eliminatedDay === 1) {
        addBonus(-2, 'Изгнан голосованием в первый день');
      }
      break;
    }
    case 'framer': {
      const framedAndChecked = new Set<number>();
      for (const check of state.sheriffChecks) {
        const target = state.players.find(p => p.seat === check.seat);
        if (target && target.team !== 'mafia' && check.result === 'mafia') {
          addBonus(4, `Подстава сработала (${check.seat})`);
          framedAndChecked.add(check.seat);
        }
      }
      for (const vote of state.voteLog) {
        if (vote.eliminated !== undefined) {
          const eliminated = state.players.find(p => p.seat === vote.eliminated);
          if (eliminated && eliminated.team === 'peaceful' && framedAndChecked.has(eliminated.seat)) {
            addBonus(5, `Подставленный изгнан голосованием (${eliminated.seat})`);
          }
        }
      }
      if (player.alive) {
        addBonus(2, 'Дожил до конца игры');
      }
      break;
    }
    case 'enforcer': {
      if (state.enforcerUsed) {
        for (const nr of nightResults) {
          if (nr.enforcerResult?.effective) {
            for (const death of nr.deaths) {
              if (death.cause === 'mafia') {
                const target = state.players.find(p => p.seat === death.seat);
                if (target && target.role !== 'civilian') {
                  addBonus(4, `Убили спецроль (Громила)`);
                } else if (target && target.role === 'civilian') {
                  addBonus(2, 'Убили мирного жителя (Громила)');
                }
              }
            }
            break;
          }
        }
      } else {
        addBonus(-1, 'Способность не использована');
      }
      if (player.alive) {
        addBonus(2, 'Дожил до конца игры');
      }
      break;
    }
    case 'civilian': {
      for (const vote of state.voteLog) {
        if (vote.eliminated !== undefined) {
          const eliminated = state.players.find(p => p.seat === vote.eliminated);
          if (eliminated) {
            const playerVote = vote.votes[player.seat];
            if (playerVote === vote.eliminated) {
              if (eliminated.team === 'mafia') {
                addBonus(2, `\u0413\u043E\u043B\u043E\u0441\u043E\u0432\u0430\u043B \u0437\u0430 \u043C\u0430\u0444\u0438\u043E\u0437\u0438 (\u0434\u0435\u043D\u044C ${vote.day})`);
              } else {
                addBonus(-1, `\u0413\u043E\u043B\u043E\u0441\u043E\u0432\u0430\u043B \u0437\u0430 \u043C\u0438\u0440\u043D\u043E\u0433\u043E (\u0434\u0435\u043D\u044C ${vote.day})`);
              }
            }
          }
        }
      }
      if (player.alive) {
        addBonus(2, 'Дожил до конца игры');
      }
      break;
    }
    default: {
      if (player.role === 'mafia') {
        if (player.alive) {
          addBonus(2, 'Дожил до конца игры');
        }
        for (const nr of nightResults) {
          for (const death of nr.deaths) {
            if (death.cause === 'mafia') {
              const target = state.players.find(p => p.seat === death.seat);
              if (target && target.role !== 'civilian' && target.team === 'peaceful') {
                addBonus(1, `Мафия убила спецроль (${death.seat})`);
              }
            }
          }
        }
      }
      break;
    }
  }

  let penalties = 0;
  if (player.fouls >= 1) {
    penalties += config.foul1;
    details.push(`1-\u0439 \u0444\u043E\u043B: ${config.foul1}`);
  }
  if (player.fouls >= 2) {
    penalties += config.foul2;
    details.push(`2-\u0439 \u0444\u043E\u043B: ${config.foul2}`);
  }
  if (player.fouls >= 3 || player.eliminatedBy === 'techKill') {
    penalties += config.foul3TechKill;
    details.push(`3 \u0444\u043E\u043B\u0430 (\u0442\u0435\u0445.\u0442\u0440\u0443\u043F): ${config.foul3TechKill}`);
  }
  if (player.eliminatedBy === 'redCard') {
    penalties += config.redCard;
    details.push(`\u041A\u0440\u0430\u0441\u043D\u0430\u044F \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430: ${config.redCard}`);
  }

  const firstVote = state.voteLog.find(v => v.day === 1);
  if (firstVote?.eliminated === player.seat) {
    penalties += config.firstEliminatedDay1;
    details.push(`\u041F\u0435\u0440\u0432\u044B\u0439 \u0438\u0437\u0433\u043D\u0430\u043D\u043D\u044B\u0439 (\u0434\u0435\u043D\u044C 1): ${config.firstEliminatedDay1}`);
  }

  total += penalties;

  total = Math.max(total, -5);

  return {
    base,
    survival,
    roleBonus,
    penalties,
    total,
    details,
  };
}
