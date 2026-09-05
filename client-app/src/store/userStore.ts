import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AvatarData {
  type: 'emoji' | 'photo';
  emoji?: string;
  photoUrl?: string;
  letter?: string;
  colorIndex: number;
}

export interface UserProfile {
  id: number;
  name: string;
  nickname: string;
  bio: string;
  telegramUsername: string;
  instagramUsername: string;
  dateOfBirth: string;
  gender: string;
  avatar: AvatarData;
  rating: number;
  stats: {
    gamesPlayed: number;
    winRate: string;
    avgPoints: string;
    bestPoints: string;
    totalFouls: number;
  };
  topRoles: Array<{
    role: string;
    icon: string;
    games: number;
    avgResult: string;
    color: string;
  }>;
  ratingHistory: number[];
}

interface UserState {
  profile: UserProfile | null;
  setProfile: (profile: UserProfile) => void;
  updateProfile: (partial: Partial<UserProfile>) => void;
  updateAvatar: (avatar: AvatarData) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      profile: null,

      setProfile: (profile) => set({ profile }),

      updateProfile: (partial) =>
        set((state) => ({
          profile: state.profile ? { ...state.profile, ...partial } : null,
        })),

      updateAvatar: (avatar) =>
        set((state) => ({
          profile: state.profile ? { ...state.profile, avatar } : null,
        })),
    }),
    {
      name: 'opium-user',
    }
  )
);

export const avatarStyles = [
  { id: 'gradient', colors: ['#3B82F6', '#8B5CF6'] as [string, string], label: 'Градиент' },
  { id: 'fire', colors: ['#EF4444', '#F59E0B'] as [string, string], label: 'Огонь' },
  { id: 'forest', colors: ['#22C55E', '#059669'] as [string, string], label: 'Лес' },
  { id: 'ocean', colors: ['#06B6D4', '#3B82F6'] as [string, string], label: 'Океан' },
  { id: 'sunset', colors: ['#F59E0B', '#EC4899'] as [string, string], label: 'Закат' },
  { id: 'night', colors: ['#6366F1', '#1E1B4B'] as [string, string], label: 'Ночь' },
  { id: 'storm', colors: ['#64748B', '#1E293B'] as [string, string], label: 'Шторм' },
  { id: 'ruby', colors: ['#DC2626', '#991B1B'] as [string, string], label: 'Рубин' },
];

export const avatarEmojis = [
  '😎', '🦊', '🐺', '🎭', '🔥', '💎', '🌙', '⚡',
  '🃏', '🎩', '👁️', '🦅', '🐍', '🦁', '🎯', '💀',
];
