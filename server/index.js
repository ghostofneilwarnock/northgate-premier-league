// ============================================================
// NORTHGATE PREMIER LEAGUE — Main Server
// ============================================================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const cron = require("node-cron");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const db = require("./db");
const { TEAMS, DAILY_EVENTS, OUTCOME_RESULTS, FORMATIONS, MENTALITIES,
        FAN_INCOME_RATE, generateSquads, generateFixtures } = require("./gameData");
const { preGenerateEvents, calcFanChange, applyMatchStats,
        resetFatigue, calculateStandings } = require("./matchEngine");
const { generateWeeklyMarket } = require("./transferMarket");

// ---- Setup ------------------------------------------------
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"] },
});

app.use(cors());
app.use(express.json());

// Serve built frontend
const DIST = path.join(__dirname, "../client/dist");
app.use(express.static(DIST));

// ---- Helpers -----------------------------------------------
function generateCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function getESTDayOfWeek() {
  const now = new Date();
  const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return est.getDay(); // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
}

function getESTHour() {
  const now = new Date();
  const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return est.getHours();
}

function getLeagueState(leagueId) {
  const league = db.getLeagueById.get(leagueId);
  if (!league) return null;
  const players = db.getLeaguePlayers.get ? db.getLeaguePlayers.all(leagueId) : [];
  const fixtures = db.getAllFixtures.all(leagueId);
  const results = fixtures.filter(f => f.played);

  const teams = TEAMS.map(t => {
    const lp = players.find(p => p.team_id === t.id);
    return { ...t, fans: lp ? lp.fans : t.fans, budget: lp ? lp.budget : t.budget };
  });

  const standings = calculateStandings(teams, results);

  return { league, players, fixtures, results, standings, teams };
}

// ---- Active match tracking ----------------------------------
const activeMatches = new Map(); // leagueId -> match state

// ---- REST API -----------------------------------------------

// Create league
app.post("/api/league/create", (req, res) => {
  const { userName, teamId, userId } = req.body;
  if (!userName || !teamId || !userId) return res.status(400).json({ error: "Missing fields" });

  const leagueId = uuidv4();
  const code = generateCode();

  db.createLeague.run(leagueId, code);

  // Add human player
  db.addLeaguePlayer.run(leagueId, userId, userName, teamId, 1);

  // Generate squads
  const squads = generateSquads();
  TEAMS.forEach(t => {
    db.upsertSquad.run(leagueId, t.id, JSON.stringify(squads[t.id]));
  });

  // Generate fixtures
  const fixtures = generateFixtures();
  fixtures.forEach(f => db.insertFixture.run(leagueId, f.matchday, f.homeTeamId, f.awayTeamId));

  // Generate week 1 market
  const market = generateWeeklyMarket(1, TEAMS);
  db.upsertMarket.run(leagueId, 1, JSON.stringify(market));

  // Set AI managers for remaining teams
  const humanTeamId = parseInt(teamId);
  TEAMS.filter(t => t.id !== humanTeamId).forEach(t => {
    db.addLeaguePlayer.run(leagueId, `ai_${t.id}`, t.name, t.id, 0);
  });

  res.json({ leagueId, code, teamId });
});

// Join league
app.post("/api/league/join", (req, res) => {
  const { code, userName, teamId, userId } = req.body;
  if (!code || !userName || !teamId || !userId) return res.status(400).json({ error: "Missing fields" });

  const league = db.getLeagueByCode.get(code);
  if (!league) return res.status(404).json({ error: "League not found" });
  if (league.status === "active") return res.status(400).json({ error: "League already started" });

  const existing = db.getLeaguePlayer.get(league.id, userId);
  if (existing) return res.json({ leagueId: league.id, teamId: existing.team_id });

  const players = db.getLeaguePlayers.all(league.id);
  const takenTeams = players.filter(p => p.is_human).map(p => p.team_id);
  if (takenTeams.includes(parseInt(teamId))) {
    return res.status(400).json({ error: "Team already taken" });
  }

  // Replace AI manager for chosen team
  db.prepare(`DELETE FROM league_players WHERE league_id = ? AND user_id = ?`)
    .run(league.id, `ai_${teamId}`);
  db.addLeaguePlayer.run(league.id, userId, userName, parseInt(teamId), 1);

  res.json({ leagueId: league.id, teamId });
});

// Start league
app.post("/api/league/:id/start", (req, res) => {
  const { id } = req.params;
  const humanPlayers = db.getLeaguePlayers.all(id).filter(p => p.is_human);
  if (humanPlayers.length < 2) return res.status(400).json({ error: "Need at least 2 human players" });
  db.updateLeagueStatus.run("active", id);
  db.advanceMatchday.run(1, id);
  io.to(id).emit("league:started", getLeagueState(id));
  res.json({ ok: true });
});

// Get league state
app.get("/api/league/:id", (req, res) => {
  const state = getLeagueState(req.params.id);
  if (!state) return res.status(404).json({ error: "Not found" });
  res.json(state);
});

// Get squad
app.get("/api/league/:id/squad/:teamId", (req, res) => {
  const row = db.getSquad.get(req.params.id, parseInt(req.params.teamId));
  if (!row) return res.status(404).json({ error: "Squad not found" });
  res.json(JSON.parse(row.player_data));
});

// Get transfer market
app.get("/api/league/:id/market", (req, res) => {
  const league = db.getLeagueById.get(req.params.id);
  if (!league) return res.status(404).json({ error: "Not found" });
  const market = db.getMarket.get(req.params.id, league.current_week);
  if (!market) return res.json([]);
  res.json(JSON.parse(market.players));
});

// Buy player
app.post("/api/league/:id/transfer/buy", (req, res) => {
  const { userId, playerId, weekNumber } = req.body;
  const leagueId = req.params.id;

  const lp = db.getLeaguePlayer.get(leagueId, userId);
  if (!lp) return res.status(403).json({ error: "Not in league" });

  const market = db.getMarket.get(leagueId, weekNumber);
  if (!market) return res.status(404).json({ error: "No market this week" });

  const marketPlayers = JSON.parse(market.players);
  const player = marketPlayers.find(p => p.id === playerId);
  if (!player) return res.status(404).json({ error: "Player not available" });
  if (lp.budget < player.value) return res.status(400).json({ error: "Insufficient budget" });

  // Add to squad
  const squadRow = db.getSquad.get(leagueId, lp.team_id);
  const squad = JSON.parse(squadRow.player_data);
  const newPlayer = { ...player, id: Date.now(), teamId: lp.team_id };
  squad.push(newPlayer);
  db.upsertSquad.run(leagueId, lp.team_id, JSON.stringify(squad));

  // Deduct budget
  db.updatePlayerBudget.run(lp.budget - player.value, leagueId, userId);

  // Remove from market
  const updatedMarket = marketPlayers.filter(p => p.id !== playerId);
  db.upsertMarket.run(leagueId, weekNumber, JSON.stringify(updatedMarket));

  // Log transfer
  db.logTransfer.run(leagueId, weekNumber, lp.team_id, player.teamId || null, JSON.stringify(newPlayer), player.value);

  io.to(leagueId).emit("transfer:completed", { buyerTeamId: lp.team_id, player: newPlayer });
  res.json({ ok: true, newBudget: lp.budget - player.value });
});

// Sell player
app.post("/api/league/:id/transfer/sell", (req, res) => {
  const { userId, playerId } = req.body;
  const leagueId = req.params.id;

  const lp = db.getLeaguePlayer.get(leagueId, userId);
  if (!lp) return res.status(403).json({ error: "Not in league" });

  const squadRow = db.getSquad.get(leagueId, lp.team_id);
  const squad = JSON.parse(squadRow.player_data);
  const playerIdx = squad.findIndex(p => p.id === playerId);
  if (playerIdx === -1) return res.status(404).json({ error: "Player not in squad" });

  const player = squad[playerIdx];
  const sellFee = Math.floor(player.value * 0.6);

  squad.splice(playerIdx, 1);
  db.upsertSquad.run(leagueId, lp.team_id, JSON.stringify(squad));
  db.updatePlayerBudget.run(lp.budget + sellFee, leagueId, userId);

  res.json({ ok: true, sellFee, newBudget: lp.budget + sellFee });
});

// Get daily events for current week
app.get("/api/league/:id/events/:userId", (req, res) => {
  const { id, userId } = req.params;
  const league = db.getLeagueById.get(id);
  if (!league) return res.status(404).json({ error: "Not found" });

  const log = db.getDailyEventLog.all(id, userId, league.current_week);
  const dayOfWeek = getESTDayOfWeek();

  res.json({
    currentDay: dayOfWeek,
    week: league.current_week,
    completedEvents: log,
    availableEvents: DAILY_EVENTS,
  });
});

// Complete a daily event
app.post("/api/league/:id/events/complete", (req, res) => {
  const { userId, dayOfWeek, scenarioId, choice } = req.body;
  const leagueId = req.params.id;

  const league = db.getLeagueById.get(leagueId);
  const lp = db.getLeaguePlayer.get(leagueId, userId);
  if (!league || !lp) return res.status(404).json({ error: "Not found" });

  // Check if already completed today
  const alreadyDone = db.hasCompletedDayEvent.get(leagueId, userId, league.current_week, dayOfWeek);
  if (alreadyDone) return res.status(400).json({ error: "Already completed today's event" });

  // Validate day availability (Mon-Thu only, i.e. 1-4)
  if (dayOfWeek < 1 || dayOfWeek > 4) return res.status(400).json({ error: "No event available today" });

  const eventDef = DAILY_EVENTS[dayOfWeek];
  if (!eventDef) return res.status(400).json({ error: "Invalid event day" });

  const scenario = eventDef.scenarios.find(s => s.id === scenarioId);
  if (!scenario) return res.status(400).json({ error: "Invalid scenario" });

  // Determine outcome (random from outcomes array)
  const outcomes = choice === "A" ? scenario.optionA.outcomes : scenario.optionB.outcomes;
  const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
  const result = OUTCOME_RESULTS[outcome];

  // Calculate buff
  const buffAmount = eventDef.buffAmount * result.buffMultiplier;

  // Update buffs
  const currentBuffs = JSON.parse(lp.buffs || "{}");
  const buffStat = eventDef.buffStat;

  if (buffStat === "fans") {
    // Thursday — attack buff goes into buffs too
    if (buffAmount !== 0) {
      currentBuffs["attack"] = (currentBuffs["attack"] || 0) + buffAmount;
    }
  } else {
    currentBuffs[buffStat] = (currentBuffs[buffStat] || 0) + buffAmount;
  }

  // Fan change (Thursday)
  let fanChange = 0;
  if (buffStat === "fans") {
    fanChange = Math.floor(eventDef.fanChange * result.fanMod);
    const newFans = Math.max(1000, lp.fans + fanChange);
    db.updatePlayerFans.run(newFans, leagueId, userId);
  }

  // Attack buff also applies to fans as a small bonus
  if (buffStat !== "fans" && outcome === "full") {
    fanChange = Math.floor(50 + Math.random() * 50);
    db.updatePlayerFans.run(Math.max(1000, lp.fans + fanChange), leagueId, userId);
  }

  db.updatePlayerBuffs.run(JSON.stringify(currentBuffs), leagueId, userId);
  db.logDailyEvent.run(leagueId, userId, league.current_week, dayOfWeek, scenarioId, choice, outcome, buffAmount, fanChange);

  res.json({ outcome, result, buffAmount, buffStat, fanChange, newBuffs: currentBuffs });
});

// Set matchday tactics
app.post("/api/league/:id/tactics", (req, res) => {
  try {
    const { userId, matchday, tactics } = req.body;
    const leagueId = req.params.id;
    if (!userId || !tactics) return res.status(400).json({ error: "Missing fields" });
    db.upsertMatchdayTactics.run(leagueId, matchday || 1, userId, JSON.stringify(tactics));
    db.updatePlayerTactics.run(JSON.stringify(tactics), leagueId, userId);
    io.to(leagueId).emit("tactics:updated", { userId, matchday });
    res.json({ ok: true });
  } catch (e) {
    console.error("Tactics error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Get all fixtures
app.get("/api/league/:id/fixtures", (req, res) => {
  const fixtures = db.getAllFixtures.all(req.params.id);
  res.json(fixtures.map(f => ({ ...f, events: f.events ? JSON.parse(f.events) : [], stats: f.stats ? JSON.parse(f.stats) : null })));
});

// Transfer history
app.get("/api/league/:id/transfers", (req, res) => {
  const history = db.getTransferHistory.all(req.params.id);
  res.json(history.map(h => ({ ...h, player_data: JSON.parse(h.player_data) })));
});

// ---- Socket.io ------------------------------------------------
io.on("connection", (socket) => {
  socket.on("join:league", ({ leagueId, userId }) => {
    socket.join(leagueId);
    socket.data.leagueId = leagueId;
    socket.data.userId = userId;
    io.to(leagueId).emit("player:joined", { userId });
  });

  // Request pause
  socket.on("match:pause", ({ leagueId, userId }) => {
    const matchState = activeMatches.get(leagueId);
    if (!matchState) return;

    const lp = db.getLeaguePlayer.get(leagueId, userId);
    if (!lp) return;

    const isHome = matchState.homeTeamId === lp.team_id;
    const pauseKey = isHome ? "pauseCountHome" : "pauseCountAway";
    const maxPauses = 3;

    if (matchState[pauseKey] >= maxPauses) {
      socket.emit("match:pause_denied", { reason: "No pauses remaining" });
      return;
    }

    matchState.paused = true;
    matchState.pausedBy = userId;
    matchState[pauseKey]++;

    // Start 60-second resume countdown
    matchState.pauseTimer = setTimeout(() => {
      matchState.paused = false;
      matchState.pausedBy = null;
      io.to(leagueId).emit("match:resumed", { reason: "Timeout" });
    }, 60000);

    io.to(leagueId).emit("match:paused", {
      pausedBy: userId,
      pauseCountHome: matchState.pauseCountHome,
      pauseCountAway: matchState.pauseCountAway,
      timeoutSeconds: 60,
    });
  });

  // Resume after pause
  socket.on("match:resume", ({ leagueId }) => {
    const matchState = activeMatches.get(leagueId);
    if (!matchState || !matchState.paused) return;
    if (matchState.pauseTimer) clearTimeout(matchState.pauseTimer);
    matchState.paused = false;
    matchState.pausedBy = null;
    io.to(leagueId).emit("match:resumed", { reason: "Manager ready" });
  });

  // Make substitution
  socket.on("match:sub", ({ leagueId, userId, playerOffId, playerOnId }) => {
    const matchState = activeMatches.get(leagueId);
    if (!matchState) return;

    const lp = db.getLeaguePlayer.get(leagueId, userId);
    const isHome = matchState.homeTeamId === lp?.team_id;
    const subsKey = isHome ? "subsUsedHome" : "subsUsedAway";

    if (matchState[subsKey] >= 3) {
      socket.emit("match:sub_denied", { reason: "All substitutions used" });
      return;
    }

    // Update squad fatigue for sub
    const squadKey = isHome ? "homeSquad" : "awaySquad";
    const squad = matchState[squadKey];
    if (squad) {
      const off = squad.find(p => p.id === playerOffId);
      const on = squad.find(p => p.id === playerOnId);
      if (off && on) {
        off.subbed = true;
        on.fatigue = Math.max(0, on.fatigue - 20); // fresh legs
        matchState[subsKey]++;
        io.to(leagueId).emit("match:sub_made", {
          userId, playerOff: off, playerOn: on,
          subsRemaining: 3 - matchState[subsKey],
          side: isHome ? "home" : "away",
        });
      }
    }
  });

  // Change tactics mid-match
  socket.on("match:tactics_change", ({ leagueId, userId, tactics }) => {
    const matchState = activeMatches.get(leagueId);
    if (!matchState || !matchState.paused) return;
    const lp = db.getLeaguePlayer.get(leagueId, userId);
    if (!lp) return;
    const isHome = matchState.homeTeamId === lp.team_id;
    if (isHome) matchState.homeTactics = tactics;
    else matchState.awayTactics = tactics;
    io.to(leagueId).emit("match:tactics_updated", { userId, tactics, side: isHome ? "home" : "away" });
  });

  socket.on("disconnect", () => {
    const { leagueId, userId } = socket.data;
    if (leagueId) io.to(leagueId).emit("player:disconnected", { userId });
  });
});

// ---- Match simulation (callable internally) ------------------
async function runMatchday(leagueId) {
  const league = db.getLeagueById.get(leagueId);
  if (!league || league.match_in_progress) return;

  db.setMatchInProgress.run(1, leagueId);
  const matchday = league.current_matchday;
  const fixtures = db.getFixturesByMatchday.all(leagueId, matchday);
  const players = db.getLeaguePlayers.all(leagueId);

  if (!fixtures.length) { db.setMatchInProgress.run(0, leagueId); return; }

  // Get all squads and tactics
  const squadCache = {};
  TEAMS.forEach(t => {
    const row = db.getSquad.get(leagueId, t.id);
    if (row) squadCache[t.id] = JSON.parse(row.player_data);
  });

  const tacticsRows = db.getMatchdayTactics.all(leagueId, matchday);
  const tacticsMap = {};
  tacticsRows.forEach(r => {
    const lp = players.find(p => p.user_id === r.user_id);
    if (lp) tacticsMap[lp.team_id] = JSON.parse(r.tactics);
  });

  const buffsMap = {};
  players.forEach(p => { buffsMap[p.team_id] = JSON.parse(p.buffs || "{}"); });

  // Signal match start
  const matchEventTimeline = {};

  fixtures.forEach(fixture => {
    const homeTeam = TEAMS.find(t => t.id === fixture.home_team_id);
    const awayTeam = TEAMS.find(t => t.id === fixture.away_team_id);
    const homeLP = players.find(p => p.team_id === fixture.home_team_id);
    const awayLP = players.find(p => p.team_id === fixture.away_team_id);

    const homeTactics = tacticsMap[fixture.home_team_id] || { formation: "4-4-2", mentality: "Balanced" };
    const awayTactics = tacticsMap[fixture.away_team_id] || { formation: "4-4-2", mentality: "Balanced" };

    const homeState = {
      team: { ...homeTeam, fans: homeLP?.fans || 10000 },
      players: squadCache[fixture.home_team_id] || [],
      matchday,
    };
    const awayState = {
      team: { ...awayTeam, fans: awayLP?.fans || 10000 },
      players: squadCache[fixture.away_team_id] || [],
      matchday,
    };

    const result = preGenerateEvents(
      homeState, awayState,
      homeTactics, awayTactics,
      buffsMap[fixture.home_team_id] || {},
      buffsMap[fixture.away_team_id] || {},
    );

    matchEventTimeline[fixture.id] = { fixture, result, homeLP, awayLP, homeState, awayState, homeTactics, awayTactics };
    db.updateFixtureResult.run(result.homeGoals, result.awayGoals, JSON.stringify(result.events), JSON.stringify(result.stats), fixture.id);
  });

  // ---- Stream events over 30 real minutes --------------------
  const MATCH_DURATION_MS = 30 * 60 * 1000;
  const MS_PER_GAME_MIN = MATCH_DURATION_MS / 90;

  const matchState = {
    leagueId, paused: false, pausedBy: null,
    pauseCountHome: 0, pauseCountAway: 0,
    subsUsedHome: 0, subsUsedAway: 0,
    homeTeamId: null, awayTeamId: null,
  };

  const humanFixture = Object.values(matchEventTimeline).find(m =>
    players.find(p => p.team_id === m.fixture.home_team_id && p.is_human) ||
    players.find(p => p.team_id === m.fixture.away_team_id && p.is_human)
  );

  if (humanFixture) {
    matchState.homeTeamId = humanFixture.fixture.home_team_id;
    matchState.awayTeamId = humanFixture.fixture.away_team_id;
    matchState.homeSquad = humanFixture.homeState.players;
    matchState.awaySquad = humanFixture.awayState.players;
    matchState.homeTactics = humanFixture.homeTactics;
    matchState.awayTactics = humanFixture.awayTactics;
  }

  activeMatches.set(leagueId, matchState);
  io.to(leagueId).emit("match:started", {
    matchday,
    fixtures: Object.values(matchEventTimeline).map(m => ({
      id: m.fixture.id,
      homeTeamId: m.fixture.home_team_id,
      awayTeamId: m.fixture.away_team_id,
      homeName: m.homeState.team.name,
      awayName: m.awayState.team.name,
    })),
  });

  const allTimedEvents = [];
  Object.values(matchEventTimeline).forEach(({ fixture, result }) => {
    result.events.forEach(ev => {
      allTimedEvents.push({
        fixtureId: fixture.id,
        homeTeamId: fixture.home_team_id,
        awayTeamId: fixture.away_team_id,
        realMs: Math.floor(ev.minute * MS_PER_GAME_MIN),
        event: ev,
      });
    });
  });
  allTimedEvents.sort((a, b) => a.realMs - b.realMs);

  let elapsed = 0;

  for (const timedEv of allTimedEvents) {
    const waitMs = timedEv.realMs - elapsed;
    if (waitMs > 0) {
      const checkInterval = 250;
      let waited = 0;
      while (waited < waitMs) {
        await new Promise(r => setTimeout(r, checkInterval));
        waited += checkInterval;
        while (matchState.paused) {
          await new Promise(r => setTimeout(r, 200));
        }
      }
      elapsed = timedEv.realMs;
    }

    io.to(leagueId).emit("match:event", {
      fixtureId: timedEv.fixtureId,
      homeTeamId: timedEv.homeTeamId,
      awayTeamId: timedEv.awayTeamId,
      event: timedEv.event,
    });
  }

  // ---- Post-match processing ---------------------------------
  await new Promise(r => setTimeout(r, 2000));

  Object.values(matchEventTimeline).forEach(({ fixture, result, homeLP, awayLP, homeState, awayState }) => {
    const updatedHome = applyMatchStats(homeState.players, result.events, "home");
    const updatedAway = applyMatchStats(awayState.players, result.events, "away");
    db.upsertSquad.run(leagueId, fixture.home_team_id, JSON.stringify(updatedHome));
    db.upsertSquad.run(leagueId, fixture.away_team_id, JSON.stringify(updatedAway));

    if (homeLP?.is_human) {
      const fanChange = calcFanChange(homeLP.fans, result.homeGoals, result.awayGoals, true);
      const newFans = Math.max(1000, homeLP.fans + fanChange);
      const weeklyIncome = Math.floor(newFans * 0.01);
      db.updateBudgetAndFans.run(homeLP.budget + weeklyIncome, newFans, leagueId, homeLP.user_id);
    }
    if (awayLP?.is_human) {
      const fanChange = calcFanChange(awayLP.fans, result.homeGoals, result.awayGoals, false);
      const newFans = Math.max(1000, awayLP.fans + fanChange);
      const weeklyIncome = Math.floor(newFans * 0.01);
      db.updateBudgetAndFans.run(awayLP.budget + weeklyIncome, newFans, leagueId, awayLP.user_id);
    }
  });

  players.filter(p => p.is_human).forEach(p => {
    db.updatePlayerBuffs.run("{}", leagueId, p.user_id);
  });

  const nextMatchday = league.current_matchday + 1;
  db.advanceMatchday.run(nextMatchday, leagueId);

  db.upsertMarket.run(leagueId, league.current_week + 1, JSON.stringify(generateWeeklyMarket(league.current_week + 1, TEAMS)));

  db.setMatchInProgress.run(0, leagueId);
  activeMatches.delete(leagueId);

  const finalState = getLeagueState(leagueId);
  io.to(leagueId).emit("match:completed", {
    matchday,
    results: Object.values(matchEventTimeline).map(m => ({
      fixtureId: m.fixture.id,
      homeTeamId: m.fixture.home_team_id,
      awayTeamId: m.fixture.away_team_id,
      homeGoals: m.result.homeGoals,
      awayGoals: m.result.awayGoals,
      stats: m.result.stats,
    })),
    standings: finalState.standings,
  });
}

// ---- Cron jobs -----------------------------------------------
// Kept as a backup — but primary trigger is the external HTTP endpoint below.
// node-cron timezone support can be unreliable on some cloud hosts.
cron.schedule("0 21 * * 5", async () => {
  console.log("[CRON] Friday match night triggered (node-cron backup)");
  const leagues = db.prepare("SELECT id FROM leagues WHERE status = 'active'").all();
  for (const l of leagues) { await runMatchday(l.id); }
}, { timezone: "America/New_York" });

// Monday midnight EST — refresh transfer market
cron.schedule("0 0 * * 1", () => {
  console.log("[CRON] Monday market refresh");
  const leagues = db.prepare("SELECT id, current_week FROM leagues WHERE status = 'active'").all();
  leagues.forEach(l => {
    const market = generateWeeklyMarket(l.current_week, TEAMS);
    db.upsertMarket.run(l.id, l.current_week, JSON.stringify(market));
    io.to(l.id).emit("market:refreshed", { week: l.current_week });
  });
}, { timezone: "America/New_York" });

// ---- External trigger endpoint (primary match trigger) -------
// Called by cron-job.org at 9pm ET every Friday.
// Protected by MATCH_SECRET env variable — set this in your Render dashboard.
app.post("/api/trigger-match", async (req, res) => {
  const secret = process.env.MATCH_SECRET;

  // If MATCH_SECRET is set, enforce it. If not set, warn but allow (so you can test).
  if (secret) {
    const provided = req.headers["x-match-secret"] || req.body?.secret;
    if (provided !== secret) {
      console.warn("[TRIGGER] Unauthorised match trigger attempt");
      return res.status(401).json({ error: "Unauthorised" });
    }
  } else {
    console.warn("[TRIGGER] MATCH_SECRET not set — endpoint is unprotected. Set it in Render env vars.");
  }

  // Optional: verify it's actually Friday 9pm ET (guards against accidental triggers)
  const day = getESTDayOfWeek();
  const hour = getESTHour();
  const isFridayNight = day === 5 && hour >= 21 && hour < 23;

  if (!isFridayNight) {
    // Allow override via body for manual/test triggers
    if (!req.body?.force) {
      return res.status(400).json({
        error: "Not Friday night ET. Send { force: true } in request body to override.",
        currentDay: day,
        currentHour: hour,
      });
    }
    console.log("[TRIGGER] Forced trigger outside Friday night window");
  }

  console.log("[TRIGGER] External match trigger received — running matchday for all active leagues");

  const leagues = db.prepare("SELECT id FROM leagues WHERE status = 'active'").all();

  if (!leagues.length) {
    return res.json({ ok: true, message: "No active leagues to process" });
  }

  // Respond immediately so cron-job.org doesn't time out, then run matches
  res.json({ ok: true, message: `Triggering matchday for ${leagues.length} league(s)` });

  for (const l of leagues) {
    try {
      await runMatchday(l.id);
    } catch (err) {
      console.error(`[TRIGGER] Error running matchday for league ${l.id}:`, err);
    }
  }
});

// ---- Dev endpoint to manually trigger matchday ---------------
if (process.env.NODE_ENV !== "production") {
  app.post("/api/dev/trigger-match/:id", async (req, res) => {
    await runMatchday(req.params.id);
    res.json({ ok: true });
  });
}

// ---- Catch-all for React router ------------------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(DIST, "index.html"));
});

const PORT = process.env.PORT || 3001;

db.init().then(() => {
  server.listen(PORT, () => console.log(`⚽ Northgate Premier League server running on :${PORT}`));
}).catch(err => {
  console.error("Failed to initialise database:", err);
  process.exit(1);
});
