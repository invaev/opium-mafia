import React, { useEffect, useState } from 'react';

interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info';
}

let _addToast: ((text: string, type?: ToastMessage['type']) => void) | null = null;

export function showToast(text: string, type: ToastMessage['type'] = 'success') {
  _addToast?.(text, type);
}

let _nextId = 0;

const Toast: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    _addToast = (text, type = 'success') => {
      const id = ++_nextId;
      setToasts((prev) => [...prev, { id, text, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2500);
    };
    return () => { _addToast = null; };
  }, []);

  if (toasts.length === 0) return null;

  const colors = {
    success: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)', text: '#4ADE80' },
    error: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', text: '#F87171' },
    info: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.3)', text: '#60A5FA' },
  };

  return (
    <div
      className="fixed left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 56px)' }}
    >
      {toasts.map((t) => {
        const c = colors[t.type];
        return (
          <div
            key={t.id}
            className="py-3 px-4 rounded-xl text-sm font-medium text-center animate-fade-in"
            style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
          >
            {t.text}
          </div>
        );
      })}
    </div>
  );
};

export default Toast;
