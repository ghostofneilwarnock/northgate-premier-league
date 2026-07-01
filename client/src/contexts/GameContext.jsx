import { createContext, useContext, useReducer, useEffect } from "react";

const GameContext = createContext(null);

const initialState = {
  userId: null,
  userName: null,
  leagueId: null,
  teamId: null,
  league: null,
  standings: [],
  fixtures: [],
  mySquad: [],
  myBudget: 100000,
  myFans: 10000,
  myBuffs: {},
  myTactics: { formation: "4-4-2", mentality: "Balanced" },
  market: [],
  matchInProgress: false,
  liveEvents: [],
  liveScores: {},
  commentary: [],
  isCatchUp: false,
  catchUpMinute: null,
  pauseState: null,
  notifications: [],
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_USER": return { ...state, userId: action.userId, userName: action.userName };
    case "SET_LEAGUE": return { ...state, leagueId: action.leagueId, teamId: action.teamId };
    case "UPDATE_LEAGUE_STATE": return {
      ...state,
      league: action.data.league,
      standings: action.data.standings || state.standings,
      fixtures: action.data.fixtures || state.fixtures,
    };
    case "SET_SQUAD": return { ...state, mySquad: action.squad };
    case "SET_BUDGET": return { ...state, myBudget: action.budget };
    case "SET_FANS": return { ...state, myFans: action.fans };
    case "SET_BUFFS": return { ...state, myBuffs: action.buffs };
    case "SET_TACTICS": return { ...state, myTactics: action.tactics };
    case "SET_MARKET": return { ...state, market: action.market };
    case "MATCH_STARTED": return { ...state, matchInProgress: true, liveEvents: [], liveScores: {}, commentary: [], isCatchUp: false, catchUpMinute: null };
    case "ADD_LIVE_EVENT": {
      const ev = action.event;
      const newScores = { ...state.liveScores };
      if (ev.type === "goal") {
        const key = `${action.homeTeamId}_${action.awayTeamId}`;
        const curr = newScores[key] || { h: 0, a: 0 };
        newScores[key] = ev.side === "home" ? { ...curr, h: curr.h + 1 } : { ...curr, a: curr.a + 1 };
      }
      return {
        ...state,
        liveEvents: [...state.liveEvents, { ...ev, fixtureId: action.fixtureId, homeTeamId: action.homeTeamId, awayTeamId: action.awayTeamId }],
        liveScores: newScores,
      };
    }
    case "MATCH_CATCHUP": {
      // Late-join: replay the events/commentary we missed into the same
      // shape ADD_LIVE_EVENT builds up one at a time, so every other part
      // of the UI (score, feed, progress bar) just works without changes.
      const liveEvents = [];
      const liveScores = {};
      (action.matchEvents || []).forEach(payload => {
        const ev = payload.event;
        liveEvents.push({ ...ev, fixtureId: payload.fixtureId, homeTeamId: payload.homeTeamId, awayTeamId: payload.awayTeamId });
        if (ev.type === "goal") {
          const key = `${payload.homeTeamId}_${payload.awayTeamId}`;
          const curr = liveScores[key] || { h: 0, a: 0 };
          liveScores[key] = ev.side === "home" ? { ...curr, h: curr.h + 1 } : { ...curr, a: curr.a + 1 };
        }
      });
      return {
        ...state,
        matchInProgress: true,
        liveEvents,
        liveScores,
        commentary: action.commentary || [],
        isCatchUp: true,
        catchUpMinute: action.elapsedMinutes,
        pauseState: action.isPaused
          ? { pauseCountHome: action.pauseCountHome, pauseCountAway: action.pauseCountAway }
          : null,
      };
    }
    case "ADD_COMMENTARY": return { ...state, commentary: [...state.commentary, action.commentary] };
    case "CLEAR_CATCHUP_BANNER": return { ...state, isCatchUp: false };
    case "MATCH_COMPLETED": return { ...state, matchInProgress: false };
    case "SET_PAUSE_STATE": return { ...state, pauseState: action.pauseState };
    case "ADD_NOTIFICATION": return { ...state, notifications: [...state.notifications, { id: Date.now(), ...action.notification }] };
    case "DISMISS_NOTIFICATION": return { ...state, notifications: state.notifications.filter(n => n.id !== action.id) };
    case "CLEAR_LIVE": return { ...state, liveEvents: [], liveScores: {}, commentary: [] };
    default: return state;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Persist user identity
  useEffect(() => {
    const saved = localStorage.getItem("npl_user");
    if (saved) {
      const { userId, userName } = JSON.parse(saved);
      dispatch({ type: "SET_USER", userId, userName });
    } else {
      const userId = `u_${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem("npl_user", JSON.stringify({ userId, userName: null }));
      dispatch({ type: "SET_USER", userId, userName: null });
    }
    const savedLeague = localStorage.getItem("npl_league");
    if (savedLeague) {
      const { leagueId, teamId } = JSON.parse(savedLeague);
      dispatch({ type: "SET_LEAGUE", leagueId, teamId });
    }
  }, []);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() { return useContext(GameContext); }
