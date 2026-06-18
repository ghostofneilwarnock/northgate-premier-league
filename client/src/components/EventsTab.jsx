import { useState, useEffect } from "react";
import { useGame } from "../contexts/GameContext";
import { api } from "../utils/api";

const DAY_DEFS = {
  1: { name: "Monday", icon: "📰", title: "Press Conference", buff: "+5% Defense", color: "text-blue-400" },
  2: { name: "Tuesday", icon: "🏋️", title: "Fitness Session", buff: "+5% Pace", color: "text-green-400" },
  3: { name: "Wednesday", icon: "🎯", title: "Tactical Workshop", buff: "+5% Midfield", color: "text-purple-400" },
  4: { name: "Thursday", icon: "🏟️", title: "Fan Engagement", buff: "+Fans & Attack", color: "text-yellow-400" },
};

const OUTCOME_LABELS = {
  full: { label: "✅ Full Effect!", color: "text-green-400", desc: "Your decision paid off." },
  partial: { label: "⚡ Partial Effect", color: "text-yellow-400", desc: "Some benefit gained." },
  none: { label: "❌ No Effect", color: "text-gray-400", desc: "Nothing came of it." },
  negative: { label: "💥 Backfired!", color: "text-red-400", desc: "That made things worse." },
};

export default function EventsTab({ leagueId, onComplete }) {
  const { state } = useGame();
  const [eventsData, setEventsData] = useState(null);
  const [activeDay, setActiveDay] = useState(null);
  const [activeScenario, setActiveScenario] = useState(null);
  const [choice, setChoice] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadEvents() {
    try {
      const data = await api.getEvents(leagueId, state.userId);
      setEventsData(data);
      // Auto-select today's available event
      const today = data.currentDay;
      if (today >= 1 && today <= 4) {
        const alreadyDone = data.completedEvents.find(e => e.day_of_week === today);
        if (!alreadyDone) setActiveDay(today);
      }
    } catch (e) { console.error(e); }
  }

  useEffect(() => { loadEvents(); }, [leagueId]);

  function selectDay(day) {
    setActiveDay(day);
    setActiveScenario(null);
    setChoice(null);
    setResult(null);
    // Pick a random scenario for this day
    if (eventsData?.availableEvents?.[day]) {
      const scenarios = eventsData.availableEvents[day].scenarios;
      setActiveScenario(scenarios[Math.floor(Math.random() * scenarios.length)]);
    }
  }

  async function submitChoice(c) {
    if (!activeScenario) return;
    setChoice(c);
    setLoading(true);
    try {
      const res = await api.completeEvent(leagueId, {
        userId: state.userId,
        dayOfWeek: activeDay,
        scenarioId: activeScenario.id,
        choice: c,
      });
      setResult(res);
      await loadEvents();
      onComplete?.();
    } catch (e) {
      alert(e.message);
    }
    setLoading(false);
  }

  if (!eventsData) return <div className="text-gray-600 font-mono text-sm">Loading events...</div>;

  const { currentDay, completedEvents, availableEvents } = eventsData;
  const today = currentDay;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="panel">
        <div className="panel-header">Weekly Events — Buffs Active Friday</div>
        <p className="text-xs text-gray-400 font-mono mb-4">
          Complete each day's event to earn match buffs. Events available Mon–Thu. All buffs stack and apply Friday night.
        </p>

        {/* Day selector */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[1, 2, 3, 4].map(day => {
            const def = DAY_DEFS[day];
            const done = completedEvents.find(e => e.day_of_week === day);
            const isToday = day === today;
            const available = day <= today;
            const isActive = activeDay === day;

            return (
              <button key={day}
                onClick={() => available ? selectDay(day) : null}
                disabled={!available}
                className={`p-3 border text-center transition-all text-xs
                  ${isActive ? "border-npl-green bg-dark-hover" : "border-dark-border"}
                  ${!available ? "opacity-30 cursor-not-allowed" : "hover:border-gray-500 cursor-pointer"}
                  ${done ? "border-green-800" : ""}`}>
                <div className="text-lg mb-1">{def.icon}</div>
                <div className={`font-pixel text-xs ${isToday ? "text-npl-green" : "text-gray-400"}`}>{def.name}</div>
                <div className="text-xs text-gray-600 mt-1">{def.title}</div>
                {done ? (
                  <div className={`text-xs mt-1 ${OUTCOME_LABELS[done.outcome]?.color || "text-green-400"}`}>
                    {OUTCOME_LABELS[done.outcome]?.label || "Done"}
                  </div>
                ) : isToday ? (
                  <div className="text-xs text-npl-green mt-1 animate-blink">Available</div>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Friday indicator */}
        {today === 5 && (
          <div className="border border-npl-gold bg-yellow-900/10 p-3 text-center">
            <div className="font-pixel text-npl-gold text-sm crt-glow">⚽ MATCH NIGHT</div>
            <div className="text-xs text-gray-400 font-mono mt-1">Event window closed. Match kicks off at 9PM EST.</div>
          </div>
        )}

        {today > 5 && (
          <div className="border border-dark-border p-3 text-center">
            <div className="font-mono text-gray-500 text-sm">Events resume Monday.</div>
          </div>
        )}
      </div>

      {/* Active scenario */}
      {activeDay && activeScenario && !result && (
        <div className="panel border-npl-green">
          <div className="panel-header">
            {DAY_DEFS[activeDay].icon} {DAY_DEFS[activeDay].title}
            <span className={`ml-2 ${DAY_DEFS[activeDay].color}`}>{DAY_DEFS[activeDay].buff}</span>
          </div>

          {/* Already done check */}
          {completedEvents.find(e => e.day_of_week === activeDay) ? (
            <CompletedEvent event={completedEvents.find(e => e.day_of_week === activeDay)} />
          ) : (
            <>
              <p className="font-mono text-gray-200 text-sm leading-relaxed mb-4 border-l-2 border-npl-green pl-3">
                {activeScenario.setup}
              </p>
              <div className="space-y-3">
                {["A","B"].map(opt => {
                  const optKey = `option${opt}`;
                  const option = activeScenario[optKey];
                  return (
                    <button key={opt} onClick={() => !loading && submitChoice(opt)}
                      disabled={loading}
                      className={`w-full text-left p-3 border font-mono text-sm transition-all
                        ${loading ? "opacity-50 cursor-not-allowed" : "border-dark-border hover:border-npl-green hover:bg-dark-hover cursor-pointer"}`}>
                      <span className="font-pixel text-npl-gold mr-2">{opt})</span>
                      {option.text}
                    </button>
                  );
                })}
              </div>
              {loading && <div className="text-center font-pixel text-xs text-npl-green animate-pulse mt-3">Processing...</div>}
            </>
          )}
        </div>
      )}

      {/* Result reveal */}
      {result && (
        <div className={`panel border ${result.outcome === "full" ? "border-green-600" : result.outcome === "negative" ? "border-red-600" : "border-dark-border"}`}>
          <div className="panel-header">Result</div>
          <div className="text-center py-4">
            <div className={`font-pixel text-lg mb-2 ${OUTCOME_LABELS[result.outcome]?.color}`}>
              {OUTCOME_LABELS[result.outcome]?.label}
            </div>
            <div className="font-mono text-gray-400 text-sm">{OUTCOME_LABELS[result.outcome]?.desc}</div>

            {result.buffAmount !== 0 && (
              <div className="mt-3 font-mono text-sm">
                <span className="text-gray-400">{result.buffStat?.toUpperCase()} buff: </span>
                <span className={result.buffAmount >= 0 ? "text-green-400" : "text-red-400"}>
                  {result.buffAmount >= 0 ? "+" : ""}{result.buffAmount.toFixed(1)}%
                </span>
              </div>
            )}

            {result.fanChange !== 0 && (
              <div className="font-mono text-sm mt-1">
                <span className="text-gray-400">Fans: </span>
                <span className={result.fanChange >= 0 ? "text-blue-400" : "text-red-400"}>
                  {result.fanChange >= 0 ? "+" : ""}{result.fanChange.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* This week's buffs summary */}
      {completedEvents.length > 0 && (
        <div className="panel">
          <div className="panel-header">This Week's Buffs Earned</div>
          <div className="space-y-2">
            {completedEvents.map(e => {
              const def = DAY_DEFS[e.day_of_week];
              const out = OUTCOME_LABELS[e.outcome];
              return (
                <div key={e.id} className="flex items-center gap-3 text-xs font-mono border-b border-dark-border pb-2 last:border-0">
                  <span>{def?.icon}</span>
                  <span className="text-gray-400">{def?.name}</span>
                  <span className={out?.color}>{out?.label}</span>
                  <span className="ml-auto">
                    {e.buff_gained !== 0 && (
                      <span className={e.buff_gained >= 0 ? "text-green-400" : "text-red-400"}>
                        {def?.buff} {e.buff_gained >= 0 ? "+" : ""}{e.buff_gained.toFixed(1)}%
                      </span>
                    )}
                    {e.fan_change !== 0 && (
                      <span className={`ml-2 ${e.fan_change >= 0 ? "text-blue-400" : "text-red-400"}`}>
                        {e.fan_change >= 0 ? "+" : ""}{e.fan_change} fans
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CompletedEvent({ event }) {
  const out = OUTCOME_LABELS[event.outcome];
  return (
    <div className="text-center py-4 border border-dark-border">
      <div className={`font-pixel text-sm ${out?.color}`}>{out?.label}</div>
      <div className="font-mono text-gray-500 text-xs mt-1">Already completed today</div>
    </div>
  );
}
