import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AvatarCircle from '../components/AvatarCircle';
import { useUserStore } from '../store/userStore';
import { api } from '../services/api';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { profile, updateProfile, updateAvatar } = useUserStore();

  useEffect(() => {
    api.getProfile().then((data: any) => {
      if (!data) return;
      updateProfile({
        name: data.displayName || profile?.name || '',
        nickname: data.nickname || '',
        bio: data.bio || '',
        instagramUsername: data.instagramUsername || '',
        dateOfBirth: data.dateOfBirth || '',
        gender: data.gender || '',
        rating: data.totalRating || 0,
        stats: {
          gamesPlayed: data.gamesPlayed || 0,
          winRate: data.winRate ? `${data.winRate}%` : '0%',
          avgPoints: data.avgPointsPerGame ? String(data.avgPointsPerGame) : '0',
          bestPoints: data.bestGameRating ? String(data.bestGameRating) : '0',
          totalFouls: data.totalFouls || 0,
        },
      });
      if (data.avatarUrl) {
        updateAvatar({
          type: 'photo',
          photoUrl: data.avatarUrl,
          colorIndex: profile?.avatar?.colorIndex || 0,
        });
      }
    }).catch(() => {});
  }, []);

  if (!profile) return null;

  const stats = [
    { icon: '🎮', label: 'Игр сыграно', value: profile.stats.gamesPlayed },
    { icon: '🏆', label: 'Побед', value: profile.stats.winRate },
    { icon: '⭐', label: 'Среднее за игру', value: profile.stats.avgPoints },
    { icon: '🔥', label: 'Рекорд', value: profile.stats.bestPoints },
    { icon: '⚠️', label: 'Всего фолов', value: profile.stats.totalFouls },
  ];

  return (
    <div className="px-5 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <AvatarCircle
            emoji={profile.avatar.type === 'emoji' ? profile.avatar.emoji : undefined}
            photoUrl={profile.avatar.type === 'photo' ? profile.avatar.photoUrl : undefined}
            colorIndex={profile.avatar.colorIndex}
            size={64}
          />
          <div className="flex-1">
            <div className="text-text-primary text-xl font-bold">{profile.name}</div>
            {profile.bio && (
              <div className="text-text-muted text-xs mt-0.5 italic">{profile.bio}</div>
            )}
            {profile.nickname && (
              <div className="text-[#6A6A80] text-[13px] mt-0.5">@{profile.nickname}</div>
            )}
          </div>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => navigate('/edit-profile')}
            className="flex-1 py-3 rounded-[14px] text-text-link text-[13px] font-semibold cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            Редактировать профиль
          </button>
          <div
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-[14px]"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            <span className="text-accent text-xl font-extrabold">{profile.rating}</span>
            <span className="text-[#B8860B] text-[13px]">рейтинг</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-5">
        {stats.map((s, i) => (
          <div
            key={i}
            className="rounded-[14px] p-3.5"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="text-lg">{s.icon}</div>
            <div className="text-text-primary text-xl font-bold mt-1.5">{s.value}</div>
            <div className="text-[#6A6A80] text-[11px] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div
        className="rounded-2xl p-4 mb-4"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="text-text-secondary text-xs font-semibold mb-3">
          Лучшие роли:
        </div>
        {profile.topRoles.map((r, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
          >
            <div>
              <div className="text-[#C0C0D0] text-sm font-medium">
                {r.role} {r.icon}
              </div>
              <div className="text-[#6A6A80] text-[11px]">{r.games} игр</div>
            </div>
            <div className="text-base font-bold" style={{ color: r.color }}>
              {r.avgResult}
            </div>
          </div>
        ))}
      </div>

      <div
        className="rounded-2xl p-4"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="text-text-secondary text-xs font-semibold mb-3">
          Рейтинг по месяцам:
        </div>
        <div className="flex items-end gap-1 h-20">
          {profile.ratingHistory.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: `${h}%`,
                background: i === profile.ratingHistory.length - 1
                  ? 'linear-gradient(180deg, #F59E0B, #D97706)'
                  : 'rgba(255,255,255,0.08)',
              }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1 text-text-muted text-[9px]">
          <span>Апр</span>
          <span>Мар</span>
        </div>
      </div>

      <button
        onClick={() => navigate('/history')}
        className="w-full mt-4 py-3 rounded-[14px] text-text-link text-sm font-semibold cursor-pointer"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        📋 История игр
      </button>

      <div className="mt-6 pb-2 text-center text-text-muted text-[11px]">
        Created by{' '}
        <a
          href="https://vaevi.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-link font-semibold"
        >
          Vaevi Technologies
        </a>
      </div>
    </div>
  );
};

export default Profile;
