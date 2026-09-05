import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { useGameStore } from '../store/gameStore';
import { ROLE_META } from '@shared/types';
import { hapticImpact, hapticNotification } from '../hooks/useHaptic';

const roleAbilities: Record<string, { night: string; special: string }> = {
  sheriff: {
    night: 'Проверяешь одного игрока. Узнаешь "Мафия" или "Мирный".',
    special: 'Предсмертный выстрел — можешь забрать одного проверенного мафиози.',
  },
  don: {
    night: 'Выбираешь жертву мафии. Громила делает убийство неблокируемым.',
    special: 'Для Комиссара выглядишь как "Мирный".',
  },
  mafia: {
    night: 'Просыпаешься вместе с мафией. Голосуешь за жертву.',
    special: 'Если Дон погиб — берешь на себя роль стреляющего.',
  },
  framer: {
    night: 'Подставляешь одного мирного — проверки покажут "Мафия".',
    special: 'Подстава действует до конца следующего дня. Можешь пасовать.',
  },
  enforcer: {
    night: 'Дон подключает тебя — жертву нельзя вылечить.',
    special: 'Одноразовая способность.',
  },
  doctor: {
    night: 'Выбираешь кого лечить — спасаешь от покушения мафии или Маньяка.',
    special: 'Можешь лечить себя. Не спасает от Громилы.',
  },
  hooker: {
    night: 'Блокируешь ночное действие одного игрока.',
    special: 'Нельзя блокировать одного и того же два раза подряд.',
  },
  maniac: {
    night: 'Убиваешь одного игрока независимо от мафии.',
    special: 'Побеждаешь если остаешься один на один с последним выжившим.',
  },
  bodyguard: {
    night: 'Охраняешь одного игрока. При покушении — размен.',
    special: 'Погибаешь вместо него, но забираешь нападавшего. Одноразово.',
  },
  seer: {
    night: 'Сравниваешь двух игроков — из одной команды или нет.',
    special: 'Не узнаешь конкретные роли. Подставщик может повлиять.',
  },
  werewolf: {
    night: 'С 3 ночи убиваешь одного игрока за ночь.',
    special: 'Побеждаешь если остаешься последним. Для Комиссара — "Мирный".',
  },
  civilian: {
    night: 'Нет ночного действия.',
    special: 'Твоя сила — наблюдательность, логика и голос.',
  },
};

const teamNames: Record<string, string> = {
  peaceful: 'Команда мирных',
  mafia: 'Команда мафии',
  solo: 'Одиночка',
};

const teamColors: Record<string, string> = {
  peaceful: '#3B82F6',
  mafia: '#EF4444',
  solo: '#F59E0B',
};

const RoleReveal: React.FC = () => {
  const navigate = useNavigate();
  const { activeGame, roleRevealed, setRoleRevealed } = useGameStore();
  const [revealed, setRevealed] = useState(roleRevealed);

  if (!activeGame) {
    navigate('/');
    return null;
  }

  const role = activeGame.role || 'sheriff';
  const meta = ROLE_META[role as keyof typeof ROLE_META] || ROLE_META.civilian;
  const abilities = roleAbilities[role] || roleAbilities.civilian;
  const tColor = teamColors[meta.team] || '#3B82F6';

  const handleReveal = () => {
    setRevealed(true);
    setRoleRevealed(true);
    hapticImpact('heavy');
    setTimeout(() => hapticNotification('success'), 300);
  };

  return (
    <div>
      <BackButton label="Главная" to="/" />
      <div className="px-5 py-10 flex flex-col items-center justify-center min-h-[680px]">
        {!revealed ? (
          <div onClick={handleReveal} className="cursor-pointer text-center">
            <div
              className="w-[200px] h-[280px] rounded-[20px] flex items-center justify-center mx-auto animate-pulse-card"
              style={{
                background: 'linear-gradient(135deg, #1E1E2E 0%, #2A2A45 50%, #1E1E2E 100%)',
                border: '2px solid rgba(255,255,255,0.1)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
            >
              <div className="text-5xl">🃏</div>
            </div>
            <div className="text-text-secondary text-[15px] mt-6 font-medium">
              Нажми чтобы увидеть роль
            </div>
            <div className="text-text-muted text-xs mt-2">
              Не показывай другим!
            </div>
          </div>
        ) : (
          <div className="text-center animate-fade-in">
            <div
              className="w-[260px] rounded-3xl p-8 px-6 mx-auto"
              style={{
                background: `linear-gradient(180deg, ${meta.color}15 0%, ${meta.color}08 50%, ${meta.color}15 100%)`,
                border: `2px solid ${tColor}30`,
                boxShadow: `0 20px 60px ${tColor}15, 0 0 100px ${tColor}05 inset`,
              }}
            >
              <div className="text-[64px] mb-4">{meta.icon}</div>
              <div className="text-[26px] font-extrabold text-text-primary tracking-wide">
                {meta.nameRu.toUpperCase()}
              </div>
              <div
                className="mt-2 text-[13px] font-semibold tracking-[2px] uppercase"
                style={{ color: tColor }}
              >
                {teamNames[meta.team]}
              </div>

              <div
                className="mt-5 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${tColor}30, transparent)` }}
              />

              <div className="mt-5 text-text-secondary text-[13px] leading-relaxed text-left">
                <strong className="text-[#C0C0D0]">Ночью:</strong> {abilities.night}
              </div>
              <div className="mt-3 text-text-secondary text-[13px] leading-relaxed text-left">
                <strong className="text-[#C0C0D0]">Особенность:</strong> {abilities.special}
              </div>

              <div
                className="mt-5 py-3 px-4 rounded-xl"
                style={{
                  background: `${tColor}10`,
                  border: `1px solid ${tColor}15`,
                }}
              >
                <div className="text-xs italic" style={{ color: tColor }}>
                  &laquo;{meta.phrase}&raquo;
                </div>
              </div>
            </div>
            <div className="text-text-muted text-xs mt-5">
              🔒 Только ты видишь эту карту
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleReveal;
