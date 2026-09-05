import type {
  Player,
  NightActions,
  NightResult,
  GameRole,
  DeathReason,
  CheckResult,
  CompareResult,
  GameState,
} from '@shared/types';
import { ROLE_META } from '@shared/types';

interface ResolverContext {
  players: Player[];
  actions: NightActions;
  state: GameState;
}

function getPlayer(players: Player[], seat: number): Player | undefined {
  return players.find(p => p.seat === seat);
}

function getAlivePlayerByRole(players: Player[], role: GameRole): Player | undefined {
  return players.find(p => p.alive && p.role === role);
}

function isBlocked(seat: number | undefined, courtesanTarget: number | undefined): boolean {
  return seat !== undefined && courtesanTarget !== undefined && seat === courtesanTarget;
}

function getRolePlayerSeat(players: Player[], role: GameRole): number | undefined {
  return getAlivePlayerByRole(players, role)?.seat;
}

export function resolveNight(ctx: ResolverContext): NightResult {
  const { players, actions, state } = ctx;
  const result: NightResult = {
    deaths: [],
    saves: [],
  };

  const blocked = actions.courtesanTarget;
  result.blocked = blocked;

  const deathSet = new Map<number, DeathReason>();
  const saveSet = new Set<number>();

  const donSeat = getRolePlayerSeat(players, 'don');
  const donBlocked = donSeat !== undefined && blocked === donSeat;

  const mafiaTargetIsWerewolf = actions.mafiaTarget !== undefined &&
    getPlayer(players, actions.mafiaTarget)?.role === 'werewolf';

  const enforcerSeat = getRolePlayerSeat(players, 'enforcer');
  const enforcerBlocked = isBlocked(enforcerSeat, blocked);
  const enforcerDeclared = actions.enforcerUsed === true;
  const enforcerEffective = enforcerDeclared && !donBlocked && !enforcerBlocked && !mafiaTargetIsWerewolf;

  if (enforcerDeclared) {
    result.enforcerResult = {
      declared: true,
      effective: enforcerEffective,
      abilityConsumed: enforcerEffective,
      reason: donBlocked ? 'don_blocked' : enforcerBlocked ? 'enforcer_blocked' : undefined,
    };
  }

  if (mafiaTargetIsWerewolf && actions.mafiaTarget !== undefined && !donBlocked) {
    result.werewolfImmune = actions.mafiaTarget;
  }

  if (actions.mafiaTarget !== undefined && !mafiaTargetIsWerewolf) {
    const mafiaTarget = actions.mafiaTarget;

    if (!donBlocked) {
      deathSet.set(mafiaTarget, 'mafia');
    }
  }

  let framerTarget: number | undefined;
  let framerExpiry: number | undefined;
  const framerSeat = getRolePlayerSeat(players, 'framer');
  if (actions.framerTarget !== undefined && framerSeat !== undefined) {
    if (!isBlocked(framerSeat, blocked)) {
      framerTarget = actions.framerTarget;
      framerExpiry = state.dayNumber + 2;
    }
  }

  if (actions.sheriffTarget !== undefined) {
    const sheriffSeat = getRolePlayerSeat(players, 'sheriff');
    if (sheriffSeat !== undefined && !isBlocked(sheriffSeat, blocked)) {
      const target = getPlayer(players, actions.sheriffTarget);
      if (target) {
        const actualTeam = ROLE_META[target.role].team;
        const isFramed = actualTeam !== 'mafia' && (
          (state.framerTarget === actions.sheriffTarget &&
            state.framerExpiry !== undefined &&
            state.framerExpiry > state.dayNumber) ||
          framerTarget === actions.sheriffTarget
        );

        let checkResult: CheckResult;
        if (target.role === 'werewolf' && state.werewolfActive) {
          checkResult = 'mafia';
        } else if (isFramed) {
          checkResult = 'mafia';
        } else {
          checkResult = actualTeam === 'mafia' ? 'mafia' : 'civilian';
        }

        result.sheriffCheck = {
          seat: actions.sheriffTarget,
          result: checkResult,
          isFramed: isFramed,
        };
      }
    }
  }

  if (actions.seerTargets) {
    const seerSeat = getRolePlayerSeat(players, 'seer');
    if (seerSeat !== undefined && !isBlocked(seerSeat, blocked)) {
      const [seat1, seat2] = actions.seerTargets;
      const p1 = getPlayer(players, seat1);
      const p2 = getPlayer(players, seat2);
      if (p1 && p2) {
        const team1 = (p1.role === 'werewolf' && state.werewolfActive) ? 'mafia' : ROLE_META[p1.role].team;
        const team2 = (p2.role === 'werewolf' && state.werewolfActive) ? 'mafia' : ROLE_META[p2.role].team;
        const compareResult: CompareResult = team1 === team2 ? 'sameTeam' : 'differentTeam';
        result.seerCompare = {
          seats: [seat1, seat2],
          result: compareResult,
        };
      }
    }
  }

  let doctorTarget: number | undefined;
  const doctorSeat = getRolePlayerSeat(players, 'doctor');
  if (actions.doctorTarget !== undefined && doctorSeat !== undefined) {
    if (!isBlocked(doctorSeat, blocked)) {
      doctorTarget = actions.doctorTarget;
    }
  }

  let bodyguardTarget: number | undefined;
  const bodyguardSeat = getRolePlayerSeat(players, 'bodyguard');
  if (actions.bodyguardTarget !== undefined && bodyguardSeat !== undefined) {
    if (!isBlocked(bodyguardSeat, blocked)) {
      bodyguardTarget = actions.bodyguardTarget;
    }
  }

  if (actions.maniacTarget !== undefined) {
    const maniacSeat = getRolePlayerSeat(players, 'maniac');
    if (maniacSeat !== undefined && !isBlocked(maniacSeat, blocked)) {
      deathSet.set(actions.maniacTarget, 'maniac');
    }
  }

  if (actions.werewolfTarget !== undefined && state.werewolfActive) {
    const werewolfSeat = getRolePlayerSeat(players, 'werewolf');
    if (werewolfSeat !== undefined && !isBlocked(werewolfSeat, blocked)) {
      deathSet.set(actions.werewolfTarget, 'werewolf');
    }
  }

  if (actions.mafiaTarget !== undefined && !donBlocked && !mafiaTargetIsWerewolf) {
    const mafiaTarget = actions.mafiaTarget;

    if (enforcerEffective) {
    } else {
      if (doctorTarget === mafiaTarget) {
        deathSet.delete(mafiaTarget);
        saveSet.add(mafiaTarget);
        result.saves.push({ seat: mafiaTarget, savedBy: 'doctor' });
      } else if (bodyguardTarget === mafiaTarget) {
        deathSet.delete(mafiaTarget);

        if (bodyguardSeat !== undefined) {
          deathSet.set(bodyguardSeat, 'bodyguardTrade');
        }

        const aliveMafia = players.filter(
          p => p.alive && p.team === 'mafia' && p.seat !== bodyguardSeat
        );
        if (aliveMafia.length > 0) {
          const regulars = aliveMafia.filter(p => p.role === 'mafia');
          const enforcerUsedUp = aliveMafia.filter(p => p.role === 'enforcer' && state.enforcerUsed);
          const donMafia = aliveMafia.filter(p => p.role === 'don');

          let pool: Player[];
          if (regulars.length > 0) {
            pool = regulars;
          } else if (enforcerUsedUp.length > 0) {
            pool = enforcerUsedUp;
          } else if (donMafia.length > 0) {
            pool = donMafia;
          } else {
            pool = aliveMafia;
          }
          const victim = pool[Math.floor(Math.random() * pool.length)];
          deathSet.set(victim.seat, 'bodyguardTrade');
        }

        const maniacSeatForOverlap = getRolePlayerSeat(players, 'maniac');
        const maniacAlsoTargets = actions.maniacTarget === mafiaTarget &&
          maniacSeatForOverlap !== undefined && !isBlocked(maniacSeatForOverlap, blocked);
        const werewolfSeatForOverlap = getRolePlayerSeat(players, 'werewolf');
        const werewolfAlsoTargets = actions.werewolfTarget === mafiaTarget && state.werewolfActive &&
          werewolfSeatForOverlap !== undefined && !isBlocked(werewolfSeatForOverlap, blocked);

        if (maniacAlsoTargets) {
          deathSet.set(mafiaTarget, 'maniac');
        } else if (werewolfAlsoTargets) {
          deathSet.set(mafiaTarget, 'werewolf');
        } else {
          saveSet.add(mafiaTarget);
          result.saves.push({ seat: mafiaTarget, savedBy: 'bodyguard' });
        }
      }
    }
  }

  if (actions.maniacTarget !== undefined && deathSet.has(actions.maniacTarget)) {
    const cause = deathSet.get(actions.maniacTarget);
    if (cause === 'maniac') {
      if (doctorTarget === actions.maniacTarget) {
        deathSet.delete(actions.maniacTarget);
        if (!saveSet.has(actions.maniacTarget)) {
          saveSet.add(actions.maniacTarget);
          result.saves.push({ seat: actions.maniacTarget, savedBy: 'doctor' });
        }
      }
    }
  }

  if (actions.werewolfTarget !== undefined && state.werewolfActive && deathSet.has(actions.werewolfTarget)) {
    const cause = deathSet.get(actions.werewolfTarget);
    if (cause === 'werewolf') {
      if (doctorTarget === actions.werewolfTarget) {
        deathSet.delete(actions.werewolfTarget);
        if (!saveSet.has(actions.werewolfTarget)) {
          saveSet.add(actions.werewolfTarget);
          result.saves.push({ seat: actions.werewolfTarget, savedBy: 'doctor' });
        }
      } else if (bodyguardTarget === actions.werewolfTarget && !saveSet.has(actions.werewolfTarget)) {
        if (bodyguardSeat !== undefined && !deathSet.has(bodyguardSeat)) {
          deathSet.delete(actions.werewolfTarget);
          saveSet.add(actions.werewolfTarget);
          deathSet.set(bodyguardSeat, 'bodyguardTrade');
          const werewolfSeatTrade = getRolePlayerSeat(players, 'werewolf');
          if (werewolfSeatTrade !== undefined) {
            deathSet.set(werewolfSeatTrade, 'bodyguardTrade');
          }
          result.saves.push({ seat: actions.werewolfTarget, savedBy: 'bodyguard' });
        }
      }
    }
  }

  result.deaths = Array.from(deathSet.entries()).map(([seat, cause]) => ({ seat, cause }));

  const mafiaAliveAfter = players.filter(p => {
    if (!p.alive) return false;
    if (deathSet.has(p.seat)) return false;
    return p.team === 'mafia';
  });

  const werewolfPlayer = players.find(p => p.role === 'werewolf' && p.alive && !deathSet.has(p.seat));
  if (mafiaAliveAfter.length === 0 && werewolfPlayer && !state.werewolfActive) {
    result.werewolfActivated = true;
  }

  return result;
}

export function applyNightResult(
  players: Player[],
  result: NightResult,
  nightNumber: number
): Player[] {
  return players.map(p => {
    const death = result.deaths.find(d => d.seat === p.seat);
    if (death) {
      return {
        ...p,
        alive: false,
        eliminatedBy: death.cause,
        eliminatedNight: nightNumber,
      };
    }
    return p;
  });
}
