import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameRole, Team, GamePhase } from '@shared/types';

export interface GamePlayer {
  name: string;
  nick: string;
  emoji: string;
  colors: [string, string];
  insta?: string;
  bio?: string;
  games: number;
  winRate: string;
  rating: number;
  hasPhoto: boolean;
  guests: number;
  avatarUrl?: string | null;
}

export interface GameData {
  id: number;
  title: string;
  date: string;
  time: string;
  place: string;
  placeUrl?: string | null;
  price: string;
  spots: number;
  taken: number;
  rated: boolean;
  status?: string;
  host: { name: string; nick: string };
  players: GamePlayer[];
  _playerUserIds?: number[];
}

export interface ActiveGameData {
  id: number;
  title: string;
  place: string;
  role?: GameRole;
  team?: Team;
  phase?: GamePhase;
  dayNumber?: number;
}

export interface RatingBreakdown {
  label: string;
  pts: string;
  color: string;
}

export interface GameEndData {
  winner: string;
  winnerTeam: 'peaceful' | 'mafia' | 'werewolf';
  description: string;
  ratingBreakdown: RatingBreakdown[];
  totalChange: string;
  oldRating: number;
  newRating: number;
  players: Array<{
    seat: number;
    role: string;
    icon: string;
    dead: boolean;
    team: 'civ' | 'maf';
    isMe?: boolean;
  }>;
}

export interface NewsItem {
  icon: string;
  text: string;
  time: string;
}

export interface HistoryItem {
  id: number;
  date: string;
  role: string;
  result: string;
  pts: string;
  win: boolean;
}

interface GameState {
  games: GameData[];
  activeGame: ActiveGameData | null;
  gameEnd: GameEndData | null;
  news: NewsItem[];
  history: HistoryItem[];
  roleRevealed: boolean;
  joinedGames: Record<number, { guests: number }>;

  setGames: (games: GameData[]) => void;
  setActiveGame: (game: ActiveGameData | null) => void;
  setGameEnd: (data: GameEndData | null) => void;
  setNews: (news: NewsItem[]) => void;
  setHistory: (history: HistoryItem[]) => void;
  setRoleRevealed: (revealed: boolean) => void;
  joinGame: (gameId: number, guests: number) => void;
  leaveGame: (gameId: number) => void;
  isJoined: (gameId: number) => boolean;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      games: [],
      activeGame: null,
      gameEnd: null,
      news: [],
      history: [],
      roleRevealed: false,
      joinedGames: {},

      setGames: (games) => set({ games }),
      setActiveGame: (game) => set({ activeGame: game }),
      setGameEnd: (data) => set({ gameEnd: data }),
      setNews: (news) => set({ news }),
      setHistory: (history) => set({ history }),
      setRoleRevealed: (revealed) => set({ roleRevealed: revealed }),

      joinGame: (gameId, guests) =>
        set((state) => ({
          joinedGames: { ...state.joinedGames, [gameId]: { guests } },
          games: state.games.map((g) =>
            g.id === gameId ? { ...g, taken: g.taken + 1 + guests } : g
          ),
        })),

      leaveGame: (gameId) =>
        set((state) => {
          const joined = state.joinedGames[gameId];
          if (!joined) return state;
          const { [gameId]: _, ...rest } = state.joinedGames;
          return {
            joinedGames: rest,
            games: state.games.map((g) =>
              g.id === gameId
                ? { ...g, taken: Math.max(0, g.taken - 1 - joined.guests) }
                : g
            ),
          };
        }),

      isJoined: (gameId) => !!get().joinedGames[gameId],
    }),
    {
      name: 'opium-game',
      partialize: (state) => ({
        joinedGames: state.joinedGames,
        roleRevealed: state.roleRevealed,
      }),
    }
  )
);
