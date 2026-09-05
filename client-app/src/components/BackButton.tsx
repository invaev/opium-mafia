import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { isTelegramApp } from '../lib/telegram';

interface BackButtonProps {
  label: string;
  to?: string;
  onClick?: () => void;
}

const BackButton: React.FC<BackButtonProps> = ({ label, to, onClick }) => {
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  }, [onClick, to, navigate]);

  useTelegramBackButton(handleBack);

  if (isTelegramApp()) return null;

  return (
    <div className="px-5 py-3.5 flex items-center border-b border-white/[0.06]">
      <button
        onClick={handleBack}
        className="bg-transparent border-none text-text-link text-sm font-semibold cursor-pointer p-0"
      >
        &larr; {label}
      </button>
    </div>
  );
};

export default BackButton;
