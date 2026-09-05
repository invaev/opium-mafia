import { GameData } from '../store/gameStore';
import { avatarStyles } from '../store/userStore';

export function mapGames(data: any[]): GameData[] {
  return data.map((g: any) => ({
    id: g.id,
    title: g.title || `Game #${g.id}`,
    date: g.date || '',
    time: g.time || '',
    place: g.place || '',
    placeUrl: g.placeUrl || null,
    price: g.price || '',
    spots: g.spots || 0,
    taken: g.taken || 0,
    rated: g.rated ?? true,
    status: g.status || 'lobby',
    host: g.host || { name: 'GM', nick: '' },
    _playerUserIds: (g.players || []).map((p: any) => p.userId).filter(Boolean),
    players: (g.players || []).map((p: any) => ({
      name: p.name || '',
      nick: p.nick || '',
      emoji: p.avatarEmoji || p.name?.charAt(0)?.toUpperCase() || '?',
      colors: (p.avatarColorIndex != null && avatarStyles[p.avatarColorIndex]?.colors) || ['#8B5CF6', '#6366F1'] as [string, string],
      insta: p.insta || '',
      bio: p.bio || '',
      games: p.games || 0,
      winRate: p.winRate || '0%',
      rating: p.rating || 0,
      hasPhoto: !!p.avatarUrl,
      avatarUrl: p.avatarUrl || null,
      guests: p.guests || 0,
    })),
  }));
}
