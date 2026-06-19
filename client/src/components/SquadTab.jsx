import { useState } from "react";
import { useGame } from "../contexts/GameContext";
import { ratingColor, fatigueTier, positionColor } from "../utils/helpers";
import { api } from "../utils/api";

const FORMATION_LAYOUTS = {
  "4-4-2":   [["GK"], ["LB","CB","CB","RB"], ["LM","CM","CM","RM"], ["ST","ST"]],
  "4-3-3":   [["GK"], ["LB","CB","CB","RB"], ["CM","CM","CM"], ["LW","ST","RW"]],
  "3-5-2":   [["GK"], ["CB","CB","CB"], ["LM","CM","DM","CM","RM"], ["ST","ST"]],
  "4-5-1":   [["GK"], ["LB","CB","CB","RB"], ["LM","CM","DM","CM","RM"], ["ST"]],
  "5-3-2":   [["GK"], ["LB","CB","CB","CB","RB"], ["CM","CM","CM"], ["ST","ST"]],
  "4-2-3-1": [["GK"], ["LB","CB","CB","RB"], ["DM","DM"], ["LW","CAM","RW"], ["ST"]],
};

const POS_ORDER = ["GK","CB","LB","RB","DM","CM","LM","RM","CAM","LW","RW","ST"];

function sortByPosition(players) {
  return [...players].sort((a, b) =>
    POS_ORDER.indexOf(a.position) - POS_ORDER.indexOf(b.position)
  );
}

// Returns { starterIds: string[], benchIds: string[] } based on formation
function getStarterIds(squad, formation) {
  const layout = FORMATION_LAYOUTS[formation] || FORMATION_LAYOUTS["4-4-2"];
  const totalStarters = layout.flat().length;
  const sorted = sortByPosition(squad);
  const starterIds = sorted.slice(0, totalStarters).map(p => p.id);
  const benchIds = sorted.slice(totalStarters).map(p => p.id);
  return { starterIds, benchIds };
}

// Assign starters to formation rows using their IDs
function buildRows(squad, starterIds, formation) {
  const layout = FORMATION_LAYOUTS[formation] || FORMATION_LAYOUTS["4-4-2"];
  const starters = starterIds.map(id => squad.find(p => p.id === id)).filter(Boolean);
  const used = new Set();

  const rows = layout.map(row =>
    row.map(pos => {
      let best = starters.find(p => p.position === pos && !used.has(p.id));
      if (!best) best = starters.find(p => !used.has(p.id));
      if (best) used.add(best.id);
      return best || null;
    })
  );
  return rows;
}

function PlayerShirt({ player, isSelected, onClick }) {
  if (!player) return <div className="w-14 h-20" />;
  const ft = fatigueTier(player.fatigue || 0);
  const rc = ratingColor(player.rating);

  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-0.5 group transition-all duration-150 cursor-pointer
        ${isSelected ? "scale-110" : "hover:scale-105"}`}>
      <div className={`relative flex items-center justify-center border-2 w-14 h-16 transition-all
        ${isSelected
          ? "border-npl-gold bg-yellow-900/40 shadow-lg shadow-yellow-500/30"
          : "border-dark-border bg-dark-panel group-hover:border-npl-green"}`}
        style={{ clipPath: "polygon(15% 0%, 85% 0%, 100% 20%, 100% 100%, 0% 100%, 0% 20%)" }}>
        <div className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ backgroundColor: ft.color }} />
        <span className="font-pixel text-xs" style={{ color: rc }}>{player.rating}</span>
      </div>
      <span className="font-mono text-center leading-tight text-gray-300 group-hover:text-white w-16"
        style={{ fontSize: "9px" }}>
        {player.name.split(" ").pop()}
      </span>
      <span className="font-pixel" style={{ fontSize: "8px", color: positionColor(player.position) }}>
        {player.position}
      </span>
    </button>
  );
}

export function SquadTab({ leagueId }) {
  const { state, dispatch } = useGame();
  const squad = state.mySquad || [];
  const formation = state.myTactics?.formation || "4-4-2";

  // Track selected bench player ID only
  const [selectedBenchId, setSelectedBenchId] = useState(null);
  const [saved, setSaved] = useState(false);

  if (!squad.length) return <div className="text-gray-600 font-mono text-sm p-4">Loading squad...</div>;

  // Derive starter/bench split from current squad order
  const { starterIds, benchIds } = getStarterIds(squad, formation);
  const rows = buildRows(squad, starterIds, formation);
  const bench = benchIds.map(id => squad.find(p => p.id === id)).filter(Boolean);

  const selectedBenchPlayer = selectedBenchId ? squad.find(p => p.id === selectedBenchId) : null;

  function handleStarterClick(player) {
    if (!player) return;
    if (!selectedBenchId) return;

    // Swap: put bench player where starter was, starter goes to bench
    const newSquad = [...squad];
    const benchIdx = newSquad.findIndex(p => p.id === selectedBenchId);
    const starterIdx = newSquad.findIndex(p => p.id === player.id);

    if (benchIdx === -1 || starterIdx === -1) {
      // Safety: can't find one of them, clear selection
      setSelectedBenchId(null);
      return;
    }

    // Swap in array
    const temp = newSquad[benchIdx];
    newSquad[benchIdx] = newSquad[starterIdx];
    newSquad[starterIdx] = temp;

    dispatch({ type: "SET_SQUAD", squad: newSquad });
    setSelectedBenchId(null);
    setSaved(false);
  }

  function handleBenchClick(player) {
    setSelectedBenchId(prev => prev === player.id ? null : player.id);
  }

  async function saveLineup() {
    try {
      await api.setTactics(leagueId, {
        userId: state.userId,
        matchday: state.league?.current_matchday || 1,
        tactics: state.myTactics || { formation: "4-4-2", mentality: "Balanced" },
      });
    } catch (e) { /* silent */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl space-y-3">
      {/* Instructions bar */}
      <div className="panel py-2 flex items-center justify-between flex-wrap gap-2">
        <span className="font-mono text-xs text-gray-400">
          {selectedBenchPlayer
            ? <span className="text-npl-gold font-pixel" style={{fontSize:"10px"}}>▶ Select a starter to swap with {selectedBenchPlayer.name.split(" ").pop()}</span>
            : "Click a bench player to swap them into the lineup"}
        </span>
        <div className="flex items-center gap-3">
          <div className="flex gap-3 text-xs font-mono">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Fresh</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"/>Tired</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Exhausted</span>
          </div>
          <button onClick={saveLineup}
            className={`btn-primary text-xs py-1 px-3 ${saved ? "bg-green-600 border-green-600" : ""}`}>
            {saved ? "✓ Saved" : "Save Lineup"}
          </button>
        </div>
      </div>

      {/* Pitch */}
      <div className="relative border border-dark-border overflow-hidden"
        style={{ minHeight: "420px", background: "linear-gradient(180deg, #1a5c2a 0%, #1a6e30 50%, #1a5c2a 100%)" }}>
        {/* Pitch markings */}
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 420" preserveAspectRatio="none">
          <rect x="10" y="10" width="380" height="400" fill="none" stroke="white" strokeWidth="1.5"/>
          <line x1="10" y1="210" x2="390" y2="210" stroke="white" strokeWidth="1"/>
          <circle cx="200" cy="210" r="40" fill="none" stroke="white" strokeWidth="1"/>
          <circle cx="200" cy="210" r="2" fill="white"/>
          <rect x="110" y="10" width="180" height="55" fill="none" stroke="white" strokeWidth="1"/>
          <rect x="155" y="10" width="90" height="25" fill="none" stroke="white" strokeWidth="1"/>
          <rect x="110" y="355" width="180" height="55" fill="none" stroke="white" strokeWidth="1"/>
          <rect x="155" y="385" width="90" height="25" fill="none" stroke="white" strokeWidth="1"/>
        </svg>

        {/* Formation rows — reversed so GK is at bottom */}
        <div className="relative h-full flex flex-col justify-around py-4 px-2" style={{ minHeight: "420px" }}>
          {[...rows].reverse().map((row, rowIdx) => (
            <div key={rowIdx} className="flex justify-around items-center">
              {row.map((player, colIdx) => (
                <PlayerShirt
                  key={player ? player.id : `empty-${rowIdx}-${colIdx}`}
                  player={player}
                  isSelected={!!selectedBenchPlayer && !!player}
                  onClick={() => handleStarterClick(player)}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="absolute top-2 left-2 font-pixel text-white/40" style={{ fontSize: "10px" }}>{formation}</div>
      </div>

      {/* Bench */}
      <div className="panel">
        <div className="panel-header">Bench — {bench.length} players</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {bench.map(player => {
            const ft = fatigueTier(player.fatigue || 0);
            const isSelected = selectedBenchId === player.id;
            return (
              <button key={player.id} onClick={() => handleBenchClick(player)}
                className={`text-left p-2 border transition-all font-mono
                  ${isSelected
                    ? "border-npl-gold bg-yellow-900/20"
                    : "border-dark-border hover:border-gray-500"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-pixel px-1 border" style={{ fontSize: "9px", color: positionColor(player.position), borderColor: positionColor(player.position) + "55" }}>
                    {player.position}
                  </span>
                  <span className="text-white text-xs truncate flex-1">{player.name}</span>
                  <span className="font-bold text-xs" style={{ color: ratingColor(player.rating) }}>{player.rating}</span>
                </div>
                <div className="h-1 bg-dark-border">
                  <div className="h-full" style={{ width: `${player.fatigue || 0}%`, backgroundColor: ft.color }} />
                </div>
                <div className="flex justify-between mt-1 text-gray-500" style={{ fontSize: "9px" }}>
                  <span>{player.fatigue || 0}% fatigue</span>
                  <span>{player.seasonGoals || 0}G {player.seasonAssists || 0}A</span>
                </div>
                {isSelected && <div className="text-npl-gold font-pixel mt-1" style={{ fontSize: "8px" }}>▶ SELECTED — click a starter to swap</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Season stats table */}
      <div className="panel">
        <div className="panel-header">Season Stats</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-gray-500 border-b border-dark-border">
                <th className="text-left py-1">Player</th>
                <th className="text-center py-1 w-10">Pos</th>
                <th className="text-center py-1 w-8">Rat</th>
                <th className="text-center py-1 w-8">App</th>
                <th className="text-center py-1 w-8">G</th>
                <th className="text-center py-1 w-8">A</th>
                <th className="text-center py-1 w-8">Y</th>
                <th className="text-center py-1 w-16">Fatigue</th>
              </tr>
            </thead>
            <tbody>
              {sortByPosition(squad).map((p, i) => {
                const isStarter = starterIds.includes(p.id);
                const ft = fatigueTier(p.fatigue || 0);
                return (
                  <tr key={p.id} className={`border-b border-dark-border/30 ${isStarter ? "text-gray-200" : "text-gray-500"}`}>
                    <td className="py-1">
                      <span className={isStarter ? "text-white" : "text-gray-500"}>{p.name}</span>
                      {!isStarter && <span className="ml-1 text-gray-700" style={{fontSize:"9px"}}>(bench)</span>}
                    </td>
                    <td className="text-center py-1" style={{ color: positionColor(p.position) }}>{p.position}</td>
                    <td className="text-center py-1 font-bold" style={{ color: ratingColor(p.rating) }}>{p.rating}</td>
                    <td className="text-center py-1">{p.seasonApps || 0}</td>
                    <td className="text-center py-1 text-npl-gold">{p.seasonGoals || 0}</td>
                    <td className="text-center py-1">{p.seasonAssists || 0}</td>
                    <td className="text-center py-1 text-yellow-400">{p.seasonYellows || 0}</td>
                    <td className="py-1">
                      <div className="h-1.5 bg-dark-border">
                        <div className="h-full" style={{ width: `${p.fatigue || 0}%`, backgroundColor: ft.color }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default SquadTab;
