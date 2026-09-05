import React, { useState } from 'react';
import { theme } from '../theme';
import type { ServerUser } from '../api';
import { banUser, unbanUser } from '../api';

const AVATAR_STYLE_COLORS: Array<[string, string]> = [
  ['#3B82F6', '#8B5CF6'],
  ['#EF4444', '#F59E0B'],
  ['#22C55E', '#059669'],
  ['#06B6D4', '#3B82F6'],
  ['#F59E0B', '#EC4899'],
  ['#6366F1', '#1E1B4B'],
  ['#64748B', '#1E293B'],
  ['#DC2626', '#991B1B'],
];

const FALLBACK_COLORS: Array<[string, string]> = [
  ['#3B82F6', '#8B5CF6'],
  ['#EC4899', '#F59E0B'],
  ['#EF4444', '#DC2626'],
  ['#06B6D4', '#3B82F6'],
  ['#64748B', '#1E293B'],
  ['#6366F1', '#1E1B4B'],
  ['#F59E0B', '#DC2626'],
  ['#22C55E', '#059669'],
];

function getAge(dob: string): number | null {
  const parts = dob.split('.');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  const birth = new Date(y, m - 1, d);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface PlayerPopupProps {
  user: ServerUser;
  onClose: () => void;
  onUserUpdated?: () => void;
}

export const PlayerPopup: React.FC<PlayerPopupProps> = ({ user, onClose, onUserUpdated }) => {
  const [avatarZoom, setAvatarZoom] = useState(false);
  const [showBanForm, setShowBanForm] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [busy, setBusy] = useState(false);
  const colors = user.avatarColorIndex != null
    ? AVATAR_STYLE_COLORS[user.avatarColorIndex] || FALLBACK_COLORS[user.id % FALLBACK_COLORS.length]
    : FALLBACK_COLORS[user.id % FALLBACK_COLORS.length];
  const winRate = user.gamesPlayed > 0
    ? Math.round((user.gamesWon / user.gamesPlayed) * 100)
    : 0;

  const handleBan = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await banUser(user.id, banReason || undefined);
      onUserUpdated?.();
      onClose();
    } catch (err) {
      alert(`Ошибка: ${(err as Error).message}`);
    }
    setBusy(false);
  };

  const handleUnban = async () => {
    if (busy) return;
    const confirmed = window.confirm(`Разбанить ${user.displayName}?`);
    if (!confirmed) return;
    setBusy(true);
    try {
      await unbanUser(user.id);
      onUserUpdated?.();
      onClose();
    } catch (err) {
      alert(`Ошибка: ${(err as Error).message}`);
    }
    setBusy(false);
  };

  return (
    <>
      <div
        onClick={() => { onClose(); setAvatarZoom(false); }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: theme.bg.elevated,
            border: `1px solid ${theme.border.strong}`,
            borderRadius: 20,
            padding: 24,
            width: 340,
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          {user.banned && (
            <div style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              marginBottom: 12,
              textAlign: 'center',
            }}>
              <div style={{ color: '#EF4444', fontSize: 12, fontWeight: 700 }}>ЗАБЛОКИРОВАН</div>
              {user.banReason && (
                <div style={{ color: '#F87171', fontSize: 11, marginTop: 4 }}>{user.banReason}</div>
              )}
            </div>
          )}

          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div
              onClick={() => setAvatarZoom(true)}
              style={{ cursor: 'pointer', display: 'inline-block' }}
            >
              {user.avatarEmoji ? (
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    background: user.banned
                      ? 'linear-gradient(135deg,#EF4444,#991B1B)'
                      : `linear-gradient(135deg,${colors[0]},${colors[1]})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 36,
                    margin: '0 auto',
                  }}
                >
                  {user.avatarEmoji}
                </div>
              ) : user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    objectFit: 'cover',
                    border: `3px solid ${user.banned ? '#EF4444' : colors[0]}`,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    background: user.banned
                      ? 'linear-gradient(135deg,#EF4444,#991B1B)'
                      : `linear-gradient(135deg,${colors[0]},${colors[1]})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                    fontWeight: 700,
                    color: '#fff',
                    margin: '0 auto',
                  }}
                >
                  {user.displayName.charAt(0)}
                </div>
              )}
            </div>
            <div style={{ color: theme.text.primary, fontSize: 18, fontWeight: 700, marginTop: 10 }}>
              {user.displayName}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Рейтинг', value: String(user.totalRating), color: '#F59E0B' },
              { label: 'Игр', value: String(user.gamesPlayed), color: '#3B82F6' },
              { label: 'Побед', value: String(user.gamesWon), color: '#22C55E' },
              { label: '% побед', value: `${winRate}%`, color: '#22C55E' },
              { label: 'Фолов', value: String(user.totalFouls), color: '#EF4444' },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${theme.border.subtle}`,
                }}
              >
                <div style={{ color: s.color, fontSize: 18, fontWeight: 700 }}>{s.value}</div>
                <div style={{ color: theme.text.dim, fontSize: 10, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {user.bio && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${theme.border.subtle}`, marginBottom: 16 }}>
              <div style={{ color: theme.text.secondary, fontSize: 13, fontStyle: 'italic' }}>{user.bio}</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: theme.text.dim }}>Никнейм</span>
              <span style={{ color: user.nickname ? '#229ED9' : theme.text.dark }}>{user.nickname || '\u2014'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: theme.text.dim }}>Instagram</span>
              <span style={{ color: user.instagramUsername ? '#E1306C' : theme.text.dark }}>{user.instagramUsername || '\u2014'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: theme.text.dim }}>Дата рождения</span>
              <span style={{ color: user.dateOfBirth ? theme.text.primary : theme.text.dark }}>
                {user.dateOfBirth ? `${user.dateOfBirth}${getAge(user.dateOfBirth) != null ? ` (${getAge(user.dateOfBirth)})` : ''}` : '\u2014'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: theme.text.dim }}>Пол</span>
              <span style={{ color: user.gender ? theme.text.primary : theme.text.dark }}>{user.gender ? (user.gender === 'male' ? 'Муж' : 'Жен') : '\u2014'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: theme.text.dim }}>Последняя игра</span>
              <span style={{ color: user.lastGameDate ? theme.text.primary : theme.text.dark }}>
                {user.lastGameDate ? `${user.lastGameName ? `${user.lastGameName} \u00B7 ` : ''}${formatDate(user.lastGameDate)}` : '\u2014'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: theme.text.dim }}>Зарегистрирован</span>
              <span style={{ color: theme.text.primary }}>{formatDate(user.createdAt)}</span>
            </div>
          </div>

          {showBanForm && !user.banned && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ color: '#F87171', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>ПРИЧИНА БАНА</div>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Опишите причину бана..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${theme.border.medium}`,
                  color: theme.text.primary,
                  fontSize: 13,
                  fontFamily: theme.font,
                  resize: 'vertical',
                  minHeight: 60,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => { setShowBanForm(false); setBanReason(''); }}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 8,
                    border: `1px solid ${theme.border.medium}`,
                    background: 'transparent',
                    color: theme.text.muted,
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: theme.font,
                  }}
                >
                  Отмена
                </button>
                <button
                  onClick={handleBan}
                  disabled={busy}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 8,
                    border: '1px solid rgba(239,68,68,0.4)',
                    background: 'rgba(239,68,68,0.15)',
                    color: '#EF4444',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: busy ? 'wait' : 'pointer',
                    fontFamily: theme.font,
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  {busy ? '...' : 'Забанить'}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              onClick={() => { onClose(); setAvatarZoom(false); }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 10,
                border: `1px solid ${theme.border.medium}`,
                background: 'transparent',
                color: theme.text.muted,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: theme.font,
              }}
            >
              Закрыть
            </button>
            {user.banned ? (
              <button
                onClick={handleUnban}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  border: '1px solid rgba(34,197,94,0.4)',
                  background: 'rgba(34,197,94,0.12)',
                  color: '#22C55E',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: busy ? 'wait' : 'pointer',
                  fontFamily: theme.font,
                  opacity: busy ? 0.5 : 1,
                }}
              >
                {busy ? '...' : 'Разбанить'}
              </button>
            ) : (
              <button
                onClick={() => setShowBanForm(true)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.08)',
                  color: '#F87171',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: theme.font,
                }}
              >
                Забанить
              </button>
            )}
          </div>
        </div>
      </div>

      {avatarZoom && (
        <div
          onClick={() => setAvatarZoom(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            cursor: 'pointer',
          }}
        >
          {user.avatarEmoji ? (
            <div
              style={{
                width: 240,
                height: 240,
                borderRadius: 120,
                background: `linear-gradient(135deg,${colors[0]},${colors[1]})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 100,
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
            >
              {user.avatarEmoji}
            </div>
          ) : user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              style={{
                maxWidth: '80vw',
                maxHeight: '80vh',
                borderRadius: 16,
                objectFit: 'contain',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
            />
          ) : (
            <div
              style={{
                width: 240,
                height: 240,
                borderRadius: 120,
                background: `linear-gradient(135deg,${colors[0]},${colors[1]})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 80,
                fontWeight: 700,
                color: '#fff',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
            >
              {user.displayName.charAt(0)}
            </div>
          )}
        </div>
      )}
    </>
  );
};
