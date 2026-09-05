import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: 24,
            background: '#0D0D12',
            color: '#fff',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>😵</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Что-то пошло не так
          </div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
            Попробуйте перезагрузить
          </div>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '10px 24px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #EF4444, #DC2626)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Попробовать снова
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
