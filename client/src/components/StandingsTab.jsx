// ============================================================
// StandingsTab
// ============================================================
import { ratingColor, formatMoney, fatigueTier, positionColor } from "../utils/helpers";
import { useState, useEffect } from "react";
import { useGame } from "../contexts/GameContext";
import { api } from "../utils/api";

export function StandingsTab({ standings, myTeamId }) {
  if (!standings?.length) return <div className="text-gray-600 font-mono text-sm">No results yet — season starts Friday!</div>;
  return (
    <div className="panel max-w-2xl">
      <div className="panel-header">🏆 League Table</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-gray-500 border-b border-dark-border">
              <th className="text-left py-1 w-6">#</th>
              <th className="text-left py-1">Club</th>
              <th className="text-center py-1 w-8">P</th>
              <th className="text-center py-1 w-8">W</th>
              <th className="text-center py-1 w-8">D</th>
              <th className="text-center py-1 w-8">L</th>
              <th className="text-center py-1 w-10">GD</th>
              <th className="text-center py-1 w-8">Pts</th>
              <th className="text-center py-1 w-16">Fans</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => {
              const isMe = row.teamId === myTeamId;
              return (
                <tr key={row.teamId}
                  className={`border-b border-dark-border/50 ${isMe ? "bg-dark-hover text-npl-green" : i < 3 ? "text-npl-gold" : i >= standings.length - 2 ? "text-red-400/80" : "text-gray-300"}`}>
                  <td className="py-1.5 text-gray-500">{i + 1}</td>
                  <td className="py-1.5 font-pixel text-xs">{row.shortName || row.teamName} {isMe ? "◀" : ""}</td>
                  <td className="text-center py-1.5">{row.played}</td>
                  <td className="text-center py-1.5">{row.won}</td>
                  <td className="text-center py-1.5">{row.drawn}</td>
                  <td className="text-center py-1.5">{row.lost}</td>
                  <td className={`text-center py-1.5 ${row.goalDifference > 0 ? "text-green-400" : row.goalDifference < 0 ? "text-red-400" : ""}`}>
                    {row.goalDifference > 0 ? "+" : ""}{row.goalDifference}
                  </td>
                  <td className="text-center py-1.5 font-bold">{row.points}</td>
                  <td className="text-center py-1.5 text-blue-400">{row.fans ? `${(row.fans / 1000).toFixed(1)}K` : "10K"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-3 flex gap-4 text-xs font-mono text-gray-600">
          <span><span className="text-npl-gold">■</span> Top 3</span>
          <span><span className="text-red-400/80">■</span> Relegation</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SquadTab
// ============================================================
export function SquadTab({ leagueId }) {
  const { state } = useGame();
  const squad = state.mySquad || [];
  const [sortBy, setSortBy] = useState("position");

  const sorted = [...squad].sort((a, b) => {
    if (sortBy === "rating") return b.rating - a.rating;
    if (sortBy === "fatigue") return (b.fatigue || 0) - (a.fatigue || 0);
    if (sortBy === "goals") return (b.seasonGoals || 0) - (a.seasonGoals || 0);
    // position order
    const posOrder = ["GK","CB","LB","RB","DM","CM","LM","RM","CAM","LW","RW","ST"];
    return posOrder.indexOf(a.position) - posOrder.indexOf(b.position);
  });

  if (!squad.length) return <div className="text-gray-600 font-mono text-sm">Loading squad...</div>;

  return (
    <div className="panel max-w-3xl">
      <div className="panel-header flex items-center justify-between">
        <span>👥 My Squad ({squad.length} players)</span>
        <div className="flex gap-2">
          {["position","rating","fatigue","goals"].map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-2 py-1 text-xs font-mono border transition-colors
                ${sortBy === s ? "border-npl-green text-npl-green" : "border-dark-border text-gray-500 hover:text-gray-300"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {sorted.map((p, i) => {
          const ft = fatigueTier(p.fatigue || 0);
          return (
            <div key={p.id} className={`flex items-center gap-2 p-2 border border-dark-border text-xs font-mono hover:bg-dark-hover transition-colors ${i < 11 ? "" : "opacity-60"}`}>
              <span className="w-4 text-gray-600 text-right">{i + 1}</span>
              <span className="w-8 text-center font-pixel text-xs px-1" style={{ color: positionColor(p.position), border: `1px solid ${positionColor(p.position)}44` }}>{p.position}</span>
              <span className="flex-1 text-white">{p.name}</span>
              <span className="text-gray-500 w-6 text-center">{p.age}</span>
              <div className="flex gap-1 w-32">
                {[["ATK", p.stats?.attack], ["DEF", p.stats?.defense], ["MID", p.stats?.midfield]].map(([l, v]) => (
                  <div key={l} className="text-center">
                    <div className="text-gray-600 text-xs">{l}</div>
                    <div className="text-gray-300">{Math.floor(v || 0)}</div>
                  </div>
                ))}
              </div>
              <span className="w-8 text-center font-bold" style={{ color: ratingColor(p.rating) }}>{p.rating}</span>
              <div className="w-16">
                <div className="stat-bar">
                  <div className="stat-bar-fill" style={{ width: `${p.fatigue || 0}%`, backgroundColor: ft.color }} />
                </div>
                <div className={`text-xs ${ft.cls} text-center`}>{p.fatigue || 0}%</div>
              </div>
              <div className="w-12 text-center text-gray-500">
                {p.seasonGoals || 0}G {p.seasonAssists || 0}A
              </div>
              {i === 10 && (
                <div className="absolute right-2 text-gray-700 text-xs">— bench —</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// FixturesTab
// ============================================================
const TEAMS_MAP = {
  1: "Ashford City", 2: "Greyhollow United", 3: "FC Dunmere", 4: "Ravenport Athletic",
  5: "Whitchurch Town", 6: "Ironbridge FC", 7: "Morcastle Rovers", 8: "Stoneford Borough",
  9: "Brackwell Wanderers", 10: "Holtwick County",
};

export function FixturesTab({ fixtures, myTeamId }) {
  const [filter, setFilter] = useState("mine");
  const allFixtures = fixtures || [];
  const shown = filter === "mine"
    ? allFixtures.filter(f => f.home_team_id === myTeamId || f.away_team_id === myTeamId)
    : allFixtures;

  const byMatchday = {};
  shown.forEach(f => {
    if (!byMatchday[f.matchday]) byMatchday[f.matchday] = [];
    byMatchday[f.matchday].push(f);
  });

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex gap-2 mb-2">
        {["mine","all"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs font-mono border transition-colors
              ${filter === f ? "border-npl-green text-npl-green" : "border-dark-border text-gray-500 hover:text-gray-300"}`}>
            {f === "mine" ? "My Fixtures" : "All Fixtures"}
          </button>
        ))}
      </div>
      {Object.entries(byMatchday).sort((a, b) => Number(a[0]) - Number(b[0])).map(([md, fxs]) => (
        <div key={md} className="panel">
          <div className="panel-header">Matchday {md}</div>
          <div className="space-y-1">
            {fxs.map(f => {
              const isMe = f.home_team_id === myTeamId || f.away_team_id === myTeamId;
              return (
                <div key={f.id} className={`flex items-center gap-2 py-1.5 text-xs font-mono ${isMe ? "text-white" : "text-gray-400"}`}>
                  <span className="w-32 text-right">{TEAMS_MAP[f.home_team_id] || f.home_team_id}</span>
                  {f.played ? (
                    <span className="w-12 text-center font-pixel text-npl-gold">{f.home_goals}–{f.away_goals}</span>
                  ) : (
                    <span className="w-12 text-center text-gray-600">vs</span>
                  )}
                  <span className="w-32">{TEAMS_MAP[f.away_team_id] || f.away_team_id}</span>
                  {f.stats && (() => {
                    const stats = typeof f.stats === "string" ? JSON.parse(f.stats) : f.stats;
                    return <span className="ml-auto text-gray-600">Poss {stats.homePossession}%–{stats.awayPossession}%</span>;
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// MarketTab
// ============================================================
export function MarketTab({ leagueId, onPurchase }) {
  const { state } = useGame();
  const [buying, setBuying] = useState(null);
  const [selling, setSelling] = useState(false);
  const [selectedSell, setSelectedSell] = useState(null);
  const market = state.market || [];

  async function buyPlayer(player) {
    setBuying(player.id);
    try {
      const league = state.league;
      await api.buyPlayer(leagueId, {
        userId: state.userId,
        playerId: player.id,
        weekNumber: league?.current_week || 1,
      });
      onPurchase?.();
    } catch (e) { alert(e.message); }
    setBuying(null);
  }

  async function sellPlayer() {
    if (!selectedSell) return;
    try {
      await api.sellPlayer(leagueId, { userId: state.userId, playerId: selectedSell });
      onPurchase?.();
      setSelling(false); setSelectedSell(null);
    } catch (e) { alert(e.message); }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="panel">
        <div className="panel-header flex items-center justify-between">
          <span>💸 Transfer Market</span>
          <div className="flex items-center gap-3">
            <span className="font-pixel text-npl-gold text-xs">{formatMoney(state.myBudget)} budget</span>
            <button onClick={() => setSelling(!selling)} className="btn-secondary text-xs">
              {selling ? "Cancel" : "Sell Player"}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 font-mono mb-4">Market refreshes every Monday. Selling returns 60% of value.</p>

        {selling && (
          <div className="mb-4 border border-npl-red p-3">
            <div className="font-pixel text-xs text-npl-red mb-2">SELECT PLAYER TO SELL</div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {(state.mySquad || []).map(p => (
                <button key={p.id} onClick={() => setSelectedSell(p.id === selectedSell ? null : p.id)}
                  className={`w-full text-left text-xs font-mono p-2 border transition-colors
                    ${selectedSell === p.id ? "border-npl-red bg-red-900/20" : "border-dark-border hover:border-gray-500"}`}>
                  <span className="text-gray-400 mr-2">{p.position}</span>
                  <span className="text-white mr-2">{p.name}</span>
                  <span className="text-gray-500">Rating {p.rating}</span>
                  <span className="ml-auto float-right text-npl-gold">Sell: {formatMoney(Math.floor(p.value * 0.6))}</span>
                </button>
              ))}
            </div>
            {selectedSell && (
              <button onClick={sellPlayer} className="btn-danger w-full mt-2 text-xs">Confirm Sale</button>
            )}
          </div>
        )}

        {market.length === 0 ? (
          <div className="text-gray-600 font-mono text-sm text-center py-4">Market loading or no players available</div>
        ) : (
          <div className="space-y-1">
            {market.map(p => {
              const canAfford = state.myBudget >= p.value;
              return (
                <div key={p.id} className="flex items-center gap-2 p-2 border border-dark-border text-xs font-mono hover:bg-dark-hover transition-colors">
                  <span className="w-8 text-center font-pixel text-xs px-1" style={{ color: positionColor(p.position), border: `1px solid ${positionColor(p.position)}44` }}>{p.position}</span>
                  <div className="flex-1">
                    <div className="text-white">{p.name}</div>
                    <div className="text-gray-500">{p.club} · Age {p.age}</div>
                  </div>
                  <div className="flex gap-1 text-xs text-gray-400">
                    {[["A", p.stats?.attack], ["D", p.stats?.defense], ["M", p.stats?.midfield], ["P", p.stats?.pace]].map(([l, v]) => (
                      <span key={l}>{l}{Math.floor(v || 0)}</span>
                    ))}
                  </div>
                  <span className="w-8 text-center font-bold" style={{ color: ratingColor(p.rating) }}>{p.rating}</span>
                  <span className="w-16 text-right text-npl-gold">{formatMoney(p.value)}</span>
                  <button onClick={() => canAfford && buyPlayer(p)}
                    disabled={!canAfford || buying === p.id}
                    className={`px-2 py-1 text-xs border transition-colors
                      ${canAfford ? "border-npl-green text-npl-green hover:bg-npl-green hover:text-dark-bg" : "border-gray-700 text-gray-700 cursor-not-allowed"}`}>
                    {buying === p.id ? "..." : canAfford ? "Buy" : "£"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TacticsTab
// ============================================================
const FORMATIONS = ["4-4-2", "4-3-3", "3-5-2", "4-5-1", "5-3-2", "4-2-3-1"];
const MENTALITIES = ["Defensive", "Cautious", "Balanced", "Attacking", "Gegenpressing"];

const FORMATION_DESCRIPTIONS = {
  "4-4-2": "Classic balanced shape. Good defensive cover, two up front.",
  "4-3-3": "Attack-minded. High press, wide attackers create overloads.",
  "3-5-2": "Midfield control. Wing-backs provide width. Two strikers.",
  "4-5-1": "Compact defensive block. Hit on the counter with pacey striker.",
  "5-3-2": "Ultra solid. Three centre-backs. Win ugly.",
  "4-2-3-1": "Double pivot shields defence. CAM links play. One striker.",
};

const MENTALITY_DESCRIPTIONS = {
  Defensive: "Sit deep, defend compact. -8% attack, +10% defense.",
  Cautious: "Measured approach. Slight defensive bias.",
  Balanced: "Standard setup. No penalties or bonuses.",
  Attacking: "Push men forward. +6% attack, -5% defense.",
  Gegenpressing: "High energy press. +4% attack, +5% pace, -3% defense.",
};

export function TacticsTab({ leagueId }) {
  const { state, dispatch } = useGame();
  const [tactics, setTactics] = useState(state.myTactics || { formation: "4-4-2", mentality: "Balanced" });
  const [saved, setSaved] = useState(false);
  const league = state.league;

  async function saveTactics() {
    try {
      await api.setTactics(leagueId, {
        userId: state.userId,
        matchday: league?.current_matchday || 1,
        tactics,
      });
      dispatch({ type: "SET_TACTICS", tactics });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { alert(e.message); }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="panel">
        <div className="panel-header">🎯 Match Tactics — MD {league?.current_matchday || 1}</div>
        <p className="text-xs text-gray-500 font-mono mb-4">Set tactics before Friday 9PM EST. AI fills defaults if not set.</p>

        {/* Formation */}
        <div className="mb-4">
          <div className="font-pixel text-xs text-gray-400 mb-2">FORMATION</div>
          <div className="grid grid-cols-3 gap-2">
            {FORMATIONS.map(f => (
              <button key={f} onClick={() => setTactics(t => ({ ...t, formation: f }))}
                className={`p-2 border text-center transition-all ${tactics.formation === f ? "border-npl-green bg-dark-hover" : "border-dark-border hover:border-gray-500"}`}>
                <div className="font-pixel text-xs text-white mb-1">{f}</div>
                <div className="text-xs text-gray-500">{tactics.formation === f ? "✓ Selected" : ""}</div>
              </button>
            ))}
          </div>
          {FORMATION_DESCRIPTIONS[tactics.formation] && (
            <div className="mt-2 text-xs text-gray-400 font-mono border-l-2 border-npl-green pl-2">
              {FORMATION_DESCRIPTIONS[tactics.formation]}
            </div>
          )}
        </div>

        {/* Mentality */}
        <div className="mb-4">
          <div className="font-pixel text-xs text-gray-400 mb-2">MENTALITY</div>
          <div className="space-y-1">
            {MENTALITIES.map(m => (
              <button key={m} onClick={() => setTactics(t => ({ ...t, mentality: m }))}
                className={`w-full text-left p-2 border text-xs font-mono transition-all
                  ${tactics.mentality === m ? "border-npl-green bg-dark-hover text-npl-green" : "border-dark-border hover:border-gray-500 text-gray-300"}`}>
                <span className="font-pixel text-xs mr-2">{tactics.mentality === m ? "▶" : " "}</span>
                <span className="font-pixel">{m}</span>
                <span className="ml-2 text-gray-500">{MENTALITY_DESCRIPTIONS[m]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Active buffs preview */}
        {Object.keys(state.myBuffs || {}).length > 0 && (
          <div className="mb-4 border border-npl-gold/30 p-3">
            <div className="font-pixel text-xs text-npl-gold mb-2">ACTIVE BUFFS THIS FRIDAY</div>
            {Object.entries(state.myBuffs).map(([stat, val]) => (
              <div key={stat} className="flex justify-between text-xs font-mono">
                <span className="text-gray-400 uppercase">{stat}</span>
                <span className={val >= 0 ? "text-green-400" : "text-red-400"}>
                  {val >= 0 ? "+" : ""}{val.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}

        <button onClick={saveTactics} className="btn-primary w-full py-3">
          {saved ? "✓ Tactics Saved!" : "Save Tactics"}
        </button>
      </div>
    </div>
  );
}

export default StandingsTab;
