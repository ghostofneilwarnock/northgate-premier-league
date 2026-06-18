// ============================================================
// MATCH ENGINE — live 30-min simulation with fatigue & buffs
// ============================================================
const { FORMATIONS, MENTALITIES } = require("./gameData");

// ---- Commentary banks ----------------------------------------
const C = {
  kickOff: [
    "{home} vs {away} — and we're underway at {stadium}!",
    "The referee's whistle echoes around {stadium}. We're off!",
    "A full house at {stadium}. {home} kick us off!",
    "Here we go at {stadium} — {home} hosting {away} on matchday {matchday}!",
  ],
  goal: [
    "GOAL! {scorer} finds the net! {home} {hg}–{ag} {away}",
    "GET IN! {scorer} makes no mistake! {home} {hg}–{ag} {away}",
    "What a finish from {scorer}! {home} {hg}–{ag} {away}",
    "{scorer} is clinical! The net bulges! {home} {hg}–{ag} {away}",
    "Composed finish from {scorer}! {home} {hg}–{ag} {away}",
    "He doesn't miss from there! {scorer}! {home} {hg}–{ag} {away}",
  ],
  assist: [" Lovely ball from {assister}.", " {assister} with the incisive pass.", " Great work from {assister} to set that up."],
  save: [
    "Brilliant save from {keeper}! Point-blank stuff!",
    "{keeper} tips it over — world class reaction!",
    "Denied! {keeper} spreads himself well to block the shot!",
    "Off the line from {keeper}! That was nearly in!",
  ],
  miss: [
    "How has he missed that?! The goal was gaping!",
    "Over the bar! He'll be furious with himself.",
    "Off the post! So close for {team}!",
    "Wide! The winger cuts inside but drags his effort wide.",
    "Smashed over! Ambitious effort from distance.",
  ],
  yellow: [
    "{player} goes in the book for a cynical challenge.",
    "Referee shows yellow to {player} — late tackle.",
    "Caution for {player}. He'll need to be careful now.",
    "{player} catches his man and picks up a booking.",
  ],
  red: [
    "{player} is off! Straight red — shocking tackle!",
    "Red card! {player} lunges in two-footed — early bath!",
    "{player} has been dismissed! {team} down to ten men!",
  ],
  halfTime: [
    "That's the whistle for half time. {home} {hg}–{ag} {away}.",
    "Half time here at {stadium}. The score stands at {home} {hg}–{ag} {away}.",
    "Referee brings the first half to a close. {home} {hg}–{ag} {away}.",
  ],
  pressure: [
    "{team} pressing high now — forcing errors in their own half.",
    "{team} dominating possession in this phase.",
    "The tempo is relentless from {team} right now.",
  ],
  counter: [
    "{team} spring a lightning counter-attack!",
    "Brilliant transition from {team} — numbers forward!",
    "{team} catch them on the break!",
  ],
  injury: [
    "{player} goes down holding his hamstring. He's waving for the physio.",
    "Knock for {player} — he's limping slightly but playing on.",
  ],
  fullTime: [
    "Full time at {stadium}! {home} {hg}–{ag} {away}.",
    "And that's it! Final score: {home} {hg}–{ag} {away}.",
    "The referee blows the final whistle. {home} {hg}–{ag} {away}.",
  ],
  fanReaction: [
    "The {stadium} faithful are off their feet!",
    "Thunderous roar from the home support!",
    "The away end goes absolutely wild!",
    "Stunned silence from the home crowd.",
  ],
  fatigue: [
    "{player} is blowing hard — he may need to come off.",
    "{player} looks leggy. A substitution could be coming.",
    "You can see the fatigue in {player}'s legs — he's given everything.",
  ],
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : k));
}

function getOutfieldPlayers(squad) { return squad.filter(p => p.position !== "GK"); }
function getKeeper(squad) { return squad.find(p => p.position === "GK") || squad[0]; }
function getForwards(squad) { return squad.filter(p => ["ST","LW","RW","CAM"].includes(p.position)); }
function getMidfielders(squad) { return squad.filter(p => ["CM","DM","CAM","LM","RM"].includes(p.position)); }

// ---- Team strength calculation --------------------------------
function calcStrength(teamState, tactics, buffs = {}) {
  const { team, players } = teamState;
  const formation = FORMATIONS[tactics?.formation] || FORMATIONS["4-4-2"];
  const mentality = MENTALITIES[tactics?.mentality] || MENTALITIES["Balanced"];

  // Average player rating weighted by their pillar
  const avgRating = players.reduce((s, p) => s + p.rating, 0) / players.length;

  // Apply fatigue penalty
  const avgFatigue = players.reduce((s, p) => s + (p.fatigue || 0), 0) / players.length;
  const fatiguePenalty = avgFatigue > 70 ? (avgFatigue - 70) * 0.15 : 0;

  const baseAtk = team.stats.attack + formation.attackMod + mentality.attackMod + (buffs.attack || 0);
  const baseDef = team.stats.defense + formation.defenseMod + mentality.defenseMod + (buffs.defense || 0);
  const baseMid = team.stats.midfield + formation.midfieldMod + (buffs.midfield || 0);
  const basePace = team.stats.pace + mentality.paceMod + (buffs.pace || 0);

  return {
    attack: Math.max(30, baseAtk + avgRating * 0.1 - fatiguePenalty),
    defense: Math.max(30, baseDef + avgRating * 0.1 - fatiguePenalty),
    midfield: Math.max(30, baseMid + avgRating * 0.1 - fatiguePenalty),
    pace: Math.max(30, basePace - fatiguePenalty * 0.5),
    overall: Math.max(30, (baseAtk + baseDef + baseMid) / 3 + avgRating * 0.1 - fatiguePenalty),
  };
}

// ---- Pre-generate all match events ---------------------------
function preGenerateEvents(homeState, awayState, homeTactics, awayTactics, homeBuffs, awayBuffs) {
  const homeStr = calcStrength(homeState, homeTactics, homeBuffs);
  const awayStr = calcStrength(awayState, awayTactics, awayBuffs);

  const homeAdv = 5; // home advantage
  const homePow = homeStr.overall + homeAdv;
  const awayPow = awayStr.overall;
  const total = homePow + awayPow;

  const homePoss = Math.round((homePow / total) * 100);
  const awayPoss = 100 - homePoss;

  // Goal expectancy based on attack vs opponent defense
  function expectedGoals(atk, oppDef) {
    const ratio = atk / (atk + oppDef);
    const base = ratio * 3.2;
    return Math.max(0, base + (Math.random() - 0.5) * 1.5);
  }

  const homeExp = expectedGoals(homeStr.attack, awayStr.defense);
  const awayExp = expectedGoals(awayStr.attack, homeStr.defense);
  const homeGoalCount = Math.round(homeExp);
  const awayGoalCount = Math.round(awayExp);

  const homeShots = homeGoalCount + Math.floor(Math.random() * 5) + 3;
  const awayShots = awayGoalCount + Math.floor(Math.random() * 5) + 3;

  // Build raw event list
  const rawEvents = [];
  const usedMins = new Set([1, 45, 90]);

  function randMin(lo, hi) {
    let m;
    let tries = 0;
    do { m = Math.floor(Math.random() * (hi - lo + 1)) + lo; tries++; } while (usedMins.has(m) && tries < 30);
    usedMins.add(m);
    return m;
  }

  // Goals
  for (let i = 0; i < homeGoalCount; i++) rawEvents.push({ side: "home", type: "goal", minute: randMin(6, 90) });
  for (let i = 0; i < awayGoalCount; i++) rawEvents.push({ side: "away", type: "goal", minute: randMin(6, 90) });

  // Yellow cards
  for (let i = 0; i < Math.floor(Math.random() * 3); i++) rawEvents.push({ side: "home", type: "yellow", minute: randMin(10, 88) });
  for (let i = 0; i < Math.floor(Math.random() * 3); i++) rawEvents.push({ side: "away", type: "yellow", minute: randMin(10, 88) });

  // Red card (rare)
  if (Math.random() < 0.07) rawEvents.push({ side: Math.random() > 0.5 ? "home" : "away", type: "red", minute: randMin(20, 80) });

  // Saves
  for (let i = 0; i < Math.floor(Math.random() * 3) + 1; i++) rawEvents.push({ side: Math.random() > 0.5 ? "home" : "away", type: "save", minute: randMin(5, 89) });

  // Near misses
  for (let i = 0; i < Math.floor(Math.random() * 4) + 2; i++) rawEvents.push({ side: Math.random() > 0.5 ? "home" : "away", type: "miss", minute: randMin(5, 89) });

  // Pressure moments
  for (let i = 0; i < Math.floor(Math.random() * 3) + 1; i++) rawEvents.push({ side: Math.random() > 0.5 ? "home" : "away", type: "pressure", minute: randMin(20, 85) });

  // Fatigue warnings (60–85 min)
  rawEvents.push({ side: "home", type: "fatigue", minute: randMin(60, 80) });
  rawEvents.push({ side: "away", type: "fatigue", minute: randMin(60, 80) });

  rawEvents.sort((a, b) => a.minute - b.minute);

  // Resolve into rich events
  const events = [];
  let hg = 0, ag = 0;
  let halfTimeInserted = false;

  const homeName = homeState.team.name;
  const awayName = awayState.team.name;
  const stadium = homeState.team.stadium;
  const matchday = homeState.matchday || 1;

  // Kick off
  events.push({
    minute: 1, type: "kickoff",
    text: fill(pick(C.kickOff), { home: homeName, away: awayName, stadium, matchday }),
  });

  rawEvents.forEach(ev => {
    const isHome = ev.side === "home";

    if (!halfTimeInserted && ev.minute > 45) {
      halfTimeInserted = true;
      events.push({
        minute: 45, type: "halftime",
        text: fill(pick(C.halfTime), { home: homeName, away: awayName, hg, ag, stadium }),
      });
    }

    const squad = isHome ? homeState.players : awayState.players;
    const oppSquad = isHome ? awayState.players : homeState.players;
    const teamName = isHome ? homeName : awayName;

    if (ev.type === "goal") {
      const scorer = pick(getForwards(squad).length ? getForwards(squad) : getOutfieldPlayers(squad));
      const assister = Math.random() > 0.4 ? pick(getMidfielders(squad).length ? getMidfielders(squad) : getOutfieldPlayers(squad)) : null;
      if (isHome) hg++; else ag++;
      let text = fill(pick(C.goal), { scorer: scorer.name, home: homeName, away: awayName, hg, ag });
      if (assister && assister.id !== scorer.id) text += fill(pick(C.assist), { assister: assister.name });
      events.push({ minute: ev.minute, type: "goal", side: ev.side, scorerId: scorer.id, assisterId: assister?.id, text });

    } else if (ev.type === "yellow") {
      const player = pick(getOutfieldPlayers(squad));
      events.push({ minute: ev.minute, type: "yellow", side: ev.side, playerId: player.id, text: fill(pick(C.yellow), { player: player.name }) });

    } else if (ev.type === "red") {
      const player = pick(getOutfieldPlayers(squad));
      events.push({ minute: ev.minute, type: "red", side: ev.side, playerId: player.id, text: fill(pick(C.red), { player: player.name, team: teamName }) });

    } else if (ev.type === "save") {
      // The saving team is the defending team
      const savingKeeper = getKeeper(isHome ? oppSquad : squad);
      const savingTeam = isHome ? awayName : homeName;
      events.push({ minute: ev.minute, type: "save", side: isHome ? "away" : "home", text: fill(pick(C.save), { keeper: savingKeeper.name, team: savingTeam }) });

    } else if (ev.type === "miss") {
      events.push({ minute: ev.minute, type: "miss", side: ev.side, text: fill(pick(C.miss), { team: teamName }) });

    } else if (ev.type === "pressure") {
      const template = pick([...C.pressure, ...C.counter]);
      events.push({ minute: ev.minute, type: "pressure", side: ev.side, text: fill(template, { team: teamName }) });

    } else if (ev.type === "fatigue") {
      const tiredPlayer = pick(getOutfieldPlayers(squad).sort((a, b) => b.fatigue - a.fatigue).slice(0, 3));
      events.push({ minute: ev.minute, type: "fatigue", side: ev.side, playerId: tiredPlayer?.id, text: fill(pick(C.fatigue), { player: tiredPlayer?.name || "the player" }) });
    }
  });

  if (!halfTimeInserted) {
    events.push({ minute: 45, type: "halftime", text: fill(pick(C.halfTime), { home: homeName, away: awayName, hg, ag, stadium }) });
  }

  events.push({
    minute: 90, type: "fulltime",
    text: fill(pick(C.fullTime), { home: homeName, away: awayName, hg, ag, stadium }),
  });

  events.sort((a, b) => a.minute - b.minute);

  return {
    homeGoals: hg,
    awayGoals: ag,
    events,
    stats: {
      homePossession: homePoss,
      awayPossession: awayPoss,
      homeShots,
      awayShots,
      homeStrength: homeStr,
      awayStrength: awayStr,
    },
  };
}

// ---- Fan economy after result --------------------------------
function calcFanChange(currentFans, homeGoals, awayGoals, isHome) {
  const teamGoals = isHome ? homeGoals : awayGoals;
  const oppGoals = isHome ? awayGoals : homeGoals;
  const margin = teamGoals - oppGoals;

  if (margin > 0) {
    // Win
    const base = 200 + margin * 150;
    return Math.floor(base + Math.random() * 100);
  } else if (margin === 0) {
    // Draw
    return Math.floor((Math.random() - 0.4) * 150);
  } else {
    // Loss
    const base = -200 + margin * 100;
    return Math.floor(base - Math.random() * 100);
  }
}

// ---- Apply match stats to players ---------------------------
function applyMatchStats(players, events, side) {
  const updated = players.map(p => ({ ...p }));
  events.forEach(ev => {
    if (ev.type === "goal" && ev.side === side) {
      const scorer = updated.find(p => p.id === ev.scorerId);
      if (scorer) scorer.seasonGoals++;
      const assister = updated.find(p => p.id === ev.assisterId);
      if (assister) assister.seasonAssists++;
    }
    if (ev.type === "yellow" && ev.side === side) {
      const p = updated.find(pl => pl.id === ev.playerId);
      if (p) p.seasonYellows++;
    }
    if (ev.type === "red" && ev.side === side) {
      const p = updated.find(pl => pl.id === ev.playerId);
      if (p) p.seasonReds++;
    }
  });
  // Apply fatigue
  updated.forEach(p => {
    if (p.position !== "GK") p.fatigue = Math.min(100, (p.fatigue || 0) + 40 + Math.random() * 20);
    else p.fatigue = Math.min(100, (p.fatigue || 0) + 20);
    p.seasonApps = (p.seasonApps || 0) + 1;
  });
  return updated;
}

// ---- Full fatigue reset between matchdays -------------------
function resetFatigue(players) {
  return players.map(p => ({ ...p, fatigue: 0 }));
}

// ---- Standings calculator -----------------------------------
function calculateStandings(teams, results) {
  const table = teams.map(t => ({
    teamId: t.id, teamName: t.name, shortName: t.shortName,
    played: 0, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
    fans: t.fans || 10000,
  }));

  results.forEach(r => {
    if (!r.played) return;
    const h = table.find(t => t.teamId === r.homeTeamId);
    const a = table.find(t => t.teamId === r.awayTeamId);
    if (!h || !a) return;
    h.played++; a.played++;
    h.goalsFor += r.homeGoals; h.goalsAgainst += r.awayGoals;
    a.goalsFor += r.awayGoals; a.goalsAgainst += r.homeGoals;
    if (r.homeGoals > r.awayGoals) { h.won++; h.points += 3; a.lost++; }
    else if (r.homeGoals < r.awayGoals) { a.won++; a.points += 3; h.lost++; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  });

  table.forEach(t => { t.goalDifference = t.goalsFor - t.goalsAgainst; });
  table.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
  return table;
}

module.exports = { preGenerateEvents, calcStrength, calcFanChange, applyMatchStats, resetFatigue, calculateStandings };
