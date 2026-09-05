export type GameRole =
  | 'don'
  | 'mafia'
  | 'framer'
  | 'enforcer'
  | 'sheriff'
  | 'doctor'
  | 'hooker'
  | 'maniac'
  | 'bodyguard'
  | 'seer'
  | 'werewolf'
  | 'civilian';

export type Team = 'peaceful' | 'mafia';

export type GamePhase =
  | 'lobby'
  | 'night0'
  | 'night'
  | 'announce'
  | 'opium'
  | 'defense'
  | 'voting'
  | 'lastWord'
  | 'end';

export type DeathReason =
  | 'mafia'
  | 'maniac'
  | 'werewolf'
  | 'vote'
  | 'techKill'
  | 'redCard'
  | 'sheriffShot'
  | 'bodyguardTrade';

export type CheckResult = 'mafia' | 'civilian';
export type CompareResult = 'sameTeam' | 'differentTeam';

export interface RoleMeta {
  role: GameRole;
  team: Team;
  icon: string;
  color: string;
  nameRu: string;
  phrase: string;
}

export const ROLE_META: Record<GameRole, RoleMeta> = {
  don:        { role: 'don',        team: 'mafia',    icon: '🎩', color: '#991B1B', nameRu: 'Дон',              phrase: 'Город будет наш' },
  mafia:      { role: 'mafia',      team: 'mafia',    icon: '🔫', color: '#EF4444', nameRu: 'Мафия',            phrase: 'Слушай Дона' },
  framer:     { role: 'framer',     team: 'mafia',    icon: '🎭', color: '#EA580C', nameRu: 'Подставщик',       phrase: 'Никто не узнает правду' },
  enforcer:   { role: 'enforcer',   team: 'mafia',    icon: '💪', color: '#7F1D1D', nameRu: 'Громила',          phrase: 'Один удар. Без промаха' },
  sheriff:    { role: 'sheriff',    team: 'peaceful', icon: '🔍', color: '#3B82F6', nameRu: 'Комиссар',         phrase: 'Найди их. Любой ценой' },
  doctor:     { role: 'doctor',     team: 'peaceful', icon: '💊', color: '#22C55E', nameRu: 'Доктор',           phrase: 'Спаси невинных' },
  hooker:     { role: 'hooker',     team: 'peaceful', icon: '💋', color: '#EC4899', nameRu: 'Любовница',        phrase: 'Одно прикосновение — и он твой' },
  maniac:     { role: 'maniac',     team: 'peaceful', icon: '🔪', color: '#F97316', nameRu: 'Маньяк',           phrase: 'Охота начинается' },
  bodyguard:  { role: 'bodyguard',  team: 'peaceful', icon: '🛡️', color: '#D97706', nameRu: 'Телохранитель',    phrase: 'Ценой своей жизни' },
  seer:       { role: 'seer',       team: 'peaceful', icon: '👁️', color: '#06B6D4', nameRu: 'Провидец',         phrase: 'Я вижу вашу сущность' },
  werewolf:   { role: 'werewolf',   team: 'peaceful', icon: '🐺', color: '#8B5CF6', nameRu: 'Оборотень',        phrase: 'Ещё не время...' },
  civilian:   { role: 'civilian',   team: 'peaceful', icon: '🏠', color: '#64748B', nameRu: 'Мирный',           phrase: 'Твоя сила — голос' },
};

export interface RoleDistribution {
  don: number;
  mafia: number;
  framer: number;
  enforcer: number;
  sheriff: number;
  doctor: number;
  hooker: number;
  maniac: number;
  bodyguard: number;
  seer: number;
  werewolf: number;
  civilian: number;
}

export const ROLE_DISTRIBUTION: Record<number, RoleDistribution> = {
  10: { don: 1, mafia: 2, framer: 0, enforcer: 0, sheriff: 1, doctor: 1, hooker: 0, maniac: 1, bodyguard: 0, seer: 0, werewolf: 0, civilian: 4 },
  11: { don: 1, mafia: 2, framer: 0, enforcer: 0, sheriff: 1, doctor: 1, hooker: 1, maniac: 1, bodyguard: 0, seer: 0, werewolf: 0, civilian: 4 },
  12: { don: 1, mafia: 2, framer: 1, enforcer: 0, sheriff: 1, doctor: 1, hooker: 1, maniac: 1, bodyguard: 0, seer: 0, werewolf: 0, civilian: 4 },
  13: { don: 1, mafia: 2, framer: 1, enforcer: 0, sheriff: 1, doctor: 1, hooker: 1, maniac: 1, bodyguard: 0, seer: 1, werewolf: 0, civilian: 4 },
  14: { don: 1, mafia: 2, framer: 1, enforcer: 0, sheriff: 1, doctor: 1, hooker: 1, maniac: 1, bodyguard: 0, seer: 1, werewolf: 0, civilian: 5 },
  15: { don: 1, mafia: 2, framer: 1, enforcer: 1, sheriff: 1, doctor: 1, hooker: 1, maniac: 1, bodyguard: 0, seer: 1, werewolf: 0, civilian: 5 },
  16: { don: 1, mafia: 2, framer: 1, enforcer: 1, sheriff: 1, doctor: 1, hooker: 1, maniac: 1, bodyguard: 1, seer: 1, werewolf: 0, civilian: 5 },
  17: { don: 1, mafia: 2, framer: 1, enforcer: 1, sheriff: 1, doctor: 1, hooker: 1, maniac: 1, bodyguard: 1, seer: 1, werewolf: 1, civilian: 5 },
  18: { don: 1, mafia: 3, framer: 1, enforcer: 1, sheriff: 1, doctor: 1, hooker: 1, maniac: 1, bodyguard: 1, seer: 1, werewolf: 1, civilian: 5 },
  19: { don: 1, mafia: 3, framer: 1, enforcer: 1, sheriff: 1, doctor: 1, hooker: 1, maniac: 1, bodyguard: 1, seer: 1, werewolf: 1, civilian: 6 },
  20: { don: 1, mafia: 4, framer: 1, enforcer: 1, sheriff: 1, doctor: 1, hooker: 1, maniac: 1, bodyguard: 1, seer: 1, werewolf: 1, civilian: 6 },
};

export interface TimerSettings {
  presentation: number;
  opium: number;
  defense: number;
  votingPerCandidate: number;
  lastWord: number;
  nightAction: number;
}

export function getTimerSettings(playerCount: number): TimerSettings {
  if (playerCount <= 12) {
    return { presentation: 30, opium: 300, defense: 30, votingPerCandidate: 10, lastWord: 30, nightAction: 15 };
  } else if (playerCount <= 16) {
    return { presentation: 20, opium: 420, defense: 30, votingPerCandidate: 10, lastWord: 30, nightAction: 15 };
  } else {
    return { presentation: 15, opium: 480, defense: 20, votingPerCandidate: 10, lastWord: 20, nightAction: 15 };
  }
}

export interface NightStep {
  role: GameRole;
  icon: string;
  nameRu: string;
  actionRu: string;
  color: string;
  note: string;
  isGroup?: boolean;
  canPass?: boolean;
}

export const NIGHT_STEPS: NightStep[] = [
  { role: 'hooker',    icon: '💋', nameRu: 'Любовница',    actionRu: 'Заблокировать игрока',  color: '#EC4899', note: 'Не может одного 2 ночи подряд' },
  { role: 'don',       icon: '🎩', nameRu: 'Мафия',        actionRu: 'Выбрать жертву',        color: '#EF4444', note: 'Дон решает. Громила = неблокируемое', isGroup: true },
  { role: 'framer',    icon: '🎭', nameRu: 'Подставщик',   actionRu: 'Подставить мирного',    color: '#F97316', note: 'Только чётные ночи (2,4,6). Подстава до конца след. дня', canPass: true },
  { role: 'sheriff',   icon: '🔍', nameRu: 'Комиссар',     actionRu: 'Проверить игрока',      color: '#3B82F6', note: 'Результат: Мафия / Мирный' },
  { role: 'seer',      icon: '👁️', nameRu: 'Провидец',     actionRu: 'Сравнить двоих',        color: '#06B6D4', note: 'Одна команда / Разные' },
  { role: 'doctor',    icon: '💊', nameRu: 'Доктор',       actionRu: 'Вылечить игрока',       color: '#22C55E', note: 'Может себя. Не спасает от Громилы' },
  { role: 'bodyguard', icon: '🛡️', nameRu: 'Телохранитель', actionRu: 'Охранять игрока',      color: '#D97706', note: 'Размен: гибнет + забирает мафиози' },
  { role: 'maniac',    icon: '🔪', nameRu: 'Маньяк',       actionRu: 'Убить игрока',          color: '#F97316', note: 'Независимо от мафии. Доктор спасает' },
  { role: 'werewolf',  icon: '🐺', nameRu: 'Оборотень',    actionRu: 'Убить игрока',          color: '#8B5CF6', note: 'Только после гибели ВСЕЙ мафии' },
];

export interface Player {
  seat: number;
  name: string;
  nick: string;
  telegramId?: number;
  userId?: string;
  role: GameRole;
  team: Team;
  alive: boolean;
  fouls: number;
  eliminatedBy?: DeathReason;
  eliminatedNight?: number;
  eliminatedDay?: number;
  avatar?: {
    emoji: string;
    colors: [string, string];
  };
}

export interface NightActions {
  courtesanTarget?: number;
  mafiaTarget?: number;
  enforcerUsed: boolean;
  framerTarget?: number;
  sheriffTarget?: number;
  seerTargets?: [number, number];
  doctorTarget?: number;
  bodyguardTarget?: number;
  maniacTarget?: number;
  werewolfTarget?: number;
}

export interface NightResult {
  deaths: Array<{ seat: number; cause: DeathReason }>;
  saves: Array<{ seat: number; savedBy: GameRole }>;
  sheriffCheck?: { seat: number; result: CheckResult; isFramed: boolean };
  seerCompare?: { seats: [number, number]; result: CompareResult };
  blocked?: number;
  werewolfActivated?: boolean;
  werewolfImmune?: number;
  enforcerResult?: {
    declared: true;
    effective: boolean;
    abilityConsumed: boolean;
    reason?: 'enforcer_blocked' | 'don_blocked';
  };
}

export interface GameState {
  id: number;
  name: string;
  playerCount: number;
  dayNumber: number;
  phase: GamePhase;
  players: Player[];
  nightLog: NightActions[];
  voteLog: Array<{
    day: number;
    candidates: number[];
    votes: Record<number, number>;
    eliminated?: number;
  }>;
  foulLog: Array<{
    seat: number;
    day: number;
    phase: GamePhase;
  }>;
  enforcerUsed: boolean;
  werewolfActive: boolean;
  sheriffChecks: Array<{ seat: number; result: CheckResult }>;
  framerTarget?: number;
  framerExpiry?: number;
  previousCourtesanTarget?: number;
  previousBodyguardTarget?: number;
  doctorLastTarget?: number;
  doctorConsecutiveCount: number;
  nominees: number[];
  isRanked: boolean;
  winner?: 'peaceful' | 'mafia' | 'werewolf';
}

export type WSEvent =
  | { type: 'role:assigned'; data: { role: GameRole; team: Team; teammates?: number[] } }
  | { type: 'night:result'; data: { message: string; checkResult?: CheckResult; compareResult?: CompareResult; blocked?: boolean } }
  | { type: 'day:started'; data: { dayNumber: number; deaths: string[]; saves: string[] } }
  | { type: 'day:timer'; data: { phase: GamePhase; secondsLeft: number } }
  | { type: 'day:nomination'; data: { seat: number; name: string } }
  | { type: 'day:vote'; data: { candidates: number[]; results: Record<number, number> } }
  | { type: 'player:eliminated'; data: { seat: number; name: string; role: GameRole } }
  | { type: 'game:ended'; data: { winner: string; players: Array<{ seat: number; name: string; role: GameRole; alive: boolean; rating: number }> } }
  | { type: 'game:created'; data: { id: number; name: string; date: string } }
  | { type: 'player:joined'; data: { name: string; gameId: number } }
  | { type: 'player:left'; data: { name: string; gameId: number } }
  | { type: 'games:refresh'; data?: Record<string, never> }
  | { type: 'rating:updated'; data: { total: number; change: number } };

export interface CreateGameRequest {
  name: string;
  date: string;
  location: string;
  cost?: number;
  maxPlayers: number;
  isRanked: boolean;
}

export interface GameRatingBreakdown {
  base: number;
  survival: number;
  roleBonus: number;
  penalties: number;
  total: number;
  details: string[];
}
