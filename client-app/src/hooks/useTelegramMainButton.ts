import { useEffect, useRef, useCallback } from 'react';
import { isTelegramApp, mainButton } from '../lib/telegram';

export function useTelegramMainButton(
  text: string | null | undefined,
  onClick: () => void,
  options?: { color?: string; textColor?: string }
) {
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  const stableOnClick = useCallback(() => {
    onClickRef.current();
  }, []);

  const color = options?.color || '#EF4444';
  const textColor = options?.textColor || '#FFFFFF';

  useEffect(() => {
    if (!isTelegramApp()) return;

    if (!text) {
      try { mainButton.setParams({ isVisible: false }); } catch {}
      return () => {
        try { mainButton.offClick(stableOnClick); } catch {}
      };
    }

    try {
      mainButton.setParams({
        text,
        isVisible: true,
        backgroundColor: color as `#${string}`,
        textColor: textColor as `#${string}`,
      });
      mainButton.onClick(stableOnClick);
    } catch {}

    return () => {
      try {
        mainButton.setParams({ isVisible: false });
        mainButton.offClick(stableOnClick);
      } catch {}
    };
  }, [text, color, textColor, stableOnClick]);
}
