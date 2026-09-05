import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { hapticSelection } from '../hooks/useHaptic';

const tabs = [
  { id: 'home', path: '/', icon: '🏠', label: 'Главная' },
  { id: 'games', path: '/games', icon: '🎮', label: 'Игры' },
  { id: 'profile', path: '/profile', icon: '👤', label: 'Профиль' },
  { id: 'leaderboard', path: '/leaderboard', icon: '🏆', label: 'Рейтинг' },
];

function getActiveTab(pathname: string): string {
  if (pathname.startsWith('/games') || pathname.startsWith('/game/')) return 'games';
  if (pathname.startsWith('/profile') || pathname.startsWith('/edit-profile') || pathname.startsWith('/history') || pathname.startsWith('/avatar-picker')) return 'profile';
  if (pathname.startsWith('/leaderboard')) return 'leaderboard';
  return 'home';
}

const TabBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = getActiveTab(location.pathname);

  return (
    <div
      className="flex border-t border-white/[0.06] pt-1.5 pb-0.5 shrink-0"
      style={{
        background: 'linear-gradient(180deg, #111118 0%, #0D0D12 100%)',
        paddingBottom: 'max(2px, env(safe-area-inset-bottom, 2px))',
      }}
    >
      {tabs.map((t) => {
        const isActive = activeTab === t.id;
        return (
          <div
            key={t.id}
            onClick={() => {
              hapticSelection();
              navigate(t.path);
            }}
            className="flex-1 flex flex-col items-center gap-0.5 cursor-pointer py-1"
          >
            <span
              className="text-lg transition-opacity duration-200"
              style={{ opacity: isActive ? 1 : 0.4 }}
            >
              {t.icon}
            </span>
            <span
              className="text-[10px] font-semibold tracking-wide transition-colors duration-200"
              style={{ color: isActive ? '#E8E8F0' : '#4A4A5A' }}
            >
              {t.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default TabBar;
