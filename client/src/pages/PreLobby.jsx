import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "../contexts/GameContext";
import { useSocket } from "../contexts/SocketContext";
import { api } from "../utils/api";

const TEAMS = {
  1: "Ashford City", 2: "Greyhollow United", 3: "FC Dunmere",
  4: "Ravenport Athletic", 5: "Whitchurch Town", 6: "Ironbridge FC",
  7: "Morcastle Rovers", 8: "Stoneford Borough", 9: "Brackwell Wanderers", 10: "Holtwick County",
};

export default function PreLobby() {
  const { id } = useParams();
  const { state, dispatch } = useGame();
  const { socket } = useSocket();
  const nav = useNavigate();
  const [leagueData, setLeagueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  async function load() {
    try {
      const data = await api.getLeague(id);
      setLeagueData(data);
      dispatch({ type: "UPDATE_LEAGUE_STATE", data });
    } catch { }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("join:league", { leagueId: id, userId: state.userId });
    socket.on("player:joined", load);
    socket.on("league:started", () => nav(`/game/${id}`));
    return () => { socket.off("player:joined"); socket.off("league:started"); };
  }, [socket, id]);

  async function handleStart() {
    setStarting(true);
    try {
      await api.startLeague(id);
      nav(`/game/${id}`);
    } catch (e) {
      alert(e.message);
      setStarting(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center font-pixel text-npl-green text-xs">Loading...</div>;
  if (!leagueData) return <div className="min-h-screen flex items-center justify-center text-npl-red font-mono">League not found</div>;

  const { league, players } = leagueData;
  const humanPlayers = (players || []).filter(p => p.is_human);
  const aiPlayers = (players || []).filter(p => !p.is_human);
  const isHost = humanPlayers[0]?.user_id === state.userId;
  const canStart = humanPlayers.length >= 2;

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col items-center pt-12 px-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="font-pixel text-npl-gold text-lg mb-2 crt-glow">THE NORTHGATE PREMIER LEAGUE</div>
          <div className="font-mono text-gray-400 text-sm">Waiting for managers...</div>
        </div>

        {/* Share code */}
        <div className="panel mb-4 text-center">
          <div className="panel-header text-center">League Code — Share with your friend</div>
          <div className="font-pixel text-4xl text-npl-green tracking-[0.5em] crt-glow py-4">
            {league.code}
          </div>
          <button onClick={() => navigator.clipboard?.writeText(league.code)}
            className="btn-secondary text-xs mt-1">Copy Code</button>
        </div>

        {/* Human managers */}
        <div className="panel mb-4">
          <div className="panel-header">Human Managers ({humanPlayers.length}/2)</div>
          {humanPlayers.map(p => (
            <div key={p.user_id} className="flex items-center gap-3 py-2 border-b border-dark-border last:border-0">
              <div className="w-2 h-2 bg-npl-green rounded-full animate-pulse" />
              <span className="font-mono text-white">{p.user_name}</span>
              <span className="ml-auto text-gray-400 text-xs font-mono">{TEAMS[p.team_id]}</span>
              {p.user_id === state.userId && <span className="text-npl-green text-xs font-pixel">YOU</span>}
            </div>
          ))}
          {humanPlayers.length < 2 && (
            <div className="text-gray-600 font-mono text-xs pt-2 animate-pulse">
              Waiting for second manager to join...
            </div>
          )}
        </div>

        {/* AI teams */}
        <div className="panel mb-6">
          <div className="panel-header">AI Managers ({aiPlayers.length})</div>
          <div className="grid grid-cols-2 gap-1">
            {aiPlayers.map(p => (
              <div key={p.user_id} className="text-xs text-gray-500 font-mono py-1 flex items-center gap-2">
                <span className="text-gray-700">🤖</span>{TEAMS[p.team_id]}
              </div>
            ))}
          </div>
        </div>

        {/* Season info */}
        <div className="panel mb-6 grid grid-cols-3 gap-4 text-center">
          {[
            ["18", "Matchdays"],
            ["10", "Teams"],
            ["£100K", "Budget"],
          ].map(([val, label]) => (
            <div key={label}>
              <div className="font-pixel text-npl-gold text-lg crt-glow">{val}</div>
              <div className="text-xs text-gray-500 font-mono mt-1">{label}</div>
            </div>
          ))}
        </div>

        {isHost && (
          <button onClick={handleStart} disabled={!canStart || starting}
            className={`btn-primary w-full py-3 ${!canStart ? "opacity-40 cursor-not-allowed" : ""}`}>
            {starting ? "Starting..." : canStart ? "Start Season" : "Need 2 Managers to Start"}
          </button>
        )}
        {!isHost && (
          <div className="text-center font-mono text-gray-500 text-sm">
            Waiting for host to start the season...
          </div>
        )}
      </div>
    </div>
  );
}
