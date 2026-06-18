export function formatMoney(n) {
  if (n >= 1000000) return `£${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `£${(n / 1000).toFixed(0)}K`;
  return `£${n}`;
}

export function formatFans(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

export function fatigueTier(f) {
  if (f < 50) return { label: "Fresh", cls: "fatigue-low", color: "#22c55e" };
  if (f < 75) return { label: "Tired", cls: "fatigue-mid", color: "#eab308" };
  return { label: "Exhausted", cls: "fatigue-high", color: "#ef4444" };
}

export function ratingColor(r) {
  if (r >= 80) return "#00ff41";
  if (r >= 70) return "#ffd700";
  if (r >= 60) return "#f97316";
  return "#ef4444";
}

export function positionColor(pos) {
  if (pos === "GK") return "#f59e0b";
  if (["CB","LB","RB"].includes(pos)) return "#3b82f6";
  if (["CM","DM","CAM","LM","RM"].includes(pos)) return "#8b5cf6";
  return "#ef4444";
}

export function getEventClass(type) {
  const map = {
    goal: "event-goal", yellow: "event-yellow", red: "event-red",
    halftime: "event-halftime", fulltime: "event-fulltime",
    save: "event-save", fatigue: "event-fatigue",
    kickoff: "text-gray-400", pressure: "text-gray-300",
    miss: "text-gray-400",
  };
  return map[type] || "text-gray-300";
}

export function getEventIcon(type) {
  const map = {
    goal: "⚽", yellow: "🟨", red: "🟥", save: "🧤",
    halftime: "—", fulltime: "🏁", kickoff: "▶",
    miss: "💨", pressure: "⚡", fatigue: "😮‍💨",
    red: "🟥", sub: "🔄",
  };
  return map[type] || "•";
}

export const TEAM_COLORS = {
  1: { primary: "#1a3a5c", secondary: "#f0c040" },
  2: { primary: "#c0392b", secondary: "#ecf0f1" },
  3: { primary: "#27ae60", secondary: "#2c3e50" },
  4: { primary: "#2c3e50", secondary: "#e74c3c" },
  5: { primary: "#8e44ad", secondary: "#f8f9fa" },
  6: { primary: "#e67e22", secondary: "#1a1a1a" },
  7: { primary: "#16a085", secondary: "#f39c12" },
  8: { primary: "#2980b9", secondary: "#e8d5a3" },
  9: { primary: "#c0392b", secondary: "#f39c12" },
  10: { primary: "#27ae60", secondary: "#f1c40f" },
};

export const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export const DAY_EVENTS = { 1: "📰 Press Conference", 2: "🏋️ Fitness Session", 3: "🎯 Tactical Workshop", 4: "🏟️ Fan Engagement" };
