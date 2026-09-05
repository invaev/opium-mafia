import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AvatarCircle from '../components/AvatarCircle';
import { useUserStore, avatarEmojis } from '../store/userStore';
import { useAuthStore } from '../store/authStore';
import { getTelegramUser, getInitDataRaw } from '../lib/telegram';
import { api } from '../services/api';
import { useTelegramMainButton } from '../hooks/useTelegramMainButton';
import { hapticImpact, hapticNotification } from '../hooks/useHaptic';
import { showToast } from '../components/Toast';
import { isTelegramApp } from '../lib/telegram';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { profile, setProfile, updateProfile } = useUserStore();
  const { setAuthenticated, setRegistered } = useAuthStore();

  const tgUser = getTelegramUser();

  useEffect(() => {
    if (!profile) {
      const defaultAvatar: { type: 'emoji' | 'photo'; emoji?: string; photoUrl?: string; colorIndex: number } = tgUser?.photoUrl
        ? { type: 'photo', photoUrl: tgUser.photoUrl, colorIndex: 0 }
        : { type: 'emoji', emoji: '😎', colorIndex: 0 };
      setProfile({
        id: 0,
        name: '',
        nickname: '',
        bio: '',
        telegramUsername: tgUser?.username ? `@${tgUser.username}` : '',
        instagramUsername: '',
        dateOfBirth: '',
        gender: '',
        avatar: defaultAvatar,
        rating: 0,
        stats: { gamesPlayed: 0, winRate: '0%', avgPoints: '0', bestPoints: '0', totalFouls: 0 },
        topRoles: [],
        ratingHistory: [],
      });
    }
  }, []);

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const emojiIndex = avatarEmojis.indexOf(profile?.avatar.emoji || '😎');

  const getAge = (dobStr: string): number | null => {
    const parts = dobStr.split('.');
    if (parts.length !== 3 || parts[2].length !== 4) return null;
    const birthDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const age = dob.length === 10 ? getAge(dob) : null;
  const isUnderage = age !== null && age < 18;

  const handleDone = useCallback(async () => {
    if (!name.length) return;
    if (isUnderage) {
      showToast('Регистрация доступна с 18 лет', 'error');
      return;
    }
    hapticNotification('success');

    if (!api.hasToken()) {
      const persistedToken = useAuthStore.getState().token;
      const initDataRaw = getInitDataRaw();

      if (persistedToken) {
        api.setToken(persistedToken);
      } else if (initDataRaw) {
        try {
          const result = await api.authenticate(initDataRaw);
          if (result.token) {
            api.setToken(result.token);
            setAuthenticated(result.token);
            if (result.user?.id) {
              updateProfile({ id: result.user.id as number });
            }
          }
        } catch (err) {
          console.error('Server auth failed during registration:', err);
          showToast('Ошибка регистрации. Попробуй снова.');
          return;
        }
      } else if (import.meta.env.DEV) {
        setAuthenticated('dev-token');
      } else {
        showToast('Закрой и открой приложение заново');
        return;
      }
    }

    const cleanNickname = nickname.replace(/^@/, '');
    try {
      await api.updateProfile({ name, nickname: cleanNickname, dateOfBirth: dob, gender, avatar: profile?.avatar });
    } catch (err) {
      console.error('Profile update during registration failed:', err);
      showToast('Не удалось сохранить профиль. Попробуй снова.');
      return;
    }

    try {
      await api.completeRegistration();
    } catch (err) {
      console.error('Registration completion failed:', err);
      showToast('Ошибка регистрации. Попробуй снова.');
      return;
    }

    updateProfile({
      name,
      nickname,
      dateOfBirth: dob,
      gender,
      telegramUsername: tgUser?.username ? `@${tgUser.username}` : profile?.telegramUsername || '',
    });
    setRegistered();
    showToast('Профиль создан!');
    navigate('/');
  }, [name, nickname, dob, gender, isUnderage, tgUser, updateProfile, setAuthenticated, setRegistered, navigate, profile?.telegramUsername]);

  const canSubmit = name.length > 0 && dob.length === 10 && age !== null && !isUnderage;

  useTelegramMainButton(
    canSubmit ? 'Готово' : null,
    handleDone
  );

  return (
    <div className="px-5 py-6 overflow-y-auto h-full">
      <div className="text-center mb-7">
        <div className="text-accent text-xs font-semibold tracking-[2px] uppercase">
          Шаг 1 из 2
        </div>
        <div className="text-text-primary text-[22px] font-bold mt-2">
          Создай профиль
        </div>
      </div>

      <div className="text-center mb-7">
        <div className="flex justify-center">
          <AvatarCircle
            emoji={profile?.avatar.type === 'emoji' ? avatarEmojis[emojiIndex >= 0 ? emojiIndex : 0] : undefined}
            photoUrl={profile?.avatar.type === 'photo' ? profile.avatar.photoUrl : undefined}
            colorIndex={profile?.avatar.colorIndex ?? 0}
            size={88}
          />
        </div>
        <button
          onClick={() => {
            hapticImpact('light');
            navigate('/avatar-picker');
          }}
          className="mt-3 px-4 py-1.5 rounded-[10px] border border-white/10 text-text-link text-[13px] font-semibold cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          Выбрать аватар
        </button>
      </div>

      {tgUser?.firstName && (
        <button
          onClick={() => {
            hapticImpact('light');
            const tgName = tgUser?.firstName || '';
            const tgNick = (tgUser?.username || '').replace(/^@/, '');
            if (tgName) setName(tgName);
            if (tgNick) setNickname(tgNick);
          }}
          className="w-full mb-5 py-3 rounded-[14px] text-[13px] font-semibold cursor-pointer transition-colors border"
          style={{
            background: 'rgba(59,130,246,0.08)',
            borderColor: 'rgba(59,130,246,0.2)',
            color: '#60A5FA',
          }}
        >
          Заполнить из Telegram
        </button>
      )}

      <div className="mb-5">
        <label className="text-text-secondary text-xs font-semibold block mb-2">ИМЯ</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Как тебя зовут?"
          maxLength={24}
          className="w-full px-4 py-3.5 rounded-[14px] text-text-primary text-base border border-white/10 focus:border-primary/40 transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        />
        <div className="text-text-muted text-[11px] mt-1.5 pl-1">Видно всем игрокам за столом</div>
      </div>

      <div className="mb-5">
        <label className="text-text-secondary text-xs font-semibold block mb-2">НИКНЕЙМ</label>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value.replace(/^@/, ''))}
          placeholder="@username"
          maxLength={20}
          className="w-full px-4 py-3.5 rounded-[14px] text-text-primary text-base border border-white/10 focus:border-primary/40 transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        />
        <div className="text-text-muted text-[11px] mt-1.5 pl-1">Уникальный, для таблицы лидеров</div>
      </div>

      <div className="flex gap-2.5 mb-5">
        <div className="flex-[1.2]">
          <label className="text-text-secondary text-xs font-semibold block mb-2">ДАТА РОЖДЕНИЯ</label>
          <input
            value={dob}
            onChange={(e) => {
              let v = e.target.value.replace(/[^\d.]/g, '');
              const digits = v.replace(/\./g, '');
              if (digits.length >= 5) {
                v = digits.slice(0, 2) + '.' + digits.slice(2, 4) + '.' + digits.slice(4, 8);
              } else if (digits.length >= 3) {
                v = digits.slice(0, 2) + '.' + digits.slice(2, 4);
              } else {
                v = digits;
              }
              setDob(v);
            }}
            placeholder="ДД.ММ.ГГГГ"
            maxLength={10}
            inputMode="numeric"
            className="w-full px-4 py-3.5 rounded-[14px] text-text-primary text-base border border-white/10 focus:border-primary/40 transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          />
        </div>
        <div className="flex-1">
          <label className="text-text-secondary text-xs font-semibold block mb-2">ПОЛ</label>
          <div className="flex gap-1.5">
            {[{ value: 'male', label: 'Муж' }, { value: 'female', label: 'Жен' }].map((g) => (
              <button
                key={g.value}
                onClick={() => setGender(g.value)}
                className="flex-1 py-3.5 rounded-[14px] text-[14px] font-medium cursor-pointer transition-colors border"
                style={{
                  background: gender === g.value ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                  borderColor: gender === g.value ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)',
                  color: gender === g.value ? '#EF4444' : '#8A8AA0',
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isUnderage && (
        <div
          className="mb-4 p-3 rounded-xl text-center text-[13px] font-semibold"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#EF4444',
          }}
        >
          Регистрация доступна с 18 лет
        </div>
      )}

      {!isTelegramApp() && (
        <button
          onClick={handleDone}
          disabled={!canSubmit}
          className="w-full py-[18px] rounded-2xl border-none text-white text-[17px] font-bold cursor-pointer transition-all duration-300"
          style={{
            background: canSubmit
              ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
              : 'rgba(255,255,255,0.06)',
            color: canSubmit ? '#fff' : '#5A5A70',
            boxShadow: canSubmit ? '0 8px 32px rgba(239,68,68,0.3)' : 'none',
          }}
        >
          Готово
        </button>
      )}

    </div>
  );
};

export default Register;
