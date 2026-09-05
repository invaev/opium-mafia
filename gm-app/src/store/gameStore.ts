import { create } from 'zustand';
import type {
  Player,
  GameState,
  GamePhase,
  GameRole,
  NightActions,
  NightResult,
  DeathReason,
  CheckResult,
} from '@shared/types';
import {
  ROLE_DISTRIBUTION,
  ROLE_META,
  NIGHT_STEPS,
} from '@shared/types';
import { resolveNight, applyNightResult } from '../engine/nightResolver';
import { checkVictory } from '../engine/victoryChecker';
import { calculateRating, DEFAULT_RATING_CONFIG } from '../engine/ratingCalculator';
import { saveGameState, loadGameState, finishGame } from '../api';
import type { GameRatingBreakdown } from '@shared/types';
import type { ScreenId } from '../theme';
import { logger } from '../utils/logger';

const SEAT_COLORS: Array<[string, string]> = [
  ['#3B82F6', '#8B5CF6'],
  ['#EC4899', '#F59E0B'],
  ['#EF4444', '#DC2626'],
  ['#06B6D4', '#3B82F6'],
  ['#64748B', '#1E293B'],
  ['#6366F1', '#1E1B4B'],
  ['#F59E0B', '#DC2626'],
  ['#EF4444', '#F59E0B'],
  ['#22C55E', '#059669'],
  ['#F59E0B', '#EC4899'],
  ['#0EA5E9', '#6366F1'],
  ['#A855F7', '#EC4899'],
  ['#F97316', '#EF4444'],
  ['#EAB308', '#D97706'],
  ['#14B8A6', '#06B6D4'],
  ['#8B5CF6', '#6366F1'],
  ['#EC4899', '#A855F7'],
  ['#F59E0B', '#EAB308'],
  ['#EF4444', '#EC4899'],
  ['#22C55E', '#06B6D4'],
];

interface NightPhaseState {
  currentStep: number;
  actions: NightActions;
  passed: Record<number, boolean>;
  result: NightResult | null;
}

export interface GameStore {
  screen: ScreenId;
  setScreen: (screen: ScreenId) => void;
  selectedGameId: number | null;
  setSelectedGameId: (id: number | null) => void;

  game: GameState | null;
  nightPhase: NightPhaseState;
  nightResults: NightResult[];
  ratings: Map<number, GameRatingBreakdown>;

  roleMode: 'auto' | 'manual';
  rolesDealt: boolean;
  confirmedSeats: Set<number>;

  nominees: number[];
  currentDefenseIndex: number;
  votes: Record<number, number>;
  eliminatedThisVote: number | null;
  isRevote: boolean;
  revoteCandidates: number[];
  lastWordSeat: number | null;

  rolesHidden: boolean;
  toggleRolesHidden: () => void;

  timerSeconds: number;
  timerRunning: boolean;
  timerInterval: ReturnType<typeof setInterval> | null;

  loadServerGame: (serverGame: { id: number; title: string; spots: number; place: string; rated: boolean; players: Array<{ name: string; nick?: string; seat?: number; userId: number | null }> }) => void;
  createGame: (name: string, playerCount: number, location: string, isRanked: boolean) => void;
  setRoleMode: (mode: 'auto' | 'manual') => void;
  dealRoles: () => void;
  redealRoles: () => void;
  assignRole: (seat: number, role: GameRole) => void;
  removePlayer: (seat: number) => void;
  reorderPlayers: (seatOrder: number[]) => void;

  startNight0: () => void;
  startNight: () => void;
  startDayAnnounce: () => void;
  startOpium: () => void;
  startDefense: () => void;
  startVoting: () => void;
  startLastWord: (seat: number) => void;
  endGame: () => void;

  setNightStep: (step: number) => void;
  recordNightAction: (step: number, target: number | 'pass') => void;
  setEnforcerUsed: (used: boolean) => void;
  setSeerSecondTarget: (seat: number) => void;
  resolveCurrentNight: () => void;

  nominate: (seat: number) => void;
  removeNominee: (seat: number) => void;
  setDefenseIndex: (index: number) => void;
  recordVote: (voterSeat: number, candidateSeat: number) => void;
  clearVote: (voterSeat: number) => void;
  resolveVoting: () => 'eliminated' | 'tie' | 'doubleTie';
  confirmElimination: () => void;
  startRevote: () => void;

  addFoul: (seat: number) => void;
  redCard: (seat: number) => void;
  techKill: (seat: number) => void;

  sheriffDeathshot: (targetSeat: number) => void;

  startTimer: (seconds: number) => void;
  pauseTimer: () => void;
  resetTimer: (seconds: number) => void;

  calculateAllRatings: () => void;

  persistToServer: () => void;
  restoreFromServer: (gameId: number) => Promise<boolean>;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateId(): number {
  return Date.now();
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'dashboard',
  selectedGameId: null,
  setSelectedGameId: (id) => set({ selectedGameId: id }),
  game: null,
  nightPhase: {
    currentStep: 0,
    actions: { enforcerUsed: false },
    passed: {},
    result: null,
  },
  nightResults: [],
  ratings: new Map(),
  roleMode: 'auto',
  rolesDealt: false,
  confirmedSeats: new Set(),
  nominees: [],
  currentDefenseIndex: 0,
  votes: {},
  eliminatedThisVote: null,
  isRevote: false,
  revoteCandidates: [],
  lastWordSeat: null,
  rolesHidden: false,
  toggleRolesHidden: () => set((s) => ({ rolesHidden: !s.rolesHidden })),
  timerSeconds: 0,
  timerRunning: false,
  timerInterval: null,

  setScreen: (screen) => set({ screen }),

  loadServerGame: (sg) => {
    const sorted = [...sg.players].sort((a, b) => (a.seat || 0) - (b.seat || 0));
    const players: Player[] = sorted.map((p, i) => ({
      seat: p.seat || i + 1,
      name: p.name || `Игрок ${i + 1}`,
      nick: p.nick || '',
      userId: p.userId != null ? String(p.userId) : undefined,
      role: 'civilian' as GameRole,
      team: 'peaceful' as const,
      alive: true,
      fouls: 0,
      avatar: { emoji: '', colors: SEAT_COLORS[i] || SEAT_COLORS[0] },
    }));

    const game: GameState = {
      id: sg.id,
      name: sg.title,
      playerCount: players.length,
      dayNumber: 0,
      phase: 'lobby',
      players,
      nightLog: [],
      voteLog: [],
      foulLog: [],
      enforcerUsed: false,
      werewolfActive: false,
      sheriffChecks: [],
      doctorConsecutiveCount: 0,
      nominees: [],
      isRanked: sg.rated,
    };

    set({
      game,
      rolesDealt: false,
      confirmedSeats: new Set(),
      nominees: [],
      votes: {},
      nightResults: [],
      ratings: new Map(),
      screen: 'lobby',
    });
  },

  createGame: (name, playerCount, location, isRanked) => {
    const count = Math.max(10, Math.min(20, playerCount));
    const players: Player[] = Array.from({ length: count }, (_, i) => ({
      seat: i + 1,
      name: `Игрок ${i + 1}`,
      nick: '',
      role: 'civilian' as GameRole,
      team: 'peaceful' as const,
      alive: true,
      fouls: 0,
      avatar: { emoji: '', colors: SEAT_COLORS[i] || SEAT_COLORS[0] },
    }));

    const game: GameState = {
      id: generateId(),
      name,
      playerCount: count,
      dayNumber: 0,
      phase: 'lobby',
      players,
      nightLog: [],
      voteLog: [],
      foulLog: [],
      enforcerUsed: false,
      werewolfActive: false,
      sheriffChecks: [],
      doctorConsecutiveCount: 0,
      nominees: [],
      isRanked,
    };

    set({
      game,
      rolesDealt: false,
      confirmedSeats: new Set(),
      nominees: [],
      votes: {},
      nightResults: [],
      ratings: new Map(),
      screen: 'lobby',
    });
  },

  setRoleMode: (mode) => set({ roleMode: mode }),

  dealRoles: () => {
    const { game } = get();
    if (!game) return;

    const dist = ROLE_DISTRIBUTION[game.playerCount];
    if (!dist) return;

    const fullPool: GameRole[] = [];
    for (const [role, count] of Object.entries(dist)) {
      for (let i = 0; i < count; i++) {
        fullPool.push(role as GameRole);
      }
    }

    const availablePool = [...fullPool];
    for (const p of game.players) {
      if (p.role !== 'civilian') {
        const idx = availablePool.indexOf(p.role);
        if (idx !== -1) availablePool.splice(idx, 1);
      }
    }

    const shuffled = shuffle(availablePool);

    let shuffleIdx = 0;
    const players = game.players.map(p => {
      if (p.role !== 'civilian') {
        return { ...p, team: ROLE_META[p.role].team };
      }
      const role = shuffled[shuffleIdx++] || 'civilian';
      return { ...p, role, team: ROLE_META[role].team };
    });

    const allSeats = new Set(players.map(p => p.seat));
    set({
      game: { ...game, players },
      rolesDealt: true,
      confirmedSeats: allSeats,
    });
  },

  redealRoles: () => {
    const { game } = get();
    if (!game) return;
    const resetPlayers = game.players.map(p => ({
      ...p,
      role: 'civilian' as GameRole,
      team: 'peaceful' as const,
    }));
    set({
      game: { ...game, players: resetPlayers },
      rolesDealt: false,
      confirmedSeats: new Set(),
    });
  },

  assignRole: (seat, role) => {
    const { game, confirmedSeats } = get();
    if (!game) return;
    const players = game.players.map(p =>
      p.seat === seat
        ? { ...p, role, team: ROLE_META[role].team }
        : p
    );
    const newConfirmed = new Set(confirmedSeats);
    if (role === 'civilian') {
      newConfirmed.delete(seat);
    } else {
      newConfirmed.add(seat);
    }
    set({ game: { ...game, players }, confirmedSeats: newConfirmed });
  },

  removePlayer: (seat) => {
    const { game } = get();
    if (!game) return;
    const players = game.players.filter(p => p.seat !== seat);
    const renumbered = players.map((p, i) => ({
      ...p,
      seat: i + 1,
      role: 'civilian' as GameRole,
      team: 'peaceful' as const,
    }));
    set({
      game: {
        ...game,
        players: renumbered,
        playerCount: renumbered.length,
      },
      rolesDealt: false,
      confirmedSeats: new Set(),
    });
  },

  reorderPlayers: (seatOrder) => {
    const { game } = get();
    if (!game) return;
    const byOldSeat = new Map(game.players.map(p => [p.seat, p]));
    const reordered = seatOrder.map((oldSeat, i) => ({
      ...byOldSeat.get(oldSeat)!,
      seat: i + 1,
    }));
    set({
      game: { ...game, players: reordered },
      rolesDealt: false,
      confirmedSeats: new Set(),
    });
  },

  startNight0: () => {
    const { game } = get();
    if (!game) return;
    logger.info('GAME', `Night 0 started`, { gameId: game.id, players: game.players.length });
    set({
      game: { ...game, phase: 'night0', dayNumber: 0 },
      screen: 'night0',
    });
    setTimeout(() => get().persistToServer(), 100);
  },

  startNight: () => {
    const { game } = get();
    if (!game) return;
    const nightNum = game.dayNumber + 1;
    logger.info('GAME', `Night ${nightNum} started`, { gameId: game.id, alive: game.players.filter(p => p.alive).length });

    set({
      game: { ...game, phase: 'night', dayNumber: nightNum },
      nightPhase: {
        currentStep: 0,
        actions: { enforcerUsed: false },
        passed: {},
        result: null,
      },
      screen: 'nightPhase',
    });
    setTimeout(() => get().persistToServer(), 100);
  },

  startDayAnnounce: () => {
    const { game } = get();
    if (!game) return;
    const dayNumber = game.dayNumber === 0 ? 1 : game.dayNumber;
    logger.info('GAME', `Day ${dayNumber} announce`, { gameId: game.id, alive: game.players.filter(p => p.alive).length });
    set({
      game: { ...game, phase: 'announce', dayNumber },
      screen: 'dayAnnounce',
    });
    setTimeout(() => get().persistToServer(), 100);
  },

  startOpium: () => {
    const { game } = get();
    if (!game) return;
    set({
      game: { ...game, phase: 'opium', nominees: [] },
      nominees: [],
      votes: {},
      eliminatedThisVote: null,
      isRevote: false,
      revoteCandidates: [],
      screen: 'dayOpium',
    });
    setTimeout(() => get().persistToServer(), 100);
  },

  startDefense: () => {
    const { game } = get();
    if (!game) return;
    set({
      game: { ...game, phase: 'defense' },
      currentDefenseIndex: 0,
      screen: 'dayDefense',
    });
    setTimeout(() => get().persistToServer(), 100);
  },

  startVoting: () => {
    const { game } = get();
    if (!game) return;
    set({
      game: { ...game, phase: 'voting' },
      votes: {},
      eliminatedThisVote: null,
      isRevote: false,
      revoteCandidates: [],
      screen: 'voting',
    });
    setTimeout(() => get().persistToServer(), 100);
  },

  startLastWord: (seat) => {
    const { game } = get();
    if (!game) return;
    set({
      game: { ...game, phase: 'lastWord' },
      lastWordSeat: seat,
      screen: 'lastWord',
    });
    setTimeout(() => get().persistToServer(), 100);
  },

  endGame: () => {
    const { game } = get();
    if (!game) return;
    logger.info('GAME', `Game ended`, { gameId: game.id, winner: game.winner, day: game.dayNumber, alive: game.players.filter(p => p.alive).length, isRanked: game.isRanked });
    set({
      game: { ...game, phase: 'end' },
      screen: 'gameEnd',
    });
    if (game.isRanked) {
      get().calculateAllRatings();
    }

    const winner = game.winner || 'peaceful';
    const playersData = game.players.map(p => ({
      seat: p.seat,
      userId: p.userId ? Number(p.userId) : undefined,
      role: p.role,
      team: p.team,
      alive: p.alive,
      fouls: p.fouls,
      deathReason: p.eliminatedBy,
      deathDay: p.eliminatedDay,
    }));
    finishGame(game.id, {
      winner,
      gameLog: { nightLog: game.nightLog, voteLog: game.voteLog, foulLog: game.foulLog },
      players: playersData,
    }).catch(err => console.error('Failed to finish game on server:', err));
  },

  setNightStep: (step) => {
    set(s => ({
      nightPhase: { ...s.nightPhase, currentStep: step },
    }));
  },

  recordNightAction: (step, target) => {
    const { game, nightPhase } = get();
    if (!game) return;

    const activeSteps = getActiveNightSteps(game);
    const nightStep = activeSteps[step];
    if (!nightStep) return;

    const actions = { ...nightPhase.actions };
    const passed = { ...nightPhase.passed };

    if (target === 'pass') {
      passed[step] = true;
    } else {
      switch (nightStep.role) {
        case 'hooker':
          actions.courtesanTarget = target;
          break;
        case 'don':
          actions.mafiaTarget = target;
          break;
        case 'framer':
          actions.framerTarget = target;
          break;
        case 'sheriff':
          actions.sheriffTarget = target;
          break;
        case 'seer':
          if (!actions.seerTargets) {
            actions.seerTargets = [target, 0];
          } else {
            actions.seerTargets = [actions.seerTargets[0], target];
          }
          break;
        case 'doctor':
          actions.doctorTarget = target;
          break;
        case 'bodyguard':
          actions.bodyguardTarget = target;
          break;
        case 'maniac':
          actions.maniacTarget = target;
          break;
        case 'werewolf':
          actions.werewolfTarget = target;
          break;
      }
    }

    set({
      nightPhase: { ...nightPhase, actions, passed },
    });
  },

  setEnforcerUsed: (used) => {
    set(s => ({
      nightPhase: {
        ...s.nightPhase,
        actions: { ...s.nightPhase.actions, enforcerUsed: used },
      },
    }));
  },

  setSeerSecondTarget: (seat) => {
    set(s => {
      const current = s.nightPhase.actions.seerTargets;
      return {
        nightPhase: {
          ...s.nightPhase,
          actions: {
            ...s.nightPhase.actions,
            seerTargets: current ? [current[0], seat] : [seat, 0],
          },
        },
      };
    });
  },

  resolveCurrentNight: () => {
    const { game, nightPhase, nightResults } = get();
    if (!game) return;
    logger.info('NIGHT', `Resolving night ${game.dayNumber}`, { gameId: game.id, actions: nightPhase.actions });

    const result = resolveNight({
      players: game.players,
      actions: nightPhase.actions,
      state: game,
    });

    const updatedPlayers = applyNightResult(game.players, result, game.dayNumber);

    let framerTarget = game.framerTarget;
    let framerExpiry = game.framerExpiry;
    if (nightPhase.actions.framerTarget !== undefined) {
      framerTarget = nightPhase.actions.framerTarget;
      framerExpiry = game.dayNumber + 2;
    }
    if (framerExpiry !== undefined && framerExpiry <= game.dayNumber) {
      framerTarget = undefined;
      framerExpiry = undefined;
    }

    const sheriffChecks = [...game.sheriffChecks];
    if (result.sheriffCheck) {
      sheriffChecks.push({
        seat: result.sheriffCheck.seat,
        result: result.sheriffCheck.result,
      });
    }

    const enforcerUsed = game.enforcerUsed || (result.enforcerResult?.abilityConsumed ?? false);

    const werewolfActive = game.werewolfActive || (result.werewolfActivated ?? false);

    const previousCourtesanTarget = nightPhase.actions.courtesanTarget;
    const previousBodyguardTarget = nightPhase.actions.bodyguardTarget;

    const doctorTarget = nightPhase.actions.doctorTarget;
    let doctorLastTarget: number | undefined;
    let doctorConsecutiveCount: number;
    if (doctorTarget === undefined) {
      doctorLastTarget = undefined;
      doctorConsecutiveCount = 0;
    } else if (doctorTarget === game.doctorLastTarget) {
      doctorLastTarget = doctorTarget;
      doctorConsecutiveCount = game.doctorConsecutiveCount + 1;
    } else {
      doctorLastTarget = doctorTarget;
      doctorConsecutiveCount = 1;
    }

    const nightLog = [...game.nightLog, nightPhase.actions];

    set({
      game: {
        ...game,
        players: updatedPlayers,
        nightLog,
        sheriffChecks,
        framerTarget,
        framerExpiry,
        enforcerUsed,
        werewolfActive,
        previousCourtesanTarget,
        previousBodyguardTarget,
        doctorLastTarget,
        doctorConsecutiveCount,
      },
      nightPhase: { ...nightPhase, result },
      nightResults: [...nightResults, result],
    });

    const victory = checkVictory(updatedPlayers, werewolfActive);
    if (victory.winner) {
      set(s => ({
        game: s.game ? { ...s.game, winner: victory.winner! as 'peaceful' | 'mafia' | 'werewolf' } : null,
      }));
    }
    setTimeout(() => get().persistToServer(), 100);
  },

  nominate: (seat) => {
    const { nominees } = get();
    if (nominees.length >= 3 || nominees.includes(seat)) return;
    set({
      nominees: [...nominees, seat],
    });
    setTimeout(() => get().persistToServer(), 100);
  },

  removeNominee: (seat) => {
    set(s => ({
      nominees: s.nominees.filter(n => n !== seat),
    }));
  },

  setDefenseIndex: (index) => set({ currentDefenseIndex: index }),

  recordVote: (voterSeat, candidateSeat) => {
    const { isRevote, revoteCandidates } = get();
    if (isRevote && revoteCandidates.length > 0 && !revoteCandidates.includes(candidateSeat)) {
      return;
    }
    set(s => ({
      votes: { ...s.votes, [voterSeat]: candidateSeat },
    }));
    setTimeout(() => get().persistToServer(), 100);
  },

  clearVote: (voterSeat) => {
    set(s => {
      const votes = { ...s.votes };
      delete votes[voterSeat];
      return { votes };
    });
  },

  resolveVoting: () => {
    const { game, votes, isRevote } = get();
    if (!game) return 'tie';
    logger.info('VOTE', `Resolving votes`, { gameId: game.id, day: game.dayNumber, isRevote, voteCount: Object.keys(votes).length });

    const aliveSeats = new Set(game.players.filter(p => p.alive).map(p => p.seat));
    const counts: Record<number, number> = {};
    for (const seat of aliveSeats) {
      counts[seat] = 0;
    }
    for (const [voterSeatStr, candidateSeat] of Object.entries(votes)) {
      const voterSeat = Number(voterSeatStr);
      if (candidateSeat !== undefined && counts[candidateSeat] !== undefined && aliveSeats.has(voterSeat)) {
        counts[candidateSeat]++;
      }
    }

    const voted = Object.entries(counts).filter(([, v]) => v > 0);
    if (voted.length === 0) return 'doubleTie';

    const maxVotes = Math.max(...voted.map(([, v]) => v));
    const leaders = voted
      .filter(([, v]) => v === maxVotes)
      .map(([k]) => Number(k));

    if (leaders.length === 1) {
      const eliminated = leaders[0];
      logger.info('VOTE', `Player eliminated by vote`, { gameId: game.id, seat: eliminated, day: game.dayNumber, votes: maxVotes });
      set({ eliminatedThisVote: eliminated });

      const voteLog = [
        ...game.voteLog,
        {
          day: game.dayNumber,
          candidates: leaders,
          votes: { ...votes },
          eliminated,
        },
      ];

      const players = game.players.map(p =>
        p.seat === eliminated
          ? { ...p, alive: false, eliminatedBy: 'vote' as DeathReason, eliminatedDay: game.dayNumber }
          : p
      );

      set({ game: { ...game, players, voteLog } });

      const victory = checkVictory(players, game.werewolfActive);
      if (victory.winner) {
        set(s => ({
          game: s.game ? { ...s.game, winner: victory.winner! as 'peaceful' | 'mafia' | 'werewolf' } : null,
        }));
      } else if (victory.werewolfActivated) {
        set(s => ({
          game: s.game ? { ...s.game, werewolfActive: true } : null,
        }));
      }

      return 'eliminated';
    } else if (!isRevote) {
      return 'tie';
    } else {
      const voteLog = [
        ...game.voteLog,
        {
          day: game.dayNumber,
          candidates: leaders,
          votes: { ...votes },
        },
      ];
      set({ game: { ...game, voteLog } });
      return 'doubleTie';
    }
  },

  confirmElimination: () => {
    const { eliminatedThisVote } = get();
    if (eliminatedThisVote !== null) {
      get().startLastWord(eliminatedThisVote);
    }
    setTimeout(() => get().persistToServer(), 100);
  },

  startRevote: () => {
    const { game, votes } = get();
    if (!game) return;
    const counts: Record<number, number> = {};
    for (const p of game.players.filter(p => p.alive)) counts[p.seat] = 0;
    for (const cand of Object.values(votes)) {
      if (cand !== undefined && counts[cand] !== undefined) counts[cand]++;
    }
    const maxV = Math.max(...Object.values(counts));
    const leaders = Object.entries(counts)
      .filter(([, v]) => v === maxV)
      .map(([k]) => Number(k));

    set({
      nominees: leaders,
      revoteCandidates: leaders,
      votes: {},
      isRevote: true,
      screen: 'voting',
    });
  },

  addFoul: (seat) => {
    const { game } = get();
    if (!game) return;
    const player = game.players.find(p => p.seat === seat);
    logger.info('FOUL', `Foul added`, { gameId: game.id, seat, currentFouls: player?.fouls || 0, day: game.dayNumber });

    const players = game.players.map(p => {
      if (p.seat === seat && p.alive) {
        const newFouls = p.fouls + 1;
        return { ...p, fouls: newFouls };
      }
      return p;
    });

    const foulLog = [
      ...game.foulLog,
      { seat, day: game.dayNumber, phase: game.phase },
    ];

    set({ game: { ...game, players, foulLog } });
    setTimeout(() => get().persistToServer(), 100);
  },

  techKill: (seat) => {
    const { game } = get();
    if (!game) return;
    const target = game.players.find(p => p.seat === seat);
    if (!target || !target.alive) return;
    logger.info('KILL', `Tech kill (3 fouls)`, { gameId: game.id, seat, role: target.role, day: game.dayNumber });

    const players = game.players.map(p =>
      p.seat === seat
        ? { ...p, alive: false, fouls: 3, eliminatedBy: 'techKill' as DeathReason, eliminatedDay: game.dayNumber }
        : p
    );

    set({ game: { ...game, players } });

    const victory = checkVictory(players, game.werewolfActive);
    if (victory.winner) {
      set(s => ({
        game: s.game ? { ...s.game, winner: victory.winner! as 'peaceful' | 'mafia' | 'werewolf' } : null,
      }));
    } else if (victory.werewolfActivated) {
      set(s => ({
        game: s.game ? { ...s.game, werewolfActive: true } : null,
      }));
    }

    setTimeout(() => get().persistToServer(), 100);
    if (!get().game?.winner) {
      get().startLastWord(seat);
    }
  },

  redCard: (seat) => {
    const { game } = get();
    if (!game) return;
    const target = game.players.find(p => p.seat === seat);
    if (!target || !target.alive) return;
    logger.info('KILL', `Red card issued`, { gameId: game.id, seat, role: target.role, day: game.dayNumber });

    const players = game.players.map(p =>
      p.seat === seat
        ? { ...p, alive: false, eliminatedBy: 'redCard' as DeathReason, eliminatedDay: game.dayNumber }
        : p
    );

    set({ game: { ...game, players } });

    const victory = checkVictory(players, game.werewolfActive);
    if (victory.winner) {
      set(s => ({
        game: s.game ? { ...s.game, winner: victory.winner! as 'peaceful' | 'mafia' | 'werewolf' } : null,
      }));
    } else if (victory.werewolfActivated) {
      set(s => ({
        game: s.game ? { ...s.game, werewolfActive: true } : null,
      }));
    }
    setTimeout(() => get().persistToServer(), 100);
  },

  sheriffDeathshot: (targetSeat) => {
    const { game } = get();
    if (!game) return;
    const target = game.players.find(p => p.seat === targetSeat);
    if (!target || !target.alive) return;
    logger.info('KILL', `Sheriff deathshot`, { gameId: game.id, seat: targetSeat, targetRole: target.role, day: game.dayNumber });

    const players = game.players.map(p =>
      p.seat === targetSeat
        ? { ...p, alive: false, eliminatedBy: 'sheriffShot' as DeathReason, eliminatedDay: game.dayNumber }
        : p
    );

    set({ game: { ...game, players } });

    const victory = checkVictory(players, game.werewolfActive);
    if (victory.winner) {
      set(s => ({
        game: s.game ? { ...s.game, winner: victory.winner! as 'peaceful' | 'mafia' | 'werewolf' } : null,
      }));
    } else if (victory.werewolfActivated) {
      set(s => ({
        game: s.game ? { ...s.game, werewolfActive: true } : null,
      }));
    }
    setTimeout(() => get().persistToServer(), 100);
  },

  startTimer: (seconds) => {
    const { timerInterval } = get();
    if (timerInterval) clearInterval(timerInterval);

    const interval = setInterval(() => {
      const { timerSeconds } = get();
      if (timerSeconds <= 1) {
        clearInterval(interval);
        set({ timerSeconds: 0, timerRunning: false, timerInterval: null });
      } else {
        set({ timerSeconds: timerSeconds - 1 });
      }
    }, 1000);

    set({ timerSeconds: seconds, timerRunning: true, timerInterval: interval });
  },

  pauseTimer: () => {
    const { timerInterval } = get();
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    set({ timerRunning: false, timerInterval: null });
  },

  resetTimer: (seconds) => {
    const { timerInterval } = get();
    if (timerInterval) clearInterval(timerInterval);
    set({ timerSeconds: seconds, timerRunning: false, timerInterval: null });
  },

  calculateAllRatings: () => {
    const { game, nightResults } = get();
    if (!game) return;

    const ratings = new Map<number, GameRatingBreakdown>();
    for (const player of game.players) {
      const breakdown = calculateRating(player, game, nightResults, DEFAULT_RATING_CONFIG);
      ratings.set(player.seat, breakdown);
    }

    set({ ratings });
  },

  persistToServer: () => {
    const { game, nightPhase, nightResults, screen, nominees, votes, timerSeconds, roleMode, rolesDealt, confirmedSeats, ratings } = get();
    if (!game || game.phase === 'lobby') return;

    const state: Record<string, unknown> = {
      screen,
      game,
      nightPhase: {
        currentStep: nightPhase.currentStep,
        actions: nightPhase.actions,
        passed: nightPhase.passed,
      },
      nightResults,
      nominees,
      votes,
      timerSeconds,
      roleMode,
      rolesDealt,
      confirmedSeats: Array.from(confirmedSeats),
      ratings: Array.from(ratings.entries()),
    };

    saveGameState(game.id, state).then(() => {
      logger.debug('SYNC', `State persisted to server`, { gameId: game.id, phase: game.phase, day: game.dayNumber });
    }).catch(err => {
      logger.error('SYNC', `Failed to persist state`, { gameId: game.id, error: String(err) });
      setTimeout(() => {
        saveGameState(game.id, state).then(() => {
          logger.info('SYNC', `Persist retry succeeded`, { gameId: game.id });
        }).catch(retryErr => {
          logger.error('SYNC', `Persist retry also failed`, { gameId: game.id, error: String(retryErr) });
        });
      }, 2000);
    });
  },

  restoreFromServer: async (gameId: number) => {
    try {
      const result = await loadGameState(gameId);
      if (!result.found || !result.state) return false;

      const s = result.state as any;
      if (!s.game) return false;

      set({
        game: s.game,
        screen: s.screen || 'lobby',
        nightPhase: s.nightPhase ? {
          ...s.nightPhase,
          result: null,
        } : get().nightPhase,
        nightResults: s.nightResults || [],
        nominees: s.nominees || [],
        votes: s.votes || {},
        timerSeconds: s.timerSeconds || 0,
        timerRunning: false,
        timerInterval: null,
        roleMode: s.roleMode || 'auto',
        rolesDealt: s.rolesDealt || false,
        confirmedSeats: new Set(s.confirmedSeats || []),
        ratings: new Map(s.ratings || []),
      });
      return true;
    } catch (err) {
      console.error('Failed to restore state:', err);
      return false;
    }
  },
}));

export function getActiveNightSteps(game: GameState) {
  return NIGHT_STEPS.filter(ns => {
    if (ns.isGroup) {
      return game.players.some(p => p.alive && p.team === 'mafia');
    }
    if (ns.role === 'werewolf') {
      return game.werewolfActive && game.players.some(p => p.alive && p.role === 'werewolf');
    }
    if (ns.role === 'framer') {
      const framerAlive = game.players.some(p => p.alive && p.role === 'framer');
      if (!framerAlive) return false;
      if (game.dayNumber % 2 !== 0) return false;
      const mafiaAlive = game.players.filter(p => p.alive && p.team === 'mafia');
      if (mafiaAlive.length === 1 && mafiaAlive[0].role === 'framer') return false;
      return true;
    }
    return game.players.some(p => p.alive && p.role === ns.role);
  });
}
