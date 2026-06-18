import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GameProvider, useGame } from "./contexts/GameContext";
import { SocketProvider } from "./contexts/SocketContext";
import LobbyPage from "./pages/LobbyPage";
import PreLobby from "./pages/PreLobby";
import GameHub from "./pages/GameHub";

function AppRoutes() {
  const { state } = useGame();
  return (
    <Routes>
      <Route path="/" element={
        state.leagueId ? <Navigate to={`/game/${state.leagueId}`} replace /> : <LobbyPage />
      } />
      <Route path="/lobby/:id" element={<PreLobby />} />
      <Route path="/game/:id" element={<GameHub />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <GameProvider>
      <SocketProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SocketProvider>
    </GameProvider>
  );
}
