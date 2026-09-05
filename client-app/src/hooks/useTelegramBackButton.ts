import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isTelegramApp, backButton } from '../lib/telegram';

export function useTelegramBackButton(onBack?: () => void) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isTelegramApp()) return;

    const handler = () => {
      if (onBack) {
        onBack();
      } else {
        navigate(-1);
      }
    };

    try {
      backButton.show();
      backButton.onClick(handler);
    } catch {}

    return () => {
      try {
        backButton.hide();
        backButton.offClick(handler);
      } catch {}
    };
  }, [navigate, onBack]);
}
