import React from 'react';

interface PhaseBadgeProps {
  icon: string;
  label: string;
  color: string;
  sub?: string;
}

export const PhaseBadge: React.FC<PhaseBadgeProps> = ({ icon, label, color, sub }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ color, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
      {icon} {label}
    </div>
    {sub && (
      <div style={{ color: '#E8E8F0', fontSize: 20, fontWeight: 700, marginTop: 4 }}>{sub}</div>
    )}
  </div>
);
