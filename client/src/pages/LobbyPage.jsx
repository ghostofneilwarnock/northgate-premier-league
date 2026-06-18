import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../contexts/GameContext";
import { api } from "../utils/api";

const TEAMS = [
  { id: 1, name: "Ashford City", identity: "All-round title contenders", stats: "ATK 82 DEF 80 MID 82", colors: "#1a3a5c" },
  { id: 2, name: "Greyhollow United", identity: "Attack-minded, defensively vulnerable", stats: "ATK 86 DEF 68 MID 76", colors: "#c0392b" },
  { id: 3, name: "FC Dunmere", identity: "Defensive grinders, hard to beat", stats: "ATK 68 DEF 86 MID 74", colors: "#27ae60" },
  { id: 4, name: "Ravenport Athletic", identity: "Pace merchants, transition threat", stats: "ATK 76 DEF 72 PAC 86", colors: "#2c3e50" },
  { id: 5, name: "Whitchurch Town", identity: "Midfield maestros, possession-based", stats: "ATK 72 DEF 74 MID 86", colors: "#8e44ad" },
  { id: 6, name: "Ironbridge FC", identity: "Physical, set piece specialists", stats: "ATK 78 DEF 76 SET 86", colors: "#e67e22" },
  { id: 7, name: "Morcastle Rovers", identity: "Counter-attack specialists", stats: "ATK 74 DEF 78 PAC 82", colors: "#16a085" },
  { id: 8, name: "Stoneford Borough", identity: "Inconsistent wildcard, streaky form", stats: "ATK 76 DEF 70 MID 76", colors: "#2980b9" },
  { id: 9, name: "Brackwell Wanderers", identity: "Scrappy underdogs, high energy", stats: "ATK 70 DEF 72 PAC 78", colors: "#c0392b" },
  { id: 10, name: "Holtwick County", identity: "Relegation battlers, never say die", stats: "ATK 68 DEF 70 MID 68", colors: "#27ae60" },
];

export default function LobbyPage() {
  const { state, dispatch } = useGame();
  const nav = useNavigate();
  const [tab, setTab] = useState("create"); // create | join
  const [userName, setUserName] = useState(state.userName || "");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!userName.trim()) { setError("Enter your manager name"); return; }
    if (!selectedTeam) { setError("Select a team"); return; }
    setLoading(true); setError("");
    try {
      const res = await api.createLeague({ userName: userName.trim(), teamId: selectedTeam, userId: state.userId });
      dispatch({ type: "SET_USER", userId: state.userId, userName: userName.trim() });
      dispatch({ type: "SET_LEAGUE", leagueId: res.leagueId, teamId: res.teamId });
      localStorage.setItem("npl_user", JSON.stringify({ userId: state.userId, userName: userName.trim() }));
      localStorage.setItem("npl_league", JSON.stringify({ leagueId: res.leagueId, teamId: res.teamId }));
      nav(`/lobby/${res.leagueId}`);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function handleJoin() {
    if (!userName.trim()) { setError("Enter your manager name"); return; }
    if (!selectedTeam) { setError("Select a team"); return; }
    if (!joinCode.trim()) { setError("Enter league code"); return; }
    setLoading(true); setError("");
    try {
      const res = await api.joinLeague({ code: joinCode.toUpperCase(), userName: userName.trim(), teamId: selectedTeam, userId: state.userId });
      dispatch({ type: "SET_USER", userId: state.userId, userName: userName.trim() });
      dispatch({ type: "SET_LEAGUE", leagueId: res.leagueId, teamId: res.teamId });
      localStorage.setItem("npl_user", JSON.stringify({ userId: state.userId, userName: userName.trim() }));
      localStorage.setItem("npl_league", JSON.stringify({ leagueId: res.leagueId, teamId: res.teamId }));
      nav(`/lobby/${res.leagueId}`);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-start pt-8 px-4 pb-16">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="font-pixel text-npl-green text-lg mb-1 crt-glow tracking-widest">⚽ NPL</div>
        <h1 className="font-pixel text-npl-gold text-xl mb-2 crt-glow">NORTHGATE PREMIER LEAGUE</h1>
        <p className="font-mono text-gray-400 text-sm">Text-based multiplayer football management</p>
        <div className="mt-2 font-mono text-xs text-gray-600">
          Matches every Friday 9PM EST · Events Mon–Thu · Market refreshes Monday
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex mb-6 border border-dark-border">
        {["create","join"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-6 py-2 font-pixel text-xs uppercase tracking-widest transition-colors ${tab === t ? "bg-npl-green text-dark-bg" : "text-gray-400 hover:text-npl-green"}`}>
            {t === "create" ? "New League" : "Join League"}
          </button>
        ))}
      </div>

      <div className="w-full max-w-3xl space-y-4">
        {/* Manager name */}
        <div className="panel">
          <div className="panel-header">Manager Name</div>
          <input
            value={userName}
            onChange={e => setUserName(e.target.value)}
            placeholder="e.g. Bobby Sadberry"
            className="w-full bg-dark-bg border border-dark-border text-gray-100 font-mono px-3 py-2 text-sm focus:border-npl-green outline-none"
          />
        </div>

        {/* Join code (join tab only) */}
        {tab === "join" && (
          <div className="panel">
            <div className="panel-header">League Code</div>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. XK9P2"
              maxLength={5}
              className="w-full bg-dark-bg border border-dark-border text-npl-gold font-pixel text-lg px-3 py-2 tracking-widest focus:border-npl-green outline-none"
            />
          </div>
        )}

        {/* Team selector */}
        <div className="panel">
          <div className="panel-header">Choose Your Club</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TEAMS.map(t => (
              <button key={t.id} onClick={() => setSelectedTeam(t.id)}
                className={`text-left p-3 border transition-all duration-150 ${selectedTeam === t.id
                  ? "border-npl-green bg-dark-hover"
                  : "border-dark-border hover:border-gray-500"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-none" style={{ backgroundColor: t.colors }} />
                  <span className="font-pixel text-xs text-white">{t.name}</span>
                  {selectedTeam === t.id && <span className="ml-auto text-npl-green text-xs">✓</span>}
                </div>
                <div className="text-xs text-gray-400 mb-1">{t.identity}</div>
                <div className="text-xs text-gray-600 font-mono">{t.stats}</div>
              </button>
            ))}
          </div>
        </div>

        {error && <div className="text-npl-red font-mono text-sm px-1">⚠ {error}</div>}

        <button
          onClick={tab === "create" ? handleCreate : handleJoin}
          disabled={loading}
          className="btn-primary w-full py-3 text-sm">
          {loading ? "Loading..." : tab === "create" ? "Create League" : "Join League"}
        </button>
      </div>
    </div>
  );
}
