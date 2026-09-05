export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0D0D12',
          card: 'rgba(255,255,255,0.03)',
          border: 'rgba(255,255,255,0.06)',
          'border-light': 'rgba(255,255,255,0.1)',
          surface: 'rgba(255,255,255,0.04)',
        },
        primary: '#EF4444',
        accent: '#F59E0B',
        peaceful: '#3B82F6',
        mafia: '#EF4444',
        solo: '#F59E0B',
        success: '#22C55E',
        purple: '#8B5CF6',
        text: {
          primary: '#E8E8F0',
          secondary: '#8888A0',
          muted: '#5A5A70',
          dim: '#4A4A5A',
          link: '#60A5FA',
        },
      },
      fontFamily: {
        sans: ["'SF Pro Display'", '-apple-system', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'pulse-slow': 'pulse 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
