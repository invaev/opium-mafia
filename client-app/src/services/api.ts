import { getInitDataRaw } from '../lib/telegram';
import { logger } from '../utils/logger';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
    logger.info('API', token ? 'Token set' : 'Token cleared');
  }

  hasToken(): boolean {
    return this.token !== null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const method = options.method || 'GET';
    const startTime = performance.now();
    logger.debug('API', `${method} ${endpoint}`, { hasToken: !!this.token });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const tgInitData = getInitDataRaw();
    if (tgInitData) {
      headers['X-Telegram-Init-Data'] = tgInitData;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      cache: 'no-store',
    });

    const duration = Math.round(performance.now() - startTime);

    if (!response.ok) {
      logger.error('API', `${method} ${endpoint} failed`, { status: response.status, duration_ms: duration });
      if (response.status === 401) {
        const { useAuthStore } = await import('../store/authStore');
        const isRegistered = useAuthStore.getState().isRegistered;
        if (isRegistered) {
          logger.warn('AUTH', 'Token expired or invalid, logging out');
          this.token = null;
          useAuthStore.getState().logout();
        } else {
          logger.warn('AUTH', 'Token rejected during registration, not logging out');
        }
      }
      let serverMessage = '';
      try {
        const body = await response.json();
        serverMessage = body?.error || '';
      } catch {}
      throw new Error(serverMessage || `API Error: ${response.status} ${response.statusText}`);
    }

    logger.debug('API', `${method} ${endpoint} ok`, { status: response.status, duration_ms: duration });

    if (duration > 2000) {
      logger.warn('API', `Slow request: ${method} ${endpoint}`, { duration_ms: duration });
    }

    return response.json();
  }

  async authenticate(initData: string) {
    logger.info('AUTH', 'Authenticating with Telegram initData');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const response = await fetch(`${this.baseUrl}/auth/telegram`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ initData }),
    });

    const data = await response.json();

    if (response.status === 403 && data.banned) {
      logger.warn('AUTH', 'Account is banned', { reason: data.banReason });
      return { token: '', isNewUser: false, registered: false, banned: true, banReason: data.banReason || null, user: {} as Record<string, unknown> };
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    logger.info('AUTH', 'Authentication successful', { isNewUser: data.isNewUser, registered: data.registered, userId: data.user?.id });
    return data as { token: string; isNewUser: boolean; registered: boolean; banned?: boolean; banReason?: string; user: Record<string, unknown> };
  }

  async completeRegistration() {
    logger.info('AUTH', 'Completing registration');
    return this.request<{ success: boolean }>('/users/register', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getGames() {
    return this.request<unknown[]>('/games');
  }

  async getGame(id: number) {
    return this.request<unknown>(`/games/${id}`);
  }

  async joinGame(gameId: number, guests: number = 0) {
    logger.info('GAME', `Joining game`, { gameId, guests });
    return this.request<unknown>(`/games/${gameId}/join`, {
      method: 'POST',
      body: JSON.stringify({ guests }),
    });
  }

  async leaveGame(gameId: number) {
    logger.info('GAME', `Leaving game`, { gameId });
    return this.request<unknown>(`/games/${gameId}/leave`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getProfile() {
    return this.request<unknown>('/users/me');
  }

  async updateProfile(data: { name?: string; nickname?: string; bio?: string; instagramUsername?: string; dateOfBirth?: string; gender?: string; avatar?: unknown }) {
    logger.info('USER', 'Updating profile', { fields: Object.keys(data) });
    const serverData: Record<string, unknown> = {};
    if (data.name !== undefined) serverData.displayName = data.name;
    if (data.nickname !== undefined) serverData.nickname = data.nickname;
    if (data.bio !== undefined) serverData.bio = data.bio;
    if (data.instagramUsername !== undefined) serverData.instagramUsername = data.instagramUsername;
    if (data.dateOfBirth !== undefined) serverData.dateOfBirth = data.dateOfBirth;
    if (data.gender !== undefined) serverData.gender = data.gender;
    if (data.avatar !== undefined) {
      const av = data.avatar as { type: string; photoUrl?: string; emoji?: string; colorIndex?: number };
      if (av.type === 'photo' && av.photoUrl) {
        serverData.avatarUrl = av.photoUrl;
        serverData.avatarEmoji = null;
      } else {
        serverData.avatarUrl = null;
        serverData.avatarEmoji = av.emoji || null;
      }
      if (av.colorIndex !== undefined) {
        serverData.avatarColorIndex = av.colorIndex;
      }
    }
    return this.request<unknown>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(serverData),
    });
  }

  async deleteAccount() {
    logger.warn('USER', 'Account deletion requested');
    return this.request<{ success: boolean }>('/users/me', {
      method: 'DELETE',
    });
  }

  async getUser(id: number) {
    return this.request<unknown>(`/users/${id}`);
  }

  async getLeaderboard(period: 'all' | 'month' | 'week' = 'all') {
    return this.request<unknown[]>(`/users/leaderboard?period=${period}`);
  }

  async getHistory(limit = 20, offset = 0) {
    return this.request<{ games: unknown[]; total: number }>(`/users/me/games?limit=${limit}&offset=${offset}`);
  }

  async getMyRole(gameId: number) {
    logger.info('GAME', `Fetching my role`, { gameId });
    return this.request<{ assigned: boolean; seat: number; role?: string; team?: string; teammates?: Array<{ seat: number; name: string }> }>(`/games/${gameId}/my-role`);
  }

  async trackShare() {
    return this.request<{ success: boolean }>('/analytics/share', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

}

export const api = new ApiClient(API_BASE);
