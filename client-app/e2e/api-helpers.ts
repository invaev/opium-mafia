import crypto from 'crypto';
import { APIRequestContext } from '@playwright/test';

const BOT_TOKEN = process.env.VITE_BOT_TOKEN || '';
const IPAD_API_KEY = process.env.VITE_IPAD_API_KEY || '';
const API_BASE = process.env.VITE_API_URL || 'http://localhost:3001';

const PATHS = {
  authTelegram: '/auth/telegram',
  authIpad: '/auth/ipad',
  usersMe: '/users/me',
  usersMeGames: '/users/me/games',
  usersRegister: '/users/register',
  users: '/users',
  games: '/games',
  gameJoin: (id: number) => `/games/${id}/join`,
  gameRoles: (id: number) => `/games/${id}/roles`,
  gameNight: (id: number) => `/games/${id}/night`,
  gameDay: (id: number) => `/games/${id}/day`,
  gameFinish: (id: number) => `/games/${id}/finish`,
  gameMyRole: (id: number) => `/games/${id}/my-role`,
  gameState: (id: number) => `/games/${id}/state`,
  health: '/health',
};

export function generateInitData(user: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}): string {
  const authDate = Math.floor(Date.now() / 1000);
  const userJson = JSON.stringify(user);

  const params = new URLSearchParams();
  params.set('user', userJson);
  params.set('auth_date', authDate.toString());

  const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();

  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const result = new URLSearchParams();
  for (const [key, value] of entries) {
    result.set(key, value);
  }
  result.set('hash', hash);

  return result.toString();
}

export function createTestUser(suffix?: string) {
  const id = 900000000 + Math.floor(Math.random() * 99999999);
  return {
    id,
    first_name: `E2ETest${suffix || ''}`,
    last_name: 'User',
    username: `e2e_test_${id}`,
    language_code: 'ru',
  };
}

export class TestApiClient {
  public token: string | null = null;
  private baseUrl = API_BASE;
  public userId: number | null = null;

  constructor(private request: APIRequestContext) {}

  async authenticateIpad(telegramId: number, displayName: string): Promise<{
    token: string;
    user: Record<string, unknown>;
  }> {
    const res = await this.request.post(`${this.baseUrl}${PATHS.authIpad}`, {
      data: { apiKey: IPAD_API_KEY, telegramId, displayName },
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json();
    if (!res.ok()) {
      throw new Error(`iPad auth failed (${res.status()}): ${JSON.stringify(body)}`);
    }
    this.token = body.token;
    this.userId = body.user?.id || null;
    return body;
  }

  async authenticate(initData: string): Promise<{
    token: string;
    isNewUser: boolean;
    registered: boolean;
    user: Record<string, unknown>;
  }> {
    const res = await this.request.post(`${this.baseUrl}${PATHS.authTelegram}`, {
      data: { initData },
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json();
    if (!res.ok()) {
      throw new Error(`Auth failed (${res.status()}): ${JSON.stringify(body)}`);
    }
    this.token = body.token;
    this.userId = body.user?.id || null;
    return body;
  }

  private authHeaders() {
    if (!this.token) throw new Error('Not authenticated');
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  async getHealth() {
    const res = await this.request.get(`${this.baseUrl}${PATHS.health}`);
    return { status: res.status(), body: await res.json() };
  }

  async completeRegistration() {
    const res = await this.request.post(`${this.baseUrl}${PATHS.usersRegister}`, {
      data: {},
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async getProfile() {
    const res = await this.request.get(`${this.baseUrl}${PATHS.usersMe}`, {
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async updateProfile(data: Record<string, unknown>) {
    const res = await this.request.patch(`${this.baseUrl}${PATHS.usersMe}`, {
      data,
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async getGameHistory(limit = 20, offset = 0) {
    const res = await this.request.get(
      `${this.baseUrl}${PATHS.usersMeGames}?limit=${limit}&offset=${offset}`,
      { headers: this.authHeaders() }
    );
    return { status: res.status(), body: await res.json() };
  }

  async deleteAccount() {
    const res = await this.request.delete(`${this.baseUrl}${PATHS.usersMe}`, {
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async listUsers() {
    const res = await this.request.get(`${this.baseUrl}${PATHS.users}`, {
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async createGame(data: {
    name: string;
    date: string;
    location: string;
    maxPlayers: number;
    isRanked: boolean;
  }) {
    const res = await this.request.post(`${this.baseUrl}${PATHS.games}`, {
      data,
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async joinGame(gameId: number, seatNumber: number, displayName: string) {
    const res = await this.request.post(`${this.baseUrl}${PATHS.gameJoin(gameId)}`, {
      data: { seatNumber, displayName },
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async leaveGame(gameId: number) {
    const res = await this.request.post(`${this.baseUrl}/games/${gameId}/leave`, {
      data: {},
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async assignRoles(gameId: number, players: Array<{
    seat: number;
    userId?: number;
    telegramId?: number;
    displayName: string;
    role: string;
    team: string;
    teammates?: number[];
  }>) {
    const res = await this.request.post(`${this.baseUrl}${PATHS.gameRoles(gameId)}`, {
      data: { players },
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async getGameState(gameId: number) {
    const res = await this.request.get(`${this.baseUrl}${PATHS.gameState(gameId)}`, {
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async getMyRole(gameId: number) {
    const res = await this.request.get(`${this.baseUrl}${PATHS.gameMyRole(gameId)}`, {
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async sendNight(gameId: number, data: Record<string, unknown>) {
    const res = await this.request.post(`${this.baseUrl}${PATHS.gameNight(gameId)}`, {
      data,
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async sendDay(gameId: number, data: Record<string, unknown>) {
    const res = await this.request.post(`${this.baseUrl}${PATHS.gameDay(gameId)}`, {
      data,
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async finishGame(gameId: number, data: Record<string, unknown>) {
    const res = await this.request.post(`${this.baseUrl}${PATHS.gameFinish(gameId)}`, {
      data,
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async banUser(userId: number, reason?: string) {
    const res = await this.request.post(`${this.baseUrl}/users/${userId}/ban`, {
      data: { reason: reason || null },
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async unbanUser(userId: number) {
    const res = await this.request.post(`${this.baseUrl}/users/${userId}/unban`, {
      data: {},
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async authenticateRaw(initData: string) {
    const res = await this.request.post(`${this.baseUrl}${PATHS.authTelegram}`, {
      data: { initData },
      headers: { 'Content-Type': 'application/json' },
    });
    return { status: res.status(), body: await res.json() };
  }

  async getLeaderboard() {
    const res = await this.request.get(`${this.baseUrl}/users/leaderboard`, {
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async getGames() {
    const res = await this.request.get(`${this.baseUrl}${PATHS.games}`, {
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async updateGame(gameId: number, data: Record<string, unknown>) {
    const res = await this.request.put(`${this.baseUrl}/games/${gameId}`, {
      data,
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async deleteGame(gameId: number) {
    const res = await this.request.delete(`${this.baseUrl}/games/${gameId}`, {
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async removePlayer(gameId: number, userId: number, ban = false) {
    const res = await this.request.post(`${this.baseUrl}/games/${gameId}/remove-player`, {
      data: { userId, ban },
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async getMetrics() {
    const res = await this.request.get(`${this.baseUrl}/metrics`);
    return { status: res.status(), body: await res.json() };
  }

  async cloneGame(gameId: number) {
    const res = await this.request.post(`${this.baseUrl}/games/${gameId}/clone`, {
      data: {},
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }

  async testCleanup() {
    const res = await this.request.delete(`${this.baseUrl}/users/test-cleanup`, {
      headers: this.authHeaders(),
    });
    return { status: res.status(), body: await res.json() };
  }
}
