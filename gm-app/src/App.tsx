import React from 'react';
import { theme } from './theme';
import { useGameStore } from './store/gameStore';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './screens/Dashboard';
import { GameSetup } from './screens/GameSetup';
import { GameDetails } from './screens/GameDetails';
import { Lobby } from './screens/Lobby';
import { Night0 } from './screens/Night0';
import { NightPhase } from './screens/NightPhase';
import { DayAnnounce } from './screens/DayAnnounce';
import { DayOpium } from './screens/DayOpium';
import { DayDefense } from './screens/DayDefense';
import { Voting } from './screens/Voting';
import { LastWord } from './screens/LastWord';
import { GameEnd } from './screens/GameEnd';
import { Players } from './screens/Players';
import { Stats } from './screens/Stats';
import { Settings } from './screens/Settings';
import type { ScreenId } from './theme';

const screenMap: Record<ScreenId, React.FC> = {
  dashboard: Dashboard,
  gameSetup: GameSetup,
  gameDetails: GameDetails,
  lobby: Lobby,
  night0: Night0,
  nightPhase: NightPhase,
  dayAnnounce: DayAnnounce,
  dayOpium: DayOpium,
  dayDefense: DayDefense,
  voting: Voting,
  lastWord: LastWord,
  gameEnd: GameEnd,
  players: Players,
  stats: Stats,
  settings: Settings,
};

const App: React.FC = () => {
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);

  const ActiveScreen = screenMap[screen] || Dashboard;

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        background: theme.bg.primary,
        fontFamily: theme.font,
        color: theme.text.primary,
        overflow: 'hidden',
      }}
    >
      <Sidebar screen={screen} onNavigate={setScreen} />
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: theme.bg.secondary,
        }}
      >
        <ActiveScreen />
      </div>
    </div>
  );
};

export default App;
