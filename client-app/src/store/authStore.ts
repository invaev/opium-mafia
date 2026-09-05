import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  languageCode?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isRegistered: boolean;
  isBanned: boolean;
  banReason: string | null;
  isLoading: boolean;
  telegramUser: TelegramUser | null;
  token: string | null;

  setTelegramUser: (user: TelegramUser) => void;
  setAuthenticated: (token: string) => void;
  setRegistered: () => void;
  setBanned: (reason?: string | null) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  initFromTelegram: (user: TelegramUser) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      isRegistered: false,
      isBanned: false,
      banReason: null,
      isLoading: true,
      telegramUser: null,
      token: null,

      setTelegramUser: (user) => set({ telegramUser: user }),

      setAuthenticated: (token) =>
        set({ isAuthenticated: true, token, isLoading: false }),

      setRegistered: () => set({ isRegistered: true }),

      setBanned: (reason) => set({ isBanned: true, banReason: reason || null, isLoading: false }),

      logout: () => {
        localStorage.removeItem('opium_token');
        set({ isAuthenticated: false, isRegistered: false, isBanned: false, banReason: null, token: null, telegramUser: null, isLoading: false });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      initFromTelegram: (user) =>
        set({
          telegramUser: user,
        }),
    }),
    {
      name: 'opium-auth-v2',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        isRegistered: state.isRegistered,
        isBanned: state.isBanned,
        banReason: state.banReason,
        token: state.token,
        telegramUser: state.telegramUser,
      }),
    }
  )
);
