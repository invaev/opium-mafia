import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AvatarCircle from '../components/AvatarCircle';
import BackButton from '../components/BackButton';
import { useUserStore, avatarStyles, avatarEmojis } from '../store/userStore';
import { useTelegramMainButton } from '../hooks/useTelegramMainButton';
import { hapticImpact, hapticSelection, hapticNotification } from '../hooks/useHaptic';
import { showToast } from '../components/Toast';
import { isTelegramApp, getTelegramUser } from '../lib/telegram';
import { api } from '../services/api';

const MAX_PHOTO_SIZE = 512;
const PHOTO_QUALITY = 0.7;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width;
      let h = img.height;
      if (w > MAX_PHOTO_SIZE || h > MAX_PHOTO_SIZE) {
        if (w > h) {
          h = Math.round((h * MAX_PHOTO_SIZE) / w);
          w = MAX_PHOTO_SIZE;
        } else {
          w = Math.round((w * MAX_PHOTO_SIZE) / h);
          h = MAX_PHOTO_SIZE;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', PHOTO_QUALITY));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

const AvatarPicker: React.FC = () => {
  const navigate = useNavigate();
  const { profile, updateAvatar } = useUserStore();

  const [tab, setTab] = useState<'emoji' | 'photo'>('emoji');
  const [selectedColor, setSelectedColor] = useState(profile?.avatar.colorIndex ?? 0);
  const [selectedEmoji, setSelectedEmoji] = useState(
    avatarEmojis.indexOf(profile?.avatar.emoji || '😎')
  );
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    profile?.avatar.type === 'photo' ? (profile.avatar.photoUrl ?? null) : null
  );
  const [uploadHover, setUploadHover] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Файл слишком большой (макс. 5 МБ)');
      return;
    }
    try {
      const compressed = await compressImage(file);
      setPhotoPreview(compressed);
      hapticNotification('success');
    } catch {
      showToast('Не удалось загрузить фото');
    }
  };

  const handleUseTelegramPhoto = useCallback(() => {
    const tgUser = getTelegramUser();
    if (tgUser?.photoUrl) {
      setPhotoPreview(tgUser.photoUrl);
      hapticNotification('success');
    } else {
      showToast('Фото Telegram недоступно');
    }
  }, []);

  const handleSave = useCallback(async () => {
    hapticNotification('success');
    let avatarData;
    if (tab === 'photo' && photoPreview) {
      avatarData = {
        type: 'photo' as const,
        photoUrl: photoPreview,
        colorIndex: selectedColor,
      };
    } else {
      avatarData = {
        type: 'emoji' as const,
        emoji: avatarEmojis[selectedEmoji],
        colorIndex: selectedColor,
      };
    }
    updateAvatar(avatarData);
    try {
      await api.updateProfile({ avatar: avatarData });
    } catch (err) {
      console.error('Failed to sync avatar to server:', err);
    }
    navigate(-1);
  }, [tab, photoPreview, selectedEmoji, selectedColor, updateAvatar, navigate]);

  useTelegramMainButton('Сохранить аватар', handleSave);

  const previewEmoji = tab === 'emoji' ? avatarEmojis[selectedEmoji] : undefined;
  const previewPhoto = tab === 'photo' ? (photoPreview ?? undefined) : undefined;

  return (
    <div>
      <BackButton label="Назад" />
      <div className="px-5 py-6 overflow-y-auto">
        <div className="text-center text-text-primary text-lg font-bold mb-6">
          Аватар
        </div>

        <div className="text-center mb-7">
          <div className="flex justify-center">
            <AvatarCircle
              emoji={previewEmoji}
              photoUrl={previewPhoto}
              colorIndex={selectedColor}
              size={96}
            />
          </div>
          {tab === 'emoji' && (
            <div className="text-text-muted text-xs mt-2.5">
              {avatarStyles[selectedColor].label}
            </div>
          )}
        </div>

        <div
          className="flex gap-1 mb-5 rounded-xl p-1"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          {([
            { id: 'emoji' as const, label: 'Эмодзи' },
            { id: 'photo' as const, label: 'Фото' },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                hapticSelection();
                setTab(t.id);
              }}
              className="flex-1 py-2.5 rounded-[10px] border-none text-[13px] font-semibold cursor-pointer transition-all duration-200"
              style={{
                background: tab === t.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: tab === t.id ? '#E8E8F0' : '#5A5A70',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'emoji' && (
          <>
            <div className="mb-6">
              <div className="text-text-secondary text-xs font-semibold mb-2.5">
                Выбери иконку
              </div>
              <div className="grid grid-cols-8 gap-1.5">
                {avatarEmojis.map((e, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      hapticImpact('light');
                      setSelectedEmoji(i);
                    }}
                    className="aspect-square rounded-xl flex items-center justify-center text-xl cursor-pointer transition-all duration-200"
                    style={{
                      background: selectedEmoji === i
                        ? 'rgba(245,158,11,0.15)'
                        : 'rgba(255,255,255,0.04)',
                      border: selectedEmoji === i
                        ? '2px solid rgba(245,158,11,0.4)'
                        : '2px solid transparent',
                    }}
                  >
                    {e}
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <div className="text-text-secondary text-xs font-semibold mb-2.5">
                Цвет фона
              </div>
              <div className="grid grid-cols-4 gap-2">
                {avatarStyles.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      hapticSelection();
                      setSelectedColor(i);
                    }}
                    className="h-12 rounded-xl cursor-pointer transition-all duration-200 flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${s.colors[0]}, ${s.colors[1]})`,
                      boxShadow: selectedColor === i
                        ? `0 0 0 2px #0D0D12, 0 0 0 4px ${s.colors[0]}`
                        : 'none',
                    }}
                  >
                    {selectedColor === i && <span className="text-white text-base">✓</span>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'photo' && (
          <div className="mb-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />

            {photoPreview ? (
              <div className="text-center mb-4">
                <button
                  onClick={() => {
                    hapticImpact('light');
                    fileInputRef.current?.click();
                  }}
                  className="text-text-link text-[13px] font-semibold bg-transparent border-none cursor-pointer"
                >
                  Выбрать другое фото
                </button>
              </div>
            ) : (
              <div
                onClick={() => {
                  hapticImpact('light');
                  fileInputRef.current?.click();
                }}
                onMouseEnter={() => setUploadHover(true)}
                onMouseLeave={() => setUploadHover(false)}
                className="w-full h-40 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300"
                style={{
                  border: `2px dashed ${uploadHover ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  background: uploadHover ? 'rgba(96,165,250,0.05)' : 'rgba(255,255,255,0.02)',
                }}
              >
                <div className="text-[32px] mb-2 opacity-50">📷</div>
                <div className="text-text-secondary text-sm font-medium">
                  Нажми чтобы загрузить
                </div>
                <div className="text-text-muted text-[11px] mt-1">
                  JPG, PNG — макс. 5 МБ
                </div>
              </div>
            )}

            <button
              onClick={handleUseTelegramPhoto}
              className="w-full mt-3 p-3 rounded-xl border-none cursor-pointer flex items-center gap-3"
              style={{
                background: 'rgba(59,130,246,0.06)',
                border: '1px solid rgba(59,130,246,0.1)',
              }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                style={{ background: 'linear-gradient(135deg, #229ED9, #1E88D0)' }}
              >
                ✈️
              </div>
              <div className="text-text-link text-[13px] font-semibold text-left">
                Использовать фото из Telegram
              </div>
            </button>
          </div>
        )}

        {!isTelegramApp() && (
          <button
            onClick={handleSave}
            className="w-full py-[18px] rounded-2xl border-none text-white text-[17px] font-bold cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
              boxShadow: '0 8px 32px rgba(239,68,68,0.3)',
            }}
          >
            Сохранить аватар
          </button>
        )}
      </div>
    </div>
  );
};

export default AvatarPicker;
