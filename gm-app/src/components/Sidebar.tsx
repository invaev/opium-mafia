import React from 'react';
import { theme, ADMIN_NAV, GAME_NAV } from '../theme';
import type { ScreenId } from '../theme';

interface SidebarProps {
  screen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
}

const adminScreens = new Set<string>(ADMIN_NAV.map(n => n.id));

export const Sidebar: React.FC<SidebarProps> = ({ screen, onNavigate }) => {
  const isAdmin = adminScreens.has(screen);

  return (
    <div
      style={{
        width: 76,
        minWidth: 76,
        background: theme.gradient.sidebar,
        borderRight: `1px solid ${theme.border.default}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        gap: 2,
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          marginBottom: 8,
          background: theme.gradient.omLogo,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          cursor: 'pointer',
        }}
        onClick={() => onNavigate('dashboard')}
      >
        OM
      </div>

      {ADMIN_NAV.map((item) => (
        <div
          key={item.id}
          onClick={() => onNavigate(item.id)}
          style={{
            width: 58,
            padding: '7px 0',
            borderRadius: 10,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            background: screen === item.id ? 'rgba(245,158,11,0.12)' : 'transparent',
          }}
        >
          <span style={{ fontSize: 16, opacity: screen === item.id ? 1 : 0.4 }}>
            {item.icon}
          </span>
          <span
            style={{
              fontSize: 8,
              fontWeight: 600,
              lineHeight: 1.2,
              textAlign: 'center' as const,
              color: screen === item.id ? theme.accent.orange : theme.text.dead,
            }}
          >
            {item.label}
          </span>
        </div>
      ))}

      <div
        style={{
          width: 36,
          height: 1,
          background: theme.border.default,
          margin: '4px 0',
        }}
      />

      <div
        style={{
          color: theme.text.dim,
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: 1,
          marginBottom: 2,
        }}
      >
        {'\u0418\u0413\u0420\u0410'}
      </div>

      {GAME_NAV.map((item) => (
        <div
          key={item.id}
          onClick={() => onNavigate(item.id)}
          style={{
            width: 58,
            padding: '7px 0',
            borderRadius: 10,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            background: screen === item.id ? 'rgba(99,102,241,0.15)' : 'transparent',
          }}
        >
          <span style={{ fontSize: 16, opacity: screen === item.id ? 1 : 0.4 }}>
            {item.icon}
          </span>
          <span
            style={{
              fontSize: 8,
              fontWeight: 600,
              lineHeight: 1.2,
              textAlign: 'center' as const,
              color: screen === item.id ? theme.accent.purple : theme.text.dead,
            }}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
};
