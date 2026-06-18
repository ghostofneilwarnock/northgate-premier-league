import { StandingsTab as StandingsTab, SquadTab, FixturesTab, MarketTab, TacticsTab } from "../components/StandingsTab";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useGame } from "../contexts/GameContext";
import { useSocket } from "../contexts/SocketContext";
import { api } from "../utils/api";
import { formatMoney, formatFans, DAY_NAMES, DAY_EVENTS } from "../utils/helpers";




import EventsTab from "../components/EventsTab";

import LiveMatch from "../components/LiveMatch";

const TABS = [
  { id: "dashboard", label: "📊 Hub" },
  { id: "squad", label: "👥 Squad" },
  { id: "tactics", label: "🎯 Tactics" },
  { id: "market", label: "💸 Market" },
  { id: "fixtures", label: "📅 Fixtures" },
  { id: "standings", label: "🏆 Table" },
  { id: "events", label: "📆 Events" },
];

export default function GameHub() {
  const { id: leagueId } = useParams();
  const { state, dispatch } = useGame();
  const { socket } = useSocket();
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    try {
      const [leagueData, fixtures] = await Promise.all([
        api.getLeague(leagueId),
        api.getFixtures(leagueId),
      ]);
      dispatch({ type: "UPDATE_LEAGUE_STATE", data: { ...leagueData, fixtures } });

      if (state.teamId) {
        const [squad, market] = await Promise.all([
          api.getSquad(leagueId, state.teamId),
          api.getMarket(leagueId),
        ]);
        dispatch({ type: "SET_SQUAD", squad });
        dispatch({ type: "SET_MARKET", market });

        const lp = leagueData.players?.find(p => p.user_id === state.userId);
        if (lp) {
          dispatch({ type: "SET_BUDGET", budget: lp.budget });
          dispatch({ type: "SET_FANS", fans: lp.fans });
          dispatch({ type: "SET_BUFFS", buffs: JSON.parse(lp.buffs || "{}") });
          if (lp.tactics) dispatch({ type: "SET_TACTICS", tactics: JSON.parse(lp.tactics) });
        }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, [leagueId, state.teamId]);

  useEffect(() => {
    if (!socket || !leagueId) return;
    socket.emit("join:league", { leagueId, userId: state.userId });

    socket.on("match:started", () => {
      dispatch({ type: "MATCH_STARTED" });
      dispatch({ type: "CLEAR_LIVE" });
    });
    socket.on("match:event", (data) => dispatch({ type: "ADD_LIVE_EVENT", ...data }));
    socket.on("match:paused", (ps) => dispatch({ type: "SET_PAUSE_STATE", pauseState: ps }));
    socket.on("match:resumed", () => dispatch({ type: "SET_PAUSE_STATE", pauseState: null }));
    socket.on("match:completed", (data) => {
      dispatch({ type: "MATCH_COMPLETED" });
      loadAll();
    });
    socket.on("transfer:completed", () => loadAll());
    socket.on("market:refreshed", () => api.getMarket(leagueId).then(m => dispatch({ type: "SET_MARKET", market: m })));

    return () => {
      socket.off("match:started"); socket.off("match:event");
      socket.off("match:paused"); socket.off("match:resumed");
      socket.off("match:completed"); socket.off("transfer:completed");
      socket.off("market:refreshed");
    };
  }, [socket, leagueId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-pixel text-npl-green text-xs animate-pulse">Loading League...</div>;

  const estDay = new Date().toLocaleString("en-US", { timeZone: "America/New_York", weekday: "long" });
  const dayNum = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].indexOf(estDay);
  const todayEvent = DAY_EVENTS[dayNum];
  const league = state.league;

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      {/* Live match overlay */}
      {state.matchInProgress && <LiveMatch leagueId={leagueId} />}

      {/* Top bar */}
      <div className="border-b border-dark-border bg-dark-panel px-4 py-2 flex items-center gap-4 flex-wrap">
        <span className="font-pixel text-npl-green text-xs crt-glow">NPL</span>
        <span className="font-mono text-gray-400 text-xs">MD {league?.current_matchday || 1}/18</span>
        <span className="font-mono text-npl-gold text-xs">{formatMoney(state.myBudget)}</span>
        <span className="font-mono text-blue-400 text-xs">{formatFans(state.myFans)} fans</span>
        <span className="font-mono text-xs text-gray-600">
          {formatFans(Math.floor(state.myFans * 0.01))}/wk income
        </span>
        {todayEvent && (
          <span className="ml-auto font-mono text-xs text-purple-400">
            Today: {todayEvent}
          </span>
        )}
        <span className="font-mono text-xs text-gray-600 ml-auto">{estDay}</span>
      </div>

      {/* Active buffs ticker */}
      {Object.keys(state.myBuffs).length > 0 && (
        <div className="bg-dark-panel border-b border-dark-border px-4 py-1 flex gap-4">
          <span className="font-pixel text-xs text-npl-gold">ACTIVE BUFFS:</span>
          {Object.entries(state.myBuffs).map(([stat, val]) => (
            <span key={stat} className={`font-mono text-xs ${val >= 0 ? "text-green-400" : "text-red-400"}`}>
              {stat.toUpperCase()} {val >= 0 ? "+" : ""}{val.toFixed(1)}%
            </span>
          ))}
        </div>
      )}

      {/* Nav tabs */}
      <div className="flex border-b border-dark-border overflow-x-auto bg-dark-panel">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 font-mono text-xs whitespace-nowrap transition-colors border-r border-dark-border
              ${tab === t.id ? "bg-dark-hover text-npl-green border-b-2 border-b-npl-green" : "text-gray-400 hover:text-gray-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4">
        {tab === "dashboard" && <DashboardTab leagueId={leagueId} onTabChange={setTab} />}
        {tab === "standings" && <StandingsTab standings={state.standings} myTeamId={state.teamId} />}
        {tab === "squad" && <SquadTab leagueId={leagueId} />}
        {tab === "tactics" && <TacticsTab leagueId={leagueId} />}
        {tab === "market" && <MarketTab leagueId={leagueId} onPurchase={loadAll} />}
        {tab === "fixtures" && <FixturesTab leagueId={leagueId} fixtures={state.fixtures} myTeamId={state.teamId} />}
        {tab === "events" && <EventsTab leagueId={leagueId} onComplete={loadAll} />}
      </div>

      {/* Dev controls */}
      {import.meta.env.DEV && (
        <div className="border-t border-dark-border p-2 bg-dark-panel flex gap-2">
          <span className="font-mono text-xs text-gray-600">DEV:</span>
          <button onClick={() => api.triggerMatch(leagueId).catch(console.error)}
            className="font-mono text-xs text-purple-400 border border-purple-800 px-2 py-1 hover:bg-purple-900">
            Trigger Match
          </button>
        </div>
      )}
    </div>
  );
}

function DashboardTab({ leagueId, onTabChange }) {
  const { state } = useGame();
  const { standings, fixtures, myBuffs, myBudget, myFans, teamId } = state;

  const myStanding = standings.find(s => s.teamId === teamId);
  const myFixtures = fixtures.filter(f => f.home_team_id === teamId || f.away_team_id === teamId);
  const nextFixture = myFixtures.find(f => !f.played);
  const recentResults = myFixtures.filter(f => f.played).slice(-3);

  const weeklyIncome = Math.floor(myFans * 0.01);
  const estDay = new Date().toLocaleString("en-US", { timeZone: "America/New_York", weekday: "long" });
  const dayNum = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].indexOf(estDay);

  const daySchedule = [
    { day: 1, name: "Monday", event: "📰 Press Conference", buff: "+5% Defense" },
    { day: 2, name: "Tuesday", event: "🏋️ Fitness Session", buff: "+5% Pace" },
    { day: 3, name: "Wednesday", event: "🎯 Tactical Workshop", buff: "+5% Midfield" },
    { day: 4, name: "Thursday", event: "🏟️ Fan Engagement", buff: "+Fans & +5% Attack" },
    { day: 5, name: "Friday", event: "⚽ MATCH NIGHT", buff: "9PM EST" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
      {/* My standing */}
      <div className="panel">
        <div className="panel-header">My Club</div>
        {myStanding ? (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-pixel text-white text-xs">{myStanding.teamName}</span>
              <span className="font-pixel text-npl-gold text-lg crt-glow">#{standings.indexOf(myStanding) + 1}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center border-t border-dark-border pt-2">
              {[["P", myStanding.played],["W", myStanding.won],["D", myStanding.drawn],["L", myStanding.lost]].map(([l, v]) => (
                <div key={l}><div className="font-pixel text-sm text-npl-green">{v}</div><div className="text-xs text-gray-500">{l}</div></div>
              ))}
            </div>
            <div className="flex justify-between text-xs border-t border-dark-border pt-2">
              <span className="text-gray-400">Points</span>
              <span className="font-pixel text-npl-gold">{myStanding.points}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">GD</span>
              <span className={`font-mono ${myStanding.goalDifference >= 0 ? "text-green-400" : "text-red-400"}`}>
                {myStanding.goalDifference >= 0 ? "+" : ""}{myStanding.goalDifference}
              </span>
            </div>
          </div>
        ) : <div className="text-gray-600 text-xs">No matches played yet</div>}
      </div>

      {/* Economy */}
      <div className="panel">
        <div className="panel-header">Club Economy</div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-xs">Transfer Budget</span>
            <span className="font-pixel text-npl-gold">{formatMoney(myBudget)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-xs">Fan Base</span>
            <span className="font-pixel text-blue-400">{formatFans(myFans)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-xs">Weekly Income</span>
            <span className="font-mono text-green-400 text-sm">+{formatMoney(weeklyIncome)}</span>
          </div>
          <div className="border-t border-dark-border pt-2">
            <div className="text-xs text-gray-600 mb-1">Fan income increases with wins</div>
            <div className="stat-bar"><div className="stat-bar-fill bg-blue-500" style={{ width: `${Math.min(100, (myFans / 25000) * 100)}%` }} /></div>
            <div className="flex justify-between text-xs text-gray-600 mt-1"><span>10K</span><span>25K fans</span></div>
          </div>
        </div>
      </div>

      {/* Weekly schedule */}
      <div className="panel">
        <div className="panel-header">This Week's Schedule</div>
        <div className="space-y-1">
          {daySchedule.map(d => (
            <div key={d.day} className={`flex items-center gap-2 py-1.5 px-2 text-xs
              ${d.day === dayNum ? "bg-dark-hover border border-npl-green" : "border border-transparent"}`}>
              <span className={`font-mono w-20 ${d.day === dayNum ? "text-npl-green font-bold" : "text-gray-500"}`}>
                {d.name}{d.day === dayNum ? " ◀" : ""}
              </span>
              <span className={d.day === 5 ? "text-npl-gold" : "text-gray-300"}>{d.event}</span>
              <span className="ml-auto text-gray-600">{d.buff}</span>
            </div>
          ))}
        </div>
        {dayNum >= 1 && dayNum <= 4 && (
          <button onClick={() => onTabChange("events")} className="btn-primary w-full mt-3 text-xs py-2">
            Complete Today's Event →
          </button>
        )}
      </div>

      {/* Active buffs */}
      <div className="panel">
        <div className="panel-header">Match Buffs (Active for Friday)</div>
        {Object.keys(myBuffs).length === 0 ? (
          <div className="text-gray-600 text-xs">No buffs active yet — complete daily events Mon–Thu</div>
        ) : (
          <div className="space-y-2">
            {Object.entries(myBuffs).map(([stat, val]) => (
              <div key={stat} className="flex items-center gap-2">
                <span className="text-gray-400 text-xs w-20 uppercase">{stat}</span>
                <div className="flex-1 stat-bar">
                  <div className={`stat-bar-fill ${val >= 0 ? "bg-green-500" : "bg-red-500"}`}
                    style={{ width: `${Math.abs(val) * 10}%` }} />
                </div>
                <span className={`text-xs font-mono ${val >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {val >= 0 ? "+" : ""}{val.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Next fixture */}
      {nextFixture && (
        <div className="panel md:col-span-2">
          <div className="panel-header">Next Fixture — Matchday {nextFixture.matchday}</div>
          <div className="flex items-center justify-center gap-6 py-4">
            <div className="text-center">
              <div className="font-pixel text-sm text-white">{nextFixture.home_team_id === teamId ? "YOU" : "AI"}</div>
              <div className="text-xs text-gray-400 mt-1">Home</div>
            </div>
            <div className="font-pixel text-npl-gold text-xl">VS</div>
            <div className="text-center">
              <div className="font-pixel text-sm text-white">{nextFixture.away_team_id === teamId ? "YOU" : "AI"}</div>
              <div className="text-xs text-gray-400 mt-1">Away</div>
            </div>
          </div>
          <div className="text-center text-xs text-gray-600 font-mono">Friday 9PM EST — Make sure tactics are set!</div>
          <button onClick={() => onTabChange("tactics")} className="btn-secondary w-full mt-3 text-xs">Set Tactics →</button>
        </div>
      )}
    </div>
  );
}
