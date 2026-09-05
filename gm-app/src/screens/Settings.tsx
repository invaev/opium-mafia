import React, { useState } from 'react';
import { theme } from '../theme';

interface RatingRow {
  label: string;
  value: number;
}

export const Settings: React.FC = () => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const ratingRows: RatingRow[] = [
    { label: 'Победа', value: 10 },
    { label: 'Поражение', value: 2 },
    { label: 'Дожил до конца', value: 3 },
    { label: '1-й фол', value: -1 },
    { label: '2-й фол', value: -2 },
    { label: '3 фола (тех.труп)', value: -5 },
    { label: 'Красная карточка', value: -5 },
    { label: 'Первый изгнанный (день 1)', value: -1 },
  ];

  const advancedRoles = [
    { label: 'Комиссар: нашёл мафиози', value: '+2' },
    { label: 'Комиссар: наводка → изгнание', value: '+3' },
    { label: 'Комиссар: выстрел по мафиози', value: '+5' },
    { label: 'Комиссар: выстрел по мирному', value: '−3' },
    { label: 'Доктор: успешное лечение', value: '+3' },
    { label: 'Доктор: спас себя', value: '+4' },
    { label: 'Любовница: заблокировала Дона', value: '+4' },
    { label: 'Любовница: заблок. рядового', value: '+1' },
    { label: 'Любовница: заблок. спецроль', value: '−2' },
    { label: 'Маньяк: убил мафиози', value: '+4' },
    { label: 'Маньяк: убил Дона', value: '+5' },
    { label: 'Маньяк: убил мирного', value: '−3' },
    { label: 'Маньяк: убил спецроль', value: '−4' },
    { label: 'Телохранитель: размен', value: '+5' },
    { label: 'Провидец: разные команды', value: '+2' },
    { label: 'Провидец: оба мафия', value: '+3' },
    { label: 'Оборотень: активировался', value: '+3' },
    { label: 'Оборотень: за убийство', value: '+2' },
    { label: 'Оборотень: победил 1х1', value: '+8' },
    { label: 'Дон: дожил до конца', value: '+3' },
    { label: 'Дон: мафия убила спецроль', value: '+2' },
    { label: 'Подставщик: подстава сработала', value: '+4' },
    { label: 'Подставщик: подставленного изгнали', value: '+5' },
    { label: 'Громила: убили спецроль', value: '+4' },
    { label: 'Громила: не использован', value: '−1' },
    { label: 'Мирный: голосовал за мафиози', value: '+2' },
    { label: 'Мирный: выдвинул мафиози', value: '+3' },
    { label: 'Мирный: голосовал за мирного', value: '−1' },
  ];

  return (
    <div style={{ padding: '24px 28px 120px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ color: theme.text.primary, fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
        Настройки
      </div>

      <div style={{ marginTop: 16 }}>
        <div
          style={{
            color: theme.text.muted,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1,
            marginBottom: 8,
          }}
        >
          РЕЙТИНГ
        </div>
        {ratingRows.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: `1px solid ${theme.border.subtle}`,
            }}
          >
            <span style={{ color: theme.text.secondary, fontSize: 13 }}>{r.label}</span>
            <span
              style={{
                color: r.value >= 0 ? '#22C55E' : '#EF4444',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {r.value >= 0 ? `+${r.value}` : r.value}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <div
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 0',
            cursor: 'pointer',
          }}
        >
          <span style={{ color: theme.text.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
            РАСШИРЕННЫЕ НАСТРОЙКИ РЕЙТИНГА
          </span>
          <span style={{ color: theme.text.dim, fontSize: 12 }}>
            {showAdvanced ? '▲' : '▼'}
          </span>
        </div>

        {showAdvanced && (
          <div style={{ marginTop: 4 }}>
            {advancedRoles.map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: `1px solid ${theme.border.subtle}`,
                }}
              >
                <span style={{ color: theme.text.secondary, fontSize: 12 }}>{r.label}</span>
                <span
                  style={{
                    color: r.value.includes('−') || r.value.startsWith('-') ? '#EF4444' : '#22C55E',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, paddingBottom: 8, textAlign: 'center', fontSize: 11, color: theme.text.secondary }}>
        Created by{' '}
        <a
          href="https://vaevi.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: theme.text.primary, fontWeight: 600, textDecoration: 'none' }}
        >
          Vaevi Technologies
        </a>
      </div>
    </div>
  );
};
