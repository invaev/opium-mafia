import React, { useState } from 'react';
import BackButton from '../components/BackButton';

interface RoleInfo {
  icon: string;
  name: string;
  team: string;
  color: string;
  teamColor: string;
  short: string;
  desc: string;
}

const roles: RoleInfo[] = [
  {
    icon: '🏠', name: 'Мирный житель', team: 'Мирные', color: '#94A3B8', teamColor: '#3B82F6',
    short: 'Голосуй днем, найди мафию',
    desc: 'Простой горожанин без специальных способностей. Твоя сила — наблюдательность и логика. Днем обсуждай, голосуй за подозрительных. Побеждаешь когда вся мафия устранена.',
  },
  {
    icon: '🔍', name: 'Комиссар', team: 'Мирные', color: '#3B82F6', teamColor: '#3B82F6',
    short: 'Проверяй одного игрока за ночь',
    desc: 'Каждую ночь проверяешь одного игрока — узнаешь "Мафия" или "Мирный". Подставщик может подделать результат. При гибели — предсмертный выстрел: можешь забрать одного проверенного мафиози с собой.',
  },
  {
    icon: '💊', name: 'Доктор', team: 'Мирные', color: '#22C55E', teamColor: '#3B82F6',
    short: 'Лечи одного игрока за ночь',
    desc: 'Каждую ночь выбираешь кого лечить — спасаешь от покушения мафии или Маньяка. Можно лечить одного и того же игрока максимум 2 раза подряд, в том числе себя. Не спасает от Громилы.',
  },
  {
    icon: '👁️', name: 'Провидец', team: 'Мирные', color: '#06B6D4', teamColor: '#3B82F6',
    short: 'Сравни двух игроков — одна команда или нет',
    desc: 'Каждую ночь выбираешь двух игроков и узнаешь из одной они команды или нет. Не узнаешь конкретные роли. Подставщик НЕ влияет на результат Провидца — видишь истинные команды.',
  },
  {
    icon: '💋', name: 'Любовница', team: 'Мирные', color: '#EC4899', teamColor: '#3B82F6',
    short: 'Блокируй ночное действие одного игрока',
    desc: 'Каждую ночь блокируешь одного игрока — его ночное действие отменяется. Если заблокировала мафиози — покушение все равно происходит (стреляет другой). При блокировке Дона мафия теряет ход. Нельзя блокировать одного и того же два раза подряд.',
  },
  {
    icon: '🛡️', name: 'Телохранитель', team: 'Мирные', color: '#D97706', teamColor: '#3B82F6',
    short: 'Защити ценой своей жизни',
    desc: 'Каждую ночь охраняешь одного игрока (не себя, и не того же что прошлой ночью). Если мафия покушается на охраняемого — ты погибаешь вместо него, но забираешь одного мафиози с собой. Не защищает от Громилы и Маньяка.',
  },
  {
    icon: '🎩', name: 'Дон мафии', team: 'Мафия', color: '#DC2626', teamColor: '#EF4444',
    short: 'Глава мафии, выбирает жертву',
    desc: 'Лидер мафии. Ночью выбирает кого убить. Знает всех членов своей команды. Побеждает когда мафия в равенстве или большинстве с мирными.',
  },
  {
    icon: '🔫', name: 'Рядовой мафиози', team: 'Мафия', color: '#EF4444', teamColor: '#EF4444',
    short: 'Член мафии, голосует ночью',
    desc: 'Знает всех в своей команде. Ночью просыпается вместе с мафией. Если Дон погиб — рядовой берет на себя роль стреляющего.',
  },
  {
    icon: '🎭', name: 'Подставщик', team: 'Мафия', color: '#F97316', teamColor: '#EF4444',
    short: 'Подставь мирного — проверки покажут "Мафия"',
    desc: 'Действует только в чётные ночи (2, 4, 6...). Подставляешь одного мирного — до конца следующего дня Комиссар будет видеть его как мафию. На Провидца подстава НЕ влияет. Если остался последним мафиози — подстава невозможна, только стрельба.',
  },
  {
    icon: '💪', name: 'Громила', team: 'Мафия', color: '#991B1B', teamColor: '#EF4444',
    short: 'Убей без возможности спасения',
    desc: 'Одноразовая способность: Дон подключает Громилу к покушению — жертву невозможно спасти ни Доктором, ни Телохранителем. Если Громилу или Дона заблокировала Любовница — способность сохраняется на следующую ночь.',
  },
  {
    icon: '🔪', name: 'Маньяк', team: 'Мирные', color: '#F97316', teamColor: '#3B82F6',
    short: 'Независимый убийца на стороне мирных',
    desc: 'Независимый убийца на стороне мирных. Каждую ночь убивает одного игрока отдельно от мафии. Побеждает вместе с мирными когда вся мафия устранена. Доктор может спасти его жертву. Для Комиссара — "Мирный".',
  },
  {
    icon: '🐺', name: 'Оборотень', team: 'Мафия', color: '#8B5CF6', teamColor: '#EF4444',
    short: 'Спящий агент — активируется когда мафия погибнет',
    desc: 'До активации — мирный: иммунен к покушению мафии, для Комиссара — "Мирный". Активируется когда вся мафия погибает. После активации — становится мафией: убивает каждую ночь, для Комиссара — "Мафия". Побеждает если остаётся 1 на 1 с мирным. Появляется при 17+ игроках.',
  },
];

const teams = ['Мирные', 'Мафия'] as const;
const teamColors: Record<string, string> = {
  'Мирные': '#3B82F6',
  'Мафия': '#EF4444',
};

const Rules: React.FC = () => {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      <BackButton label="Главная" to="/" />
      <div className="px-5 py-4">
        <div className="text-text-primary text-xl font-bold mb-1">
          Правила и роли
        </div>
        <div className="text-text-muted text-[13px] mb-5">
          Нажми на роль чтобы прочитать подробнее
        </div>

        {teams.map((team) => (
          <div key={team} className="mb-5">
            <div className="flex items-center gap-2 mb-2.5">
              <div
                className="w-[3px] h-4 rounded-sm"
                style={{ background: teamColors[team] }}
              />
              <span
                className="text-[13px] font-bold tracking-wide"
                style={{ color: teamColors[team] }}
              >
                {team.toUpperCase()}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {roles
                .filter((r) => r.team === team)
                .map((r, i) => {
                  const key = `${team}-${i}`;
                  const isOpen = expanded === key;

                  return (
                    <div
                      key={key}
                      onClick={() => setExpanded(isOpen ? null : key)}
                      className="rounded-[14px] overflow-hidden cursor-pointer transition-all duration-200"
                      style={{
                        background: isOpen ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isOpen ? `${r.color}30` : 'rgba(255,255,255,0.05)'}`,
                      }}
                    >
                      <div className="flex items-center gap-3 p-3 px-3.5">
                        <div
                          className="w-[38px] h-[38px] rounded-xl shrink-0 flex items-center justify-center text-lg"
                          style={{ background: `${r.color}18` }}
                        >
                          {r.icon}
                        </div>
                        <div className="flex-1">
                          <div className="text-text-primary text-sm font-semibold">{r.name}</div>
                          <div className="text-text-muted text-xs mt-0.5">{r.short}</div>
                        </div>
                        <span
                          className="text-text-dim text-xs transition-transform duration-200"
                          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)' }}
                        >
                          ›
                        </span>
                      </div>
                      {isOpen && (
                        <div className="px-3.5 pb-3.5 animate-fade-in">
                          <div
                            className="p-3 rounded-[10px]"
                            style={{
                              background: `${r.color}08`,
                              borderTop: `1px solid ${r.color}15`,
                            }}
                          >
                            <div className="text-[#A0A0B0] text-[13px] leading-relaxed">
                              {r.desc}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Rules;
