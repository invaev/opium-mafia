import React, { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useGameStore } from './store/gameStore';
import { useUserStore } from './store/userStore';
import { wsService } from './services/ws';
import { getTelegramUser, getInitDataRaw } from './lib/telegram';
import { api } from './services/api';
import { mapGames } from './utils/mapGames';
import TabBar from './components/TabBar';
import Toast from './components/Toast';
import TelegramGate from './components/TelegramGate';

import Welcome from './screens/Welcome';
import Register from './screens/Register';
import AvatarPicker from './screens/AvatarPicker';
import Home from './screens/Home';
import GameList from './screens/GameList';
import GameDetails from './screens/GameDetails';
import RoleReveal from './screens/RoleReveal';
import Rules from './screens/Rules';
import GameEnd from './screens/GameEnd';
import Profile from './screens/Profile';
import EditProfile from './screens/EditProfile';
import Leaderboard from './screens/Leaderboard';
import History from './screens/History';
import Banned from './screens/Banned';

const tabBarScreens = ['/', '/games', '/profile', '/leaderboard', '/edit-profile', '/history'];

function shouldShowTabBar(pathname: string): boolean {
  return tabBarScreens.includes(pathname) || pathname.startsWith('/game/');
}

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isRegistered, isBanned, isLoading, token, setAuthenticated, setRegistered, setBanned, setLoading, logout, initFromTelegram } = useAuthStore();
  const activeGame = useGameStore((s) => s.activeGame);
  const setActiveGame = useGameStore((s) => s.setActiveGame);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const updateAvatar = useUserStore((s) => s.updateAvatar);

  useEffect(() => {
    localStorage.removeItem('opium-auth');

    const authenticateWithServer = async () => {
      const tgUser = getTelegramUser();
      if (tgUser) {
        initFromTelegram({
          id: tgUser.id,
          firstName: tgUser.firstName,
          lastName: tgUser.lastName,
          username: tgUser.username,
          photoUrl: tgUser.photoUrl,
          languageCode: tgUser.languageCode,
        });
      }

      const initDataRaw = getInitDataRaw();
      if (initDataRaw) {
        try {
          const result = await api.authenticate(initDataRaw);
          if (result.banned) {
            setBanned(result.banReason);
            return;
          }
          if (result.token) {
            api.setToken(result.token);
            if (result.user?.id) {
              const serverUser = result.user as Record<string, unknown>;
              const profileUpdate: Record<string, unknown> = { id: serverUser.id as number };

              if (serverUser.displayName) profileUpdate.name = serverUser.displayName;
              if (serverUser.nickname) profileUpdate.nickname = serverUser.nickname;
              if (serverUser.instagramUsername !== undefined) profileUpdate.instagramUsername = serverUser.instagramUsername;
              if (serverUser.dateOfBirth !== undefined) profileUpdate.dateOfBirth = serverUser.dateOfBirth;
              if (serverUser.gender !== undefined) profileUpdate.gender = serverUser.gender;
              if (serverUser.bio !== undefined) profileUpdate.bio = serverUser.bio;
              if (serverUser.totalRating !== undefined) profileUpdate.rating = serverUser.totalRating;

              updateProfile(profileUpdate as any);

              const currentAvatar = useUserStore.getState().profile?.avatar;
              if (serverUser.avatarEmoji) {
                updateAvatar({
                  type: 'emoji',
                  emoji: serverUser.avatarEmoji as string,
                  colorIndex: (serverUser.avatarColorIndex as number) ?? currentAvatar?.colorIndex ?? 0,
                });
              } else if (serverUser.avatarUrl) {
                if (!currentAvatar || (currentAvatar.type !== 'emoji' || !currentAvatar.emoji)) {
                  updateAvatar({
                    type: 'photo',
                    photoUrl: serverUser.avatarUrl as string,
                    colorIndex: (serverUser.avatarColorIndex as number) ?? currentAvatar?.colorIndex ?? 0,
                  });
                }
              }
            }
            if (result.registered) {
              setAuthenticated(result.token);
              setRegistered();
            } else {
              setAuthenticated(result.token);
              navigate('/welcome');
            }
            return;
          }
        } catch (err) {
          console.error('Server auth failed:', err);
        }
      }

      const existingToken = useAuthStore.getState().token;
      const alreadyRegistered = useAuthStore.getState().isRegistered;
      if (existingToken) {
        api.setToken(existingToken);
        if (alreadyRegistered) {
          setAuthenticated(existingToken);
        } else {
          setAuthenticated(existingToken);
          navigate('/welcome');
        }
      } else {
        setLoading(false);
      }
    };

    authenticateWithServer();
  }, []);

  const setGames = useGameStore((s) => s.setGames);
  const setGameEnd = useGameStore((s) => s.setGameEnd);

  const findActiveGameAndAssignRole = async (roleData: { role: string; team: string }) => {
    let currentGames = useGameStore.getState().games;
    let activeG = currentGames.find((g: any) => g.status === 'active');

    if (!activeG) {
      try {
        const data = await api.getGames();
        const mapped = mapGames(data as any[]);
        setGames(mapped);
        activeG = mapped.find((g: any) => g.status === 'active');
      } catch {  }
    }

    setActiveGame({
      id: activeG?.id || 0,
      title: activeG?.title || 'Mafia Game',
      place: activeG?.place || '',
      role: roleData.role as any,
      team: roleData.team as any,
    });
    useGameStore.getState().setRoleRevealed(false);
    navigate('/role-reveal');
  };

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    wsService.connect(token);

    const unsubscribe = wsService.subscribe((event) => {
      switch (event.type) {
        case 'role:assigned': {
          const roleData = event.data as { role: string; team: string; teammates?: number[] };
          findActiveGameAndAssignRole(roleData);
          break;
        }
        case 'game:ended': {
          const endData = event.data as any;
          if (endData?.ratingBreakdown) {
            setGameEnd(endData);
          }
          navigate('/game-end');
          break;
        }
        case 'player:joined':
        case 'player:left':
        case 'games:refresh':
          api.getGames().then((data) => {
            setGames(mapGames(data as any[]));
          }).catch(() => {});
          break;
        case 'rating:updated':
          updateProfile({ rating: event.data.total });
          break;
      }
    });

    return () => {
      unsubscribe();
      wsService.disconnect();
    };
  }, [isAuthenticated, token]);

  const isReady = isAuthenticated && isRegistered;
  const showTabBar = shouldShowTabBar(location.pathname) && isReady;

  if (isLoading) {
    return (
      <TelegramGate>
        <div className="bg-dark-bg flex flex-col font-sans h-full items-center justify-center">
          <div className="text-text-muted text-sm">Loading...</div>
        </div>
      </TelegramGate>
    );
  }

  if (isBanned) {
    return (
      <TelegramGate>
        <div className="bg-dark-bg flex flex-col font-sans h-full">
          <Banned />
        </div>
      </TelegramGate>
    );
  }

  return (
    <TelegramGate>
    <div
      className="bg-dark-bg flex flex-col font-sans h-full"
    >
      <Toast />
      <div className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/welcome" element={isReady ? <Navigate to="/" /> : <Welcome />} />
          <Route path="/register" element={isReady ? <Navigate to="/" /> : <Register />} />
          <Route path="/avatar-picker" element={<AvatarPicker />} />

          <Route path="/" element={isReady ? <Home /> : <Navigate to="/welcome" />} />
          <Route path="/games" element={isReady ? <GameList /> : <Navigate to="/welcome" />} />
          <Route path="/game/:id" element={isReady ? <GameDetails /> : <Navigate to="/welcome" />} />
          <Route path="/role-reveal" element={isReady ? <RoleReveal /> : <Navigate to="/welcome" />} />
          <Route path="/rules" element={isReady ? <Rules /> : <Navigate to="/welcome" />} />
          <Route path="/game-end" element={isReady ? <GameEnd /> : <Navigate to="/welcome" />} />
          <Route path="/profile" element={isReady ? <Profile /> : <Navigate to="/welcome" />} />
          <Route path="/edit-profile" element={isReady ? <EditProfile /> : <Navigate to="/welcome" />} />
          <Route path="/leaderboard" element={isReady ? <Leaderboard /> : <Navigate to="/welcome" />} />
          <Route path="/history" element={isReady ? <History /> : <Navigate to="/welcome" />} />

          <Route path="*" element={<Navigate to={isReady ? '/' : '/welcome'} />} />
        </Routes>
      </div>
      {showTabBar && <TabBar />}
    </div>
    </TelegramGate>
  );
};

export default App;
