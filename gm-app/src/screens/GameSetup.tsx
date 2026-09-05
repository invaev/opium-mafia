import React, { useRef, useState } from 'react';
import { theme } from '../theme';
import { useGameStore } from '../store/gameStore';
import { createGameOnServer } from '../api';

export const GameSetup: React.FC = () => {
  const setScreen = useGameStore((s) => s.setScreen);
  const createGame = useGameStore((s) => s.createGame);

  const [name, setName] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  });
  const [time, setTime] = useState('18:00');
  const [location, setLocation] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [cost, setCost] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(15);
  const [isRanked, setIsRanked] = useState(true);
  const [hostTelegram, setHostTelegram] = useState('');
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDateTimeValid = (() => {
    if (!date || !time) return false;
    const parts = date.split('/');
    if (parts.length !== 3) return false;
    const [dd, mm, yyyy] = parts;
    const gameDate = new Date(`${yyyy}-${mm}-${dd}T${time}:00`);
    return !isNaN(gameDate.getTime()) && gameDate > new Date();
  })();

  const canCreate = name.trim() !== '' && date !== '' && time !== '' && isDateTimeValid && location.trim() !== '' && locationUrl.trim() !== '' && cost.trim() !== '' && hostTelegram.trim() !== '' && !creating;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoData(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      await createGameOnServer({
        name,
        date,
        time,
        location,
        locationUrl,
        cost: Number(cost),
        maxPlayers,
        isRanked,
        hostTelegram: hostTelegram.replace(/^@/, ''),
        photoData: photoData || undefined,
      });
      createGame(name, maxPlayers, location, isRanked);
      setCreating(false);
      setScreen('dashboard');
      return;
    } catch (err) {
      console.error('Failed to create game on server:', err);
      alert('Ошибка при создании игры');
    }
    setCreating(false);
  };

  return (
    <div style={{ padding: '24px 28px 120px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ color: theme.text.primary, fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
        Создать игру
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
          Название
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${theme.border.medium}`,
            color: theme.text.primary,
            fontSize: 14,
            outline: 'none',
            fontFamily: theme.font,
          }}
        />
      </div>

      <div style={{ marginBottom: 12, display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
            Дата
          </div>
          <input
            type="text"
            value={date}
            placeholder="дд/мм/гггг"
            maxLength={10}
            onChange={(e) => {
              let v = e.target.value.replace(/[^0-9/]/g, '');
              const digits = v.replace(/\//g, '');
              if (digits.length <= 2) v = digits;
              else if (digits.length <= 4) v = `${digits.slice(0, 2)}/${digits.slice(2)}`;
              else v = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
              setDate(v);
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${theme.border.medium}`,
              color: theme.text.primary,
              fontSize: 14,
              outline: 'none',
              fontFamily: theme.font,
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
            Время
          </div>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${theme.border.medium}`,
              color: theme.text.primary,
              fontSize: 14,
              outline: 'none',
              fontFamily: theme.font,
              colorScheme: 'dark',
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
          Место
        </div>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Название места"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${theme.border.medium}`,
            color: theme.text.primary,
            fontSize: 14,
            outline: 'none',
            fontFamily: theme.font,
            marginBottom: 6,
          }}
        />
        <input
          value={locationUrl}
          onChange={(e) => setLocationUrl(e.target.value)}
          placeholder="Ссылка на Google Maps"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${theme.border.medium}`,
            color: theme.text.primary,
            fontSize: 14,
            outline: 'none',
            fontFamily: theme.font,
          }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
          Стоимость
        </div>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={cost}
          onChange={(e) => setCost(e.target.value.replace(/[^0-9]/g, ''))}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${theme.border.medium}`,
            color: theme.text.primary,
            fontSize: 14,
            outline: 'none',
            fontFamily: theme.font,
          }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
          Telegram ведущего
        </div>
        <input
          value={hostTelegram}
          onChange={(e) => setHostTelegram(e.target.value)}
          placeholder="@username"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${theme.border.medium}`,
            color: theme.text.primary,
            fontSize: 14,
            outline: 'none',
            fontFamily: theme.font,
          }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
          Макс. игроков: {maxPlayers}
        </div>
        <input
          type="range"
          min={10}
          max={20}
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(Number(e.target.value))}
          style={{ width: '100%', accentColor: theme.accent.purple }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            color: theme.text.dim,
            fontSize: 10,
          }}
        >
          <span>10</span>
          <span>20</span>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
          Тип
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[true, false].map((ranked) => (
            <div
              key={String(ranked)}
              onClick={() => setIsRanked(ranked)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 10,
                cursor: 'pointer',
                textAlign: 'center',
                background:
                  isRanked === ranked ? 'rgba(139,92,246,0.15)' : theme.bg.card,
                border: `1px solid ${isRanked === ranked ? 'rgba(139,92,246,0.3)' : theme.border.default}`,
                color:
                  isRanked === ranked ? theme.accent.purple : theme.text.dim,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {ranked ? '🏆 Рейтинговая' : '🤝 Товарищеская'}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ color: theme.text.muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
          Фото
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoSelect}
          style={{ display: 'none' }}
        />
        {photoData ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img
              src={photoData}
              alt="Game photo"
              style={{
                width: '100%',
                maxHeight: 200,
                objectFit: 'cover',
                borderRadius: 10,
                border: `1px solid ${theme.border.medium}`,
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: `1px solid ${theme.border.medium}`,
                  background: 'rgba(255,255,255,0.04)',
                  color: theme.text.muted,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: theme.font,
                }}
              >
                Заменить
              </button>
              <button
                onClick={() => setPhotoData(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: `1px solid rgba(239,68,68,0.3)`,
                  background: 'rgba(239,68,68,0.1)',
                  color: '#EF4444',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: theme.font,
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '20px',
              borderRadius: 10,
              border: `1px dashed ${theme.border.medium}`,
              background: 'rgba(255,255,255,0.02)',
              textAlign: 'center',
              cursor: 'pointer',
              color: theme.text.dim,
              fontSize: 13,
            }}
          >
            📷 Нажмите чтобы выбрать фото
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button
          onClick={() => setScreen('dashboard')}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            border: `1px solid ${theme.border.medium}`,
            background: 'transparent',
            color: theme.text.muted,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: theme.font,
          }}
        >
          Отмена
        </button>
        <button
          onClick={handleCreate}
          disabled={!canCreate}
          style={{
            padding: '10px 24px',
            borderRadius: 10,
            border: 'none',
            background: canCreate ? theme.gradient.green : 'rgba(255,255,255,0.06)',
            color: canCreate ? '#fff' : 'rgba(255,255,255,0.25)',
            fontSize: 13,
            fontWeight: 700,
            cursor: canCreate ? 'pointer' : 'not-allowed',
            fontFamily: theme.font,
          }}
        >
          ✓ Создать
        </button>
      </div>
    </div>
  );
};
