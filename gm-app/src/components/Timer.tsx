import React, { useEffect, useRef, useState, useCallback } from 'react';
import { theme } from '../theme';

interface TimerProps {
  seconds?: number;
  label?: string;
  interactive?: boolean;
  autoStart?: boolean;
  onComplete?: () => void;
  presets?: number[];
}

export const Timer: React.FC<TimerProps> = ({
  seconds: initialSeconds = 0,
  label,
  interactive = false,
  autoStart = false,
  onComplete,
  presets = [300, 420, 60, 30],
}) => {
  const [time, setTime] = useState(initialSeconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStarted = useRef(false);

  useEffect(() => {
    if (!interactive) {
      setTime(initialSeconds);
    }
  }, [initialSeconds, interactive]);

  useEffect(() => {
    if (autoStart && !autoStarted.current && initialSeconds > 0) {
      autoStarted.current = true;
      setTime(initialSeconds);
      setRunning(true);
      intervalRef.current = setInterval(() => {
        setTime((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            setRunning(false);
            onComplete?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [autoStart, initialSeconds, onComplete]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setTime((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setRunning(false);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [onComplete]);

  const pause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  }, []);

  const reset = useCallback(
    (s?: number) => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setRunning(false);
      setTime(s ?? initialSeconds);
    },
    [initialSeconds]
  );

  const minutes = Math.floor(time / 60);
  const secs = time % 60;
  const danger = time <= 10 && time > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px',
          borderRadius: 14,
          background: danger ? 'rgba(239,68,68,0.1)' : theme.bg.card,
          border: `1px solid ${danger ? 'rgba(239,68,68,0.2)' : theme.border.default}`,
          animation: danger ? 'pulse 1s ease-in-out infinite' : 'none',
        }}
      >
        {label && (
          <span style={{ color: theme.text.dim, fontSize: 11, fontWeight: 600 }}>{label}</span>
        )}
        <span
          style={{
            color: danger ? '#EF4444' : theme.text.primary,
            fontSize: 28,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {minutes}:{String(secs).padStart(2, '0')}
        </span>
      </div>

      {interactive && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {!running ? (
            <button
              onClick={start}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: theme.accent.green,
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {'\u25B6'} {'\u0421\u0442\u0430\u0440\u0442'}
            </button>
          ) : (
            <button
              onClick={pause}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: theme.accent.orange,
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {'\u23F8'} {'\u041F\u0430\u0443\u0437\u0430'}
            </button>
          )}
          <button
            onClick={() => reset()}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: `1px solid ${theme.border.medium}`,
              background: 'transparent',
              color: theme.text.muted,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {'\u21BA'}
          </button>

          {presets.map((p) => (
            <button
              key={p}
              onClick={() => reset(p)}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: `1px solid ${theme.border.subtle}`,
                background: theme.bg.card,
                color: theme.text.dim,
                fontSize: 9,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {Math.floor(p / 60)}:{String(p % 60).padStart(2, '0')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
