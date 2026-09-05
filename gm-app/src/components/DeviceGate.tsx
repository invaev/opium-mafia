import React, { useEffect, useState } from 'react';
import { theme } from '../theme';

const API_URL = import.meta.env.VITE_API_URL || 'https://opium-server-production.up.railway.app';
const ACTIVATION_KEY = 'opium-gm-activation';

const ALLOWED_PLATFORMS = /iPad|Macintosh/i;

interface DeviceGateProps {
  children: React.ReactNode;
}

type GateState = 'loading' | 'blocked-device' | 'need-activation' | 'activated';

const DeviceGate: React.FC<DeviceGateProps> = ({ children }) => {
  const [state, setState] = useState<GateState>('loading');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) {
      setState('activated');
      return;
    }

    if (!ALLOWED_PLATFORMS.test(navigator.userAgent)) {
      setState('blocked-device');
      return;
    }

    verifyActivation();
  }, []);

  async function verifyActivation() {
    const storedToken = localStorage.getItem(ACTIVATION_KEY);
    if (!storedToken) {
      setState('need-activation');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/auth/gm-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activationToken: storedToken }),
      });

      if (res.ok) {
        setState('activated');
      } else {
        localStorage.removeItem(ACTIVATION_KEY);
        setState('need-activation');
      }
    } catch {
      setState('activated');
    }
  }

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/auth/gm-activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(ACTIVATION_KEY, data.activationToken);
        setState('activated');
      } else {
        setError('Invalid passphrase');
      }
    } catch {
      setError('Connection failed. Check your network.');
    } finally {
      setSubmitting(false);
    }
  }

  if (state === 'loading') {
    return (
      <div style={styles.container}>
        <div style={styles.text}>Loading...</div>
      </div>
    );
  }

  if (state === 'blocked-device') {
    return (
      <div style={styles.container}>
        <div style={styles.icon}>🚫</div>
        <div style={styles.title}>Access Denied</div>
        <div style={styles.text}>
          This app is restricted to authorized devices only.
        </div>
      </div>
    );
  }

  if (state === 'need-activation') {
    return (
      <div style={styles.container}>
        <div style={styles.icon}>🔐</div>
        <div style={styles.title}>Device Activation</div>
        <div style={styles.text}>
          Enter the passphrase to activate this device.
        </div>
        <form onSubmit={handleActivate} style={styles.form}>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Passphrase"
            style={styles.input}
            autoFocus
            autoComplete="off"
          />
          {error && <div style={styles.error}>{error}</div>}
          <button
            type="submit"
            disabled={submitting || !passphrase}
            style={{
              ...styles.button,
              opacity: submitting || !passphrase ? 0.5 : 1,
            }}
          >
            {submitting ? 'Verifying...' : 'Activate'}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    width: '100vw',
    background: theme.bg.primary,
    fontFamily: theme.font,
    color: theme.text.primary,
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 12,
  },
  text: {
    fontSize: 16,
    color: theme.text.secondary,
    marginBottom: 32,
    textAlign: 'center' as const,
    maxWidth: 400,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    width: 320,
  },
  input: {
    width: '100%',
    padding: '14px 18px',
    fontSize: 16,
    borderRadius: 12,
    border: `1px solid ${theme.border}`,
    background: theme.bg.secondary,
    color: theme.text.primary,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  error: {
    color: '#EF4444',
    fontSize: 14,
  },
  button: {
    width: '100%',
    padding: '14px 0',
    fontSize: 16,
    fontWeight: 600,
    borderRadius: 12,
    border: 'none',
    background: '#EF4444',
    color: '#fff',
    cursor: 'pointer',
  },
};

export default DeviceGate;
