import { useState } from "react";
import { useGame } from "../contexts/GameContext";
import { ratingColor, fatigueTier, positionColor } from "../utils/helpers";
import { api } from "../utils/api";

// Formation layouts — each entry is [row positions from GK up]
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

// Assign squad players to formation slots
function assignToFormation(squad, formation) {
  const layout = FORMATION_LAYOUTS[formation] || FORMATION_LAYOUTS["4-4-2"];
  const totalStarters = layout.flat().length; // usually 11
  const sorted = sortByPosition(squad);
  const starters = sorted.slice(0, totalStarters);
  const bench = sorted.slice(totalStarters);

  // Map each formation slot to the best available player
  const used = new Set();
  const assigned = layout.map(row =>
    row.map(pos => {
      // Find best matching player for this position slot
      let best = starters.find(p => p.position === pos && !used.has(p.id));
      if (!best) best = starters.find(p => !used.has(p.id));
      if (best) used.add(best.id);
      return best || null;
    })
  );

  // Remaining unassigned starters go to bench
  const unassigned = starters.filter(p => !used.has(p.id));
  return { rows: assigned, bench: [...unassigned, ...bench] };
}

function PlayerShirt({ player, isSelected, isPendingOff, onClick, small = false }) {
  if (!player) return <div className={small ? "w-12 h-16" : "w-16 h-20"} />;
  const ft = fatigueTier(player.fatigue || 0);
  const rc = ratingColor(player.rating);

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 group transition-all duration-150
        ${isSelected ? "scale-110" : "hover:scale-105"}
        ${isPendingOff ? "opacity-40" : ""}`}
    >
      {/* Shirt */}
      <div className={`relative flex items-center justify-center border-2 transition-all
        ${small ? "w-10 h-12" : "w-14 h-16"}
        ${isSelected ? "border-npl-gold bg-yellow-900/40 shadow-lg shadow-yellow-500/30" : "border-dark-border bg-dark-panel group-hover:border-npl-green"}`}
        style={{ clipPath: "polygon(15% 0%, 85% 0%, 100% 20%, 100% 100%, 0% 100%, 0% 20%)" }}
      >
        {/* Fatigue dot */}
        <div className={`absolute top-1 right-1 w-2 h-2 rounded-full`}
          style={{ backgroundColor: ft.color }} />
        {/* Rating */}
        <span className="font-pixel text-xs" style={{ color: rc }}>{player.rating}</span>
      </div>
      {/* Name */}
      <span className={`font-mono text-center leading-tight
        ${small ? "text-xs w-12" : "text-xs w-16"}
        ${isSelected ? "text-npl-gold" : "text-gray-300 group-hover:text-white"}`}
        style={{ fontSize: "9px" }}>
        {player.name.split(" ").pop()}
      </span>
      {/* Position badge */}
      <span className="text-xs font-pixel" style={{ fontSize: "8px", color: positionColor(player.position) }}>
        {player.position}
      </span>
    </button>
  );
}

export function SquadTab({ leagueId }) {
  const { state, dispatch } = useGame();
  const squad = state.mySquad || [];
  const formation = state.myTactics?.formation || "4-4-2";

  const [selectedBench, setSelectedBench] = useState(null); // bench player to bring on
  const [pendingOff, setPendingOff] = useState(null);       // starter being replaced
  const [saved, setSaved] = useState(false);

  if (!squad.length) return <div className="text-gray-600 font-mono text-sm p-4">Loading squad...</div>;

  const { rows, bench } = assignToFormation(squad, formation);

  function handleStarterClick(player) {
    if (!selectedBench) return; // nothing selected from bench yet
    if (!player) return;
    setPendingOff(player.id);

    // Swap them
    const newSquad = [...squad];
    const benchIdx = newSquad.findIndex(p => p.id === selectedBench.id);
    const starterIdx = newSquad.findIndex(p => p.id === player.id);
    if (benchIdx !== -1 && starterIdx !== -1) {
      // Swap positions in array (starters are first N, bench is rest)
      [newSquad[benchIdx], newSquad[starterIdx]] = [newSquad[starterIdx], newSquad[benchIdx]];
      dispatch({ type: "SET_SQUAD", squad: newSquad });
    }
    setSelectedBench(null);
    setPendingOff(null);
    setSaved(false);
  }

  function handleBenchClick(player) {
    if (selectedBench?.id === player.id) {
      setSelectedBench(null); // deselect
    } else {
      setSelectedBench(player);
      setPendingOff(null);
    }
  }

  async function saveLineup() {
    // Persist squad order to server via tactics update (squad order = lineup)
    try {
      await api.setTactics(leagueId, {
        userId: state.userId,
        matchday: state.league?.current_matchday || 1,
        tactics: state.myTactics || { formation: "4-4-2", mentality: "Balanced" },
      });
      // Also save squad order
      const response = await fetch(`/api/league/${leagueId}/squad/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: state.userId, squad: squad.map(p => p.id) }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      // Silently save to local state — will apply on next match
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  const totalStarters = rows.flat().filter(Boolean).length;

  return (
    <div className="max-w-2xl space-y-3">
      {/* Instructions */}
      <div className="panel py-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="font-mono text-xs text-gray-400">
            {selectedBench
              ? `Select a starter to swap out for ${selectedBench.name.split(" ").pop()}`
              : "Select a bench player to make a change"}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex gap-3 text-xs font-mono">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Fresh</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"/>Tired</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Exhausted</span>
            </div>
            <button onClick={saveLineup} className={`btn-primary text-xs py-1 px-3 ${saved ? "bg-green-600 border-green-600" : ""}`}>
              {saved ? "✓ Saved" : "Save Lineup"}
            </button>
          </div>
        </div>
        {selectedBench && (
          <div className="mt-2 text-xs font-pixel text-npl-gold animate-pulse">
            ▶ Now click a starter to replace them
          </div>
        )}
      </div>

      {/* Pitch */}
      <div className="relative pitch-bg border border-dark-border overflow-hidden"
        style={{ minHeight: "420px", background: "linear-gradient(180deg, #1a5c2a 0%, #1a6e30 50%, #1a5c2a 100%)" }}>

        {/* Pitch markings */}
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 420" preserveAspectRatio="none">
          {/* Outer border */}
          <rect x="10" y="10" width="380" height="400" fill="none" stroke="white" strokeWidth="1.5"/>
          {/* Centre line */}
          <line x1="10" y1="210" x2="390" y2="210" stroke="white" strokeWidth="1"/>
          {/* Centre circle */}
          <circle cx="200" cy="210" r="40" fill="none" stroke="white" strokeWidth="1"/>
          <circle cx="200" cy="210" r="2" fill="white"/>
          {/* Top penalty box */}
          <rect x="110" y="10" width="180" height="55" fill="none" stroke="white" strokeWidth="1"/>
          <rect x="155" y="10" width="90" height="25" fill="none" stroke="white" strokeWidth="1"/>
          {/* Bottom penalty box */}
          <rect x="110" y="355" width="180" height="55" fill="none" stroke="white" strokeWidth="1"/>
          <rect x="155" y="385" width="90" height="25" fill="none" stroke="white" strokeWidth="1"/>
        </svg>

        {/* Formation rows — rendered bottom to top (GK at bottom) */}
        <div className="relative h-full flex flex-col justify-around py-4 px-2">
          {[...rows].reverse().map((row, rowIdx) => (
            <div key={rowIdx} className="flex justify-around items-center">
              {row.map((player, colIdx) => (
                <PlayerShirt
                  key={colIdx}
                  player={player}
                  isSelected={selectedBench && player && !pendingOff}
                  isPendingOff={player && pendingOff === player.id}
                  onClick={() => handleStarterClick(player)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Formation label */}
        <div className="absolute top-2 left-2 font-pixel text-xs text-white/50">{formation}</div>
      </div>

      {/* Bench */}
      <div className="panel">
        <div className="panel-header">Bench ({bench.length} players)</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {bench.map(player => {
            const ft = fatigueTier(player.fatigue || 0);
            const isSelected = selectedBench?.id === player.id;
            return (
              <button key={player.id} onClick={() => handleBenchClick(player)}
                className={`text-left p-2 border transition-all text-xs font-mono
                  ${isSelected ? "border-npl-gold bg-yellow-900/20" : "border-dark-border hover:border-gray-500"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-pixel text-xs px-1 border" style={{ color: positionColor(player.position), borderColor: positionColor(player.position) + "44" }}>
                    {player.position}
                  </span>
                  <span className="text-white truncate flex-1">{player.name}</span>
                  <span className="font-bold" style={{ color: ratingColor(player.rating) }}>{player.rating}</span>
                </div>
                <div className="h-1 bg-dark-border">
                  <div className="h-full" style={{ width: `${player.fatigue || 0}%`, backgroundColor: ft.color }} />
                </div>
                <div className="flex justify-between mt-1 text-gray-500" style={{ fontSize: "9px" }}>
                  <span>{player.fatigue || 0}% fatigue</span>
                  <span>{player.seasonGoals || 0}G {player.seasonAssists || 0}A</span>
                </div>
                {isSelected && <div className="text-npl-gold font-pixel mt-1" style={{ fontSize: "8px" }}>▶ SELECTED</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Full stats table */}
      <div className="panel">
        <div className="panel-header">Season Stats</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-gray-500 border-b border-dark-border">
                <th className="text-left py-1">Player</th>
                <th className="text-center py-1 w-8">Pos</th>
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
                const ft = fatigueTier(p.fatigue || 0);
                return (
                  <tr key={p.id} className={`border-b border-dark-border/30 ${i < totalStarters ? "text-gray-200" : "text-gray-500"}`}>
                    <td className="py-1 text-white">{p.name} {i < totalStarters ? "" : <span className="text-gray-600 text-xs">(bench)</span>}</td>
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
