import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AvatarCircle from '../components/AvatarCircle';
import BackButton from '../components/BackButton';
import { useUserStore } from '../store/userStore';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useTelegramMainButton } from '../hooks/useTelegramMainButton';
import { hapticNotification } from '../hooks/useHaptic';
import { showToast } from '../components/Toast';
import { isTelegramApp } from '../lib/telegram';
import { api } from '../services/api';

const EditProfile: React.FC = () => {
  const navigate = useNavigate();
  const { profile, updateProfile, setProfile } = useUserStore();

  const logout = useAuthStore((s) => s.logout);
  const { setGames, setActiveGame, setGameEnd, setNews, setHistory } = useGameStore();

  const [name, setName] = useState(profile?.name || '');
  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [instagram, setInstagram] = useState(profile?.instagramUsername || '');
  const [dob, setDob] = useState(profile?.dateOfBirth || '');
  const [gender, setGender] = useState(profile?.gender || '');
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasChanges = name !== (profile?.name || '') || nickname !== (profile?.nickname || '') || bio !== (profile?.bio || '') || instagram !== (profile?.instagramUsername || '') || dob !== (profile?.dateOfBirth || '') || gender !== (profile?.gender || '');

  const isDobValid = dob === '' || /^\d{2}\.\d{2}\.\d{4}$/.test(dob);

  const handleSave = useCallback(async () => {
    if (!isDobValid) return;
    try {
      const cleanNickname = nickname.replace(/^@/, '');
      await api.updateProfile({ name, nickname: cleanNickname, bio, instagramUsername: instagram, dateOfBirth: dob, gender, avatar: profile?.avatar });
      updateProfile({ name, nickname: cleanNickname, bio, instagramUsername: instagram, dateOfBirth: dob, gender });
      setSaved(true);
      hapticNotification('success');
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Profile update failed:', err);
      showToast('Ошибка сохранения', 'error');
    }
  }, [name, nickname, bio, instagram, dob, gender, isDobValid, updateProfile]);

  const handleDeleteAccount = useCallback(async () => {
    setDeleting(true);
    try {
      await api.deleteAccount();
      hapticNotification('success');

      api.setToken(null);

      logout();
      setProfile(null as any);
      setGames([]);
      setActiveGame(null);
      setGameEnd(null);
      setNews([]);
      setHistory([]);

      localStorage.removeItem('opium-auth');
      localStorage.removeItem('opium-auth-v2');
      localStorage.removeItem('opium-user');
      localStorage.removeItem('opium-game');
      localStorage.removeItem('opium_token');

      navigate('/welcome');
    } catch {
      hapticNotification('error');
      showToast('Не удалось удалить аккаунт', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [logout, navigate, setProfile, setGames, setActiveGame, setGameEnd, setNews, setHistory]);

  useTelegramMainButton(
    hasChanges && !saved ? 'Сохранить изменения' : saved ? '✓ Сохранено' : null,
    handleSave,
    { color: saved ? '#16A34A' : '#EF4444' }
  );

  if (!profile) return null;

  const inputCls = "w-full px-3.5 py-3 rounded-xl text-text-primary text-[15px] border border-white/10 focus:border-primary/40 transition-colors";
  const inputBg = { background: 'rgba(255,255,255,0.04)' } as const;

  return (
    <div>
      <BackButton label="Профиль" to="/profile" />
      <div className="px-5 py-5">
        <div className="flex flex-col items-center mb-5">
          <AvatarCircle
            emoji={profile.avatar.type === 'emoji' ? profile.avatar.emoji : undefined}
            photoUrl={profile.avatar.type === 'photo' ? profile.avatar.photoUrl : undefined}
            colorIndex={profile.avatar.colorIndex}
            size={72}
          />
          <button
            onClick={() => navigate('/avatar-picker')}
            className="mt-2 text-text-link text-[12px] font-semibold cursor-pointer bg-transparent border-none"
          >
            Сменить аватар
          </button>
        </div>

        <div className="flex gap-2.5 mb-3.5">
          <div className="flex-1">
            <label className="text-text-secondary text-[11px] font-semibold block mb-1.5">ИМЯ</label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setSaved(false); }}
              placeholder="Имя"
              maxLength={24}
              className={inputCls}
              style={inputBg}
            />
          </div>
          <div className="flex-1">
            <label className="text-text-secondary text-[11px] font-semibold block mb-1.5">НИКНЕЙМ</label>
            <input
              value={nickname}
              onChange={(e) => { setNickname(e.target.value.replace(/^@/, '')); setSaved(false); }}
              placeholder="Буквы, цифры, пробелы, -, _, ."
              maxLength={20}
              className={inputCls}
              style={inputBg}
            />
          </div>
        </div>

        <div className="mb-3.5">
          <label className="text-text-secondary text-[11px] font-semibold block mb-1.5">БИО</label>
          <input
            value={bio}
            onChange={(e) => { setBio(e.target.value); setSaved(false); }}
            placeholder="Расскажи о себе"
            maxLength={60}
            className={inputCls}
            style={inputBg}
          />
        </div>

        <div className="flex gap-2.5 mb-3.5">
          <div className="flex-[1.2]">
            <label className="text-text-secondary text-[11px] font-semibold block mb-1.5">ДАТА РОЖДЕНИЯ</label>
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
                setSaved(false);
              }}
              placeholder="ДД.ММ.ГГГГ"
              maxLength={10}
              inputMode="numeric"
              className={`${inputCls} ${dob && !isDobValid ? '!border-red-500/60' : ''}`}
              style={inputBg}
            />
            {dob && !isDobValid && (
              <div className="text-red-400 text-[10px] mt-1 pl-1">ДД.ММ.ГГГГ</div>
            )}
          </div>
          <div className="flex-1">
            <label className="text-text-secondary text-[11px] font-semibold block mb-1.5">ПОЛ</label>
            <div className="flex gap-1.5">
              {[{ value: 'male', label: 'Муж' }, { value: 'female', label: 'Жен' }].map((g) => (
                <button
                  key={g.value}
                  onClick={() => { setGender(g.value); setSaved(false); }}
                  className="flex-1 py-3 rounded-xl text-[14px] font-medium cursor-pointer transition-colors border"
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

        <div className="mb-3.5">
          <label className="text-text-secondary text-[11px] font-semibold block mb-1.5">INSTAGRAM</label>
          <input
            value={instagram}
            onChange={(e) => { setInstagram(e.target.value.replace(/^@/, '')); setSaved(false); }}
            placeholder="username (без @)"
            maxLength={30}
            className={inputCls}
            style={inputBg}
          />
        </div>

        <div
          className="flex items-center gap-2.5 mb-5 px-3.5 py-2.5 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
            style={{ background: 'linear-gradient(135deg, #229ED9, #1E88D0)' }}
          >
            T
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[#C0C0D0] text-[13px] font-medium">{profile.telegramUsername}</span>
            <span className="text-text-muted text-[11px] ml-1.5">подключен</span>
          </div>
          <div className="w-2 h-2 rounded-full bg-success shrink-0" />
        </div>

        {!isTelegramApp() && (hasChanges || saved) && (
          <button
            onClick={handleSave}
            className="w-full py-3.5 rounded-xl border-none text-white text-[15px] font-bold cursor-pointer transition-all duration-300"
            style={{
              background: saved
                ? 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)'
                : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
              boxShadow: saved
                ? '0 6px 24px rgba(34,197,94,0.25)'
                : '0 6px 24px rgba(239,68,68,0.25)',
            }}
          >
            {saved ? '✓ Сохранено' : 'Сохранить'}
          </button>
        )}

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full py-3 rounded-xl border-none bg-transparent text-primary text-[13px] font-semibold cursor-pointer mt-3 opacity-50"
        >
          Удалить аккаунт
        </button>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-[300px] rounded-2xl p-5 text-center" style={{ background: '#1A1A24' }}>
            <div className="text-text-primary text-[15px] font-bold mb-1.5">Удалить аккаунт?</div>
            <div className="text-text-secondary text-[13px] mb-5">
              Профиль, рейтинг и история будут удалены навсегда.
            </div>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="w-full py-3 rounded-xl border-none text-white text-[14px] font-bold cursor-pointer mb-2 disabled:opacity-50"
              style={{ background: '#EF4444' }}
            >
              {deleting ? 'Удаление...' : 'Да, удалить'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="w-full py-3 rounded-xl border-none text-text-secondary text-[14px] font-semibold cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditProfile;
