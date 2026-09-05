import React from 'react';
import { avatarStyles } from '../store/userStore';

interface AvatarCircleProps {
  emoji?: string;
  letter?: string;
  photoUrl?: string;
  colorPair?: [string, string];
  colorIndex?: number;
  size?: number;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

const AvatarCircle: React.FC<AvatarCircleProps> = ({
  emoji,
  letter,
  photoUrl,
  colorPair,
  colorIndex = 0,
  size = 72,
  selected = false,
  onClick,
  className = '',
}) => {
  const colors = colorPair || avatarStyles[colorIndex]?.colors || avatarStyles[0].colors;

  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-center font-bold text-white select-none shrink-0 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: photoUrl
          ? `url(${photoUrl}) center/cover`
          : `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
        fontSize: size * 0.42,
        boxShadow: selected
          ? `0 0 0 3px #0D0D12, 0 0 0 5px ${colors[0]}, 0 8px 24px ${colors[0]}40`
          : `0 4px 16px ${colors[0]}30`,
        transition: 'all 0.25s ease',
        transform: selected ? 'scale(1.08)' : 'scale(1)',
      }}
    >
      {!photoUrl && (emoji || letter || '?')}
    </div>
  );
};

export default AvatarCircle;
