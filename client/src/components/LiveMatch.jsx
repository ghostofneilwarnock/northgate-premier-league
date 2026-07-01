import { useState, useEffect, useRef } from "react";
import { useGame } from "../contexts/GameContext";
import { useSocket } from "../contexts/SocketContext";
import { getEventClass, getEventIcon, fatigueTier, ratingColor, positionColor } from "../utils/helpers";

const TEAMS_MAP = {
  1: "Ashford City", 2: "Greyhollow United", 3: "FC Dunmere", 4: "Ravenport Athletic",
  5: "Whitchurch Town", 6: "Ironbridge FC", 7: "Morcastle Rovers", 8: "Stoneford Borough",
  9: "Brackwell Wanderers", 10: "Holtwick County",
};

export default function LiveMatch({ leagueId }) {
  const { state, dispatch } = useGame();
  const { socket } = useSocket();
  const [showSubs, setShowSubs] = useState(false);
  const [pauseCountdown, setPauseCountdown] = useState(null);
  const [matchFixtures, setMatchFixtures] = useState([]);
  const feedRef = useRef(null);
  const countdownRef = useRef(null);

  // My fixture events
  const myEvents = state.liveEvents.filter(e =>
    e.homeTeamId === state.teamId || e.awayTeamId === state.teamId
  );
  const otherEvents = state.liveEvents.filter(e =>
    e.homeTeamId !== state.teamId && e.awayTeamId !== state.teamId
  );

  // Current score from live events
  const myFixtureKey = myEvents.length > 0 ? `${myEvents[0].homeTeamId}_${myEvents[0].awayTeamId}` : null;
  const myScore = myFixtureKey ? (state.liveScores[myFixtureKey] || { h: 0, a: 0 }) : { h: 0, a: 0 };
  const isHome = myEvents.length > 0 && myEvents[0].homeTeamId === state.teamId;
  const myGoals = isHome ? myScore.h : myScore.a;
  const oppGoals = isHome ? myScore.a : myScore.h;

  // Other scores ticker
  const otherScores = Object.entries(state.liveScores)
    .filter(([key]) => !myFixtureKey || key !== myFixtureKey)
    .map(([key, score]) => {
      const [h, a] = key.split("_").map(Number);
      return `${TEAMS_MAP[h] || h} ${score.h}–${score.a} ${TEAMS_MAP[a] || a}`;
    });

  // Pause handling
  useEffect(() => {
    if (!socket) return;
    socket.on("match:paused", (ps) => {
      dispatch({ type: "SET_PAUSE_STATE", pauseState: ps });
      setPauseCountdown(60);
    });
    socket.on("match:resumed", () => {
      dispatch({ type: "SET_PAUSE_STATE", pauseState: null });
      setPauseCountdown(null);
      setShowSubs(false);
      if (countdownRef.current) clearInterval(countdownRef.current);
    });
    return () => { socket.off("match:paused"); socket.off("match:resumed"); };
  }, [socket]);

  useEffect(() => {
    if (pauseCountdown === null) return;
    countdownRef.current = setInterval(() => {
      setPauseCountdown(p => { if (p <= 1) { clearInterval(countdownRef.current); return null; } return p - 1; });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [pauseCountdown !== null]);

  // Auto scroll feed
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [myEvents.length, state.commentary.length]);

  // Auto-dismiss the "joined mid-match" banner after a few seconds
  useEffect(() => {
    if (!state.isCatchUp) return;
    const t = setTimeout(() => dispatch({ type: "CLEAR_CATCHUP_BANNER" }), 5000);
    return () => clearTimeout(t);
  }, [state.isCatchUp]);

  function handlePause() {
    socket?.emit("match:pause", { leagueId, userId: state.userId });
  }
  function handleResume() {
    socket?.emit("match:resume", { leagueId });
    setShowSubs(false);
  }
  function handleSub(playerOffId, playerOnId) {
    socket?.emit("match:sub", { leagueId, userId: state.userId, playerOffId, playerOnId });
    setShowSubs(false);
  }

  const isPaused = !!state.pauseState;
  const lastEvent = myEvents[myEvents.length - 1];
  const currentMin = lastEvent?.minute || 0;
  const progressPct = Math.min(100, (currentMin / 90) * 100);

  const mySquad = state.mySquad || [];
  const starters = mySquad.slice(0, 11);
  const bench = mySquad.slice(11);

  // Merge banked match events with AI commentary lines into one feed,
  // ordered by minute. Commentary lines don't belong to a fixture, so
  // they show up in everyone's feed (only ever generated for the human
  // fixture on the server side).
  const feedItems = [
    ...myEvents.map(ev => ({ ...ev, kind: "event" })),
    ...state.commentary.map(c => ({ ...c, kind: "commentary" })),
  ].sort((a, b) => (a.minute || 0) - (b.minute || 0));

  return (
    <div className="fixed inset-0 z-50 bg-dark-bg flex flex-col overflow-hidden scanlines">
      {/* Match header */}
      <div className="bg-dark-panel border-b border-dark-border p-3">
        {/* Score */}
        <div className="flex items-center justify-center gap-6 mb-2">
          <div className="text-right">
            <div className="font-pixel text-xs text-white">{isHome ? "YOU" : (TEAMS_MAP[myEvents[0]?.homeTeamId] || "Home")}</div>
            <div className="text-xs text-gray-500">Home</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-pixel text-4xl text-npl-gold crt-glow">{myGoals}</span>
            <span className="font-pixel text-xl text-gray-600">–</span>
            <span className="font-pixel text-4xl text-npl-gold crt-glow">{oppGoals}</span>
          </div>
          <div className="text-left">
            <div className="font-pixel text-xs text-white">{!isHome ? "YOU" : (TEAMS_MAP[myEvents[0]?.awayTeamId] || "Away")}</div>
            <div className="text-xs text-gray-500">Away</div>
          </div>
        </div>

        {/* Match clock */}
        <div className="text-center mb-2">
          <span className={`font-pixel text-sm ${isPaused ? "text-yellow-400 animate-blink" : "text-npl-green"}`}>
            {isPaused ? "⏸ PAUSED" : `${currentMin}'`}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-dark-border mx-4">
          <div className="h-full bg-npl-green transition-all duration-1000" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-700 px-4 mt-1 font-mono">
          <span>KO</span><span>45'</span><span>FT</span>
        </div>
      </div>

      {/* Late-join catch-up banner */}
      {state.isCatchUp && (
        <div className="bg-yellow-900/30 border-b border-yellow-700 px-4 py-1 text-center">
          <span className="font-mono text-xs text-yellow-400">
            Joined at {state.catchUpMinute}' — caught up, live from here
          </span>
        </div>
      )}

      {/* Other scores ticker */}
      {otherScores.length > 0 && (
        <div className="bg-dark-panel border-b border-dark-border overflow-hidden h-6 flex items-center">
          <span className="text-xs font-pixel text-gray-600 px-2 shrink-0">OTHER:</span>
          <div className="flex gap-6 animate-ticker whitespace-nowrap">
            {otherScores.concat(otherScores).map((s, i) => (
              <span key={i} className="text-xs font-mono text-gray-500 px-4">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Commentary feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-1">
        {feedItems.map((item, i) =>
          item.kind === "commentary" ? (
            <div
              key={`c-${i}`}
              className={`flex gap-2 text-sm animate-slide-up ${item.isSummary ? "border-t border-dark-border mt-2 pt-2 font-semibold" : ""}`}
            >
              <span className="text-gray-600 font-mono w-8 shrink-0 text-right">{item.minute}'</span>
              <span className="shrink-0">🎙️</span>
              <span className="italic text-npl-gold/90">{item.text}</span>
            </div>
          ) : (
            <div key={i} className={`flex gap-2 text-sm animate-slide-up ${item.type === "goal" ? "goal-flash" : ""}`}>
              <span className="text-gray-600 font-mono w-8 shrink-0 text-right">{item.minute}'</span>
              <span className="shrink-0">{getEventIcon(item.type)}</span>
              <span className={getEventClass(item.type)}>{item.text}</span>
            </div>
          )
        )}
        {feedItems.length === 0 && (
          <div className="text-gray-600 font-mono text-sm text-center pt-8 animate-pulse">
            Match loading...
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="border-t border-dark-border bg-dark-panel p-3 flex gap-2 items-center flex-wrap">
        {!isPaused ? (
          <button onClick={handlePause} className="btn-secondary text-xs">
            ⏸ Pause & Make Changes
          </button>
        ) : (
          <>
            <div className="font-pixel text-yellow-400 text-xs animate-blink">
              ⏸ {pauseCountdown}s
            </div>
            <button onClick={() => setShowSubs(!showSubs)} className="btn-secondary text-xs">
              🔄 Substitutions
            </button>
            <button onClick={handleResume} className="btn-primary text-xs">
              ▶ Resume
            </button>
          </>
        )}
        <div className="ml-auto font-mono text-xs text-gray-600">
          {state.pauseState && `Pauses: Home ${state.pauseState.pauseCountHome}/3 · Away ${state.pauseState.pauseCountAway}/3`}
        </div>
      </div>

      {/* Sub overlay */}
      {showSubs && isPaused && (
        <div className="absolute inset-0 bg-black/90 z-10 overflow-auto">
          <SubstitutionPanel starters={starters} bench={bench} onSub={handleSub} onClose={() => setShowSubs(false)} />
        </div>
      )}
    </div>
  );
}

function SubstitutionPanel({ starters, bench, onSub, onClose }) {
  const [selectedOff, setSelectedOff] = useState(null);
  const [selectedOn, setSelectedOn] = useState(null);

  function confirmSub() {
    if (selectedOff && selectedOn) {
      onSub(selectedOff.id, selectedOn.id);
      setSelectedOff(null); setSelectedOn(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-pixel text-npl-gold text-sm">SUBSTITUTIONS</h2>
        <button onClick={onClose} className="btn-secondary text-xs">✕ Close</button>
      </div>
      <p className="font-mono text-gray-400 text-xs mb-4">
        Select a player to take off, then a player to bring on.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Players on field */}
        <div>
          <div className="font-pixel text-xs text-gray-400 mb-2">ON FIELD — Select player off</div>
          <div className="space-y-1">
            {starters.filter(p => !p.subbed).map(p => {
              const ft = fatigueTier(p.fatigue || 0);
              const isSelected = selectedOff?.id === p.id;
              return (
                <button key={p.id} onClick={() => setSelectedOff(p)}
                  className={`w-full text-left p-2 border text-xs font-mono transition-colors
                    ${isSelected ? "border-npl-gold bg-yellow-900/20" : "border-dark-border hover:border-gray-500"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`pixel-badge ${ft.cls} text-xs px-1`}>{p.position}</span>
                    <span className="text-white">{p.name}</span>
                    <span className="ml-auto" style={{ color: ratingColor(p.rating) }}>{p.rating}</span>
                    <span className={`text-xs ${ft.cls}`}>{p.fatigue || 0}%</span>
                  </div>
                  <div className="mt-1 h-1 bg-dark-border">
                    <div className="h-full transition-all" style={{ width: `${p.fatigue || 0}%`, backgroundColor: ft.color }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bench */}
        <div>
          <div className="font-pixel text-xs text-gray-400 mb-2">BENCH — Select player on</div>
          <div className="space-y-1">
            {bench.map(p => {
              const ft = fatigueTier(p.fatigue || 0);
              const isSelected = selectedOn?.id === p.id;
              return (
                <button key={p.id} onClick={() => setSelectedOn(p)}
                  className={`w-full text-left p-2 border text-xs font-mono transition-colors
                    ${isSelected ? "border-npl-green bg-green-900/20" : "border-dark-border hover:border-gray-500"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`pixel-badge ${ft.cls} text-xs px-1`}>{p.position}</span>
                    <span className="text-white">{p.name}</span>
                    <span className="ml-auto" style={{ color: ratingColor(p.rating) }}>{p.rating}</span>
                    <span className="text-green-500 text-xs">{p.fatigue || 0}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedOff && selectedOn && (
        <div className="mt-4 p-3 border border-npl-gold bg-yellow-900/10">
          <div className="font-mono text-xs text-gray-300 mb-2">
            <span className="text-red-400">{selectedOff.name}</span> → <span className="text-green-400">{selectedOn.name}</span>
          </div>
          <button onClick={confirmSub} className="btn-primary text-xs py-2 w-full">Confirm Substitution</button>
        </div>
      )}
    </div>
  );
}
