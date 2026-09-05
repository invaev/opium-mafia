import React from 'react';
import { useGameStore } from '../store/gameStore';

export const EyeToggle: React.FC = () => {
  const rolesHidden = useGameStore((s) => s.rolesHidden);
  const toggleRolesHidden = useGameStore((s) => s.toggleRolesHidden);

  return (
    <button
      onClick={toggleRolesHidden}
      title={rolesHidden ? 'Показать роли' : 'Скрыть роли'}
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 100,
        width: 40,
        height: 40,
        borderRadius: 20,
        border: `1px solid ${rolesHidden ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
        background: rolesHidden ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
        color: rolesHidden ? '#EF4444' : '#9090A0',
        fontSize: 18,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
      }}
    >
      {rolesHidden ? '🙈' : '👁️'}
    </button>
  );
};
