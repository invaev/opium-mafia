const API_URL = import.meta.env.VITE_API_URL || 'https://opium-server-production.up.railway.app';
const IPAD_API_KEY = import.meta.env.VITE_IPAD_API_KEY || '';

let token: string | null = null;

async function authenticate(): Promise<void> {
  const res = await fetch(`${API_URL}/auth/ipad`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: IPAD_API_KEY,
      telegramId: 999999999,
      displayName: 'Game Master',
    }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  token = data.token;
}

async function request<T>(endpoint: string): Promise<T> {
  if (!token) await authenticate();
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) {
    await authenticate();
    const retry = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!retry.ok) throw new Error(`API error: ${retry.status}`);
    return retry.json();
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function ensureAuth(): Promise<string> {
  if (!token) await authenticate();
  return token!;
}

export interface ServerUser {
  id: number;
  displayName: string;
  nickname: string | null;
  avatarUrl: string | null;
  avatarEmoji: string | null;
  avatarColorIndex: number | null;
  instagramUsername: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  bio: string | null;
  banned: boolean;
  banReason: string | null;
  totalRating: number;
  gamesPlayed: number;
  gamesWon: number;
  totalFouls: number;
  registered: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  lastGameName: string | null;
  lastGameDate: string | null;
}

export async function fetchUsers(): Promise<ServerUser[]> {
  return request<ServerUser[]>('/users');
}

export interface GlobalStats {
  totalPlayers: number;
  totalGames: number;
}

export async function createGameOnServer(data: {
  name: string;
  date: string;
  time?: string;
  location: string;
  locationUrl?: string;
  cost?: number;
  maxPlayers: number;
  isRanked: boolean;
  hostTelegram?: string;
  photoData?: string;
}): Promise<{ id: number; status: string; playerCount: number }> {
  if (!token) await authenticate();
  const doFetch = () =>
    fetch(`${API_URL}/games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  let res = await doFetch();
  if (res.status === 401) {
    await authenticate();
    res = await doFetch();
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface ServerGame {
  id: number;
  title: string;
  date: string;
  time: string;
  place: string;
  placeUrl: string | null;
  price: string;
  spots: number;
  taken: number;
  rated: boolean;
  status: string;
  winner: string | null;
  hostTelegram: string | null;
  players: Array<{
    name: string;
    nick?: string;
    seat?: number;
    userId: number | null;
    guests?: number;
    role?: string;
    alive?: boolean;
    fouls?: number;
    deathReason?: string | null;
    deathDay?: number | null;
    gameRating?: number;
    ratingBreakdown?: { base?: number; survival?: number; roleBonus?: number; penalties?: number; total?: number; details?: string[] };
  }>;
}

export async function fetchGames(): Promise<ServerGame[]> {
  return request<ServerGame[]>('/games');
}

export async function deleteGame(gameId: number): Promise<void> {
  if (!token) await authenticate();
  const doFetch = () =>
    fetch(`${API_URL}/games/${gameId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  let res = await doFetch();
  if (res.status === 401) {
    await authenticate();
    res = await doFetch();
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function updateGame(gameId: number, data: {
  name?: string;
  date?: string;
  time?: string;
  location?: string;
  locationUrl?: string;
  cost?: number;
  maxPlayers?: number;
  isRanked?: boolean;
  hostTelegram?: string;
  photoData?: string;
}): Promise<void> {
  if (!token) await authenticate();
  const doFetch = () =>
    fetch(`${API_URL}/games/${gameId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  let res = await doFetch();
  if (res.status === 401) {
    await authenticate();
    res = await doFetch();
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function sendRoles(gameId: number, players: Array<{
  seat: number;
  userId?: number;
  displayName: string;
  role: string;
  team: string;
  teammates?: number[];
}>): Promise<void> {
  if (!token) await authenticate();
  const doFetch = () =>
    fetch(`${API_URL}/games/${gameId}/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ players }),
    });
  let res = await doFetch();
  if (res.status === 401) {
    await authenticate();
    res = await doFetch();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
}

export async function fetchStats(): Promise<GlobalStats> {
  const [users, games] = await Promise.all([fetchUsers(), fetchGames()]);
  return {
    totalPlayers: users.length,
    totalGames: games.length,
  };
}

export async function saveGameState(gameId: number, state: Record<string, unknown>): Promise<void> {
  if (!token) await authenticate();
  const doFetch = () =>
    fetch(`${API_URL}/games/${gameId}/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ state }),
    });
  let res = await doFetch();
  if (res.status === 401) {
    await authenticate();
    res = await doFetch();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
}

export async function loadGameState(gameId: number): Promise<{ found: boolean; state?: Record<string, unknown>; updatedAt?: string }> {
  if (!token) await authenticate();
  const doFetch = () =>
    fetch(`${API_URL}/games/${gameId}/gm-state`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  let res = await doFetch();
  if (res.status === 401) {
    await authenticate();
    res = await doFetch();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function removePlayer(gameId: number, userId: number, ban: boolean = false, reason?: string): Promise<void> {
  if (!token) await authenticate();
  const doFetch = () =>
    fetch(`${API_URL}/games/${gameId}/remove-player`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId, ban, reason }),
    });
  let res = await doFetch();
  if (res.status === 401) {
    await authenticate();
    res = await doFetch();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
}

export async function finishGame(gameId: number, data: {
  winner: string;
  gameLog: Record<string, unknown>;
  players: Array<{
    seat: number;
    userId?: number;
    role: string;
    team: string;
    alive: boolean;
    fouls: number;
    deathReason?: string;
    deathDay?: number;
  }>;
}): Promise<void> {
  if (!token) await authenticate();
  const doFetch = () =>
    fetch(`${API_URL}/games/${gameId}/finish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  let res = await doFetch();
  if (res.status === 401) {
    await authenticate();
    res = await doFetch();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
}

export async function cloneGame(gameId: number): Promise<{ id: number; name: string; playersAdded: number }> {
  if (!token) await authenticate();
  const doFetch = () =>
    fetch(`${API_URL}/games/${gameId}/clone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
  let res = await doFetch();
  if (res.status === 401) {
    await authenticate();
    res = await doFetch();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function banUser(userId: number, reason?: string): Promise<void> {
  if (!token) await authenticate();
  const doFetch = () =>
    fetch(`${API_URL}/users/${userId}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: reason || null }),
    });
  let res = await doFetch();
  if (res.status === 401) { await authenticate(); res = await doFetch(); }
  if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || `API error: ${res.status}`); }
}

export async function unbanUser(userId: number): Promise<void> {
  if (!token) await authenticate();
  const doFetch = () =>
    fetch(`${API_URL}/users/${userId}/unban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
  let res = await doFetch();
  if (res.status === 401) { await authenticate(); res = await doFetch(); }
  if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || `API error: ${res.status}`); }
}
