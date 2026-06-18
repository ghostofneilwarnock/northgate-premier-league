// ============================================================
// NORTHGATE PREMIER LEAGUE — Core Game Data
// ============================================================

const LEAGUE_NAME = "The Northgate Premier League";
const STARTING_FANS = 10000;
const FAN_INCOME_RATE = 0.01; // £ per fan per week
const STARTING_BUDGET = 100000;

// Team specialisations — tightened to 68–86 range
// Each team has an identity but no team is a walkover
const TEAMS = [
  {
    id: 1, name: "Ashford City", shortName: "ASH", city: "Ashford",
    stadium: "The Citadel", capacity: 24000,
    colors: { primary: "#1a3a5c", secondary: "#f0c040" },
    identity: "All-round title contenders",
    stats: { attack: 82, defense: 80, midfield: 82, pace: 76, setPiece: 78 },
    fans: STARTING_FANS, budget: STARTING_BUDGET,
  },
  {
    id: 2, name: "Greyhollow United", shortName: "GRU", city: "Greyhollow",
    stadium: "Moorfield Park", capacity: 21000,
    colors: { primary: "#c0392b", secondary: "#ecf0f1" },
    identity: "Attack-minded, defensively vulnerable",
    stats: { attack: 86, defense: 68, midfield: 76, pace: 80, setPiece: 72 },
    fans: STARTING_FANS, budget: STARTING_BUDGET,
  },
  {
    id: 3, name: "FC Dunmere", shortName: "DUN", city: "Dunmere",
    stadium: "The Coppergate", capacity: 18500,
    colors: { primary: "#27ae60", secondary: "#2c3e50" },
    identity: "Defensive grinders, hard to beat",
    stats: { attack: 68, defense: 86, midfield: 74, pace: 70, setPiece: 76 },
    fans: STARTING_FANS, budget: STARTING_BUDGET,
  },
  {
    id: 4, name: "Ravenport Athletic", shortName: "RAV", city: "Ravenport",
    stadium: "Blackwater Arena", capacity: 20000,
    colors: { primary: "#2c3e50", secondary: "#e74c3c" },
    identity: "Pace merchants, transition threat",
    stats: { attack: 76, defense: 72, midfield: 70, pace: 86, setPiece: 68 },
    fans: STARTING_FANS, budget: STARTING_BUDGET,
  },
  {
    id: 5, name: "Whitchurch Town", shortName: "WHT", city: "Whitchurch",
    stadium: "Salter's Field", capacity: 17000,
    colors: { primary: "#8e44ad", secondary: "#f8f9fa" },
    identity: "Midfield maestros, possession-based",
    stats: { attack: 72, defense: 74, midfield: 86, pace: 70, setPiece: 74 },
    fans: STARTING_FANS, budget: STARTING_BUDGET,
  },
  {
    id: 6, name: "Ironbridge FC", shortName: "IRO", city: "Ironbridge",
    stadium: "The Foundry", capacity: 19000,
    colors: { primary: "#e67e22", secondary: "#1a1a1a" },
    identity: "Physical, set piece specialists",
    stats: { attack: 78, defense: 76, midfield: 68, pace: 68, setPiece: 86 },
    fans: STARTING_FANS, budget: STARTING_BUDGET,
  },
  {
    id: 7, name: "Morcastle Rovers", shortName: "MOR", city: "Morcastle",
    stadium: "Keelman's Ground", capacity: 16500,
    colors: { primary: "#16a085", secondary: "#f39c12" },
    identity: "Counter-attack specialists",
    stats: { attack: 74, defense: 78, midfield: 72, pace: 82, setPiece: 70 },
    fans: STARTING_FANS, budget: STARTING_BUDGET,
  },
  {
    id: 8, name: "Stoneford Borough", shortName: "STO", city: "Stoneford",
    stadium: "The Quarry End", capacity: 17500,
    colors: { primary: "#2980b9", secondary: "#e8d5a3" },
    identity: "Inconsistent wildcard, streaky form",
    stats: { attack: 76, defense: 70, midfield: 76, pace: 74, setPiece: 72 },
    fans: STARTING_FANS, budget: STARTING_BUDGET,
  },
  {
    id: 9, name: "Brackwell Wanderers", shortName: "BRA", city: "Brackwell",
    stadium: "Tollgate Park", capacity: 15000,
    colors: { primary: "#c0392b", secondary: "#f39c12" },
    identity: "Scrappy underdogs, high energy",
    stats: { attack: 70, defense: 72, midfield: 68, pace: 78, setPiece: 70 },
    fans: STARTING_FANS, budget: STARTING_BUDGET,
  },
  {
    id: 10, name: "Holtwick County", shortName: "HOL", city: "Holtwick",
    stadium: "Fens Meadow", capacity: 14000,
    colors: { primary: "#27ae60", secondary: "#f1c40f" },
    identity: "Relegation battlers, never say die",
    stats: { attack: 68, defense: 70, midfield: 68, pace: 72, setPiece: 74 },
    fans: STARTING_FANS, budget: STARTING_BUDGET,
  },
];

// ============================================================
// PLAYER GENERATION
// ============================================================
const FIRST_NAMES = [
  "Jack","Tom","Harry","James","Oliver","George","Charlie","William",
  "Liam","Ethan","Mason","Logan","Ryan","Dylan","Nathan","Sam",
  "Ben","Luke","Adam","Jake","Connor","Finn","Rhys","Owen",
  "Declan","Sean","Marcus","Jordan","Tyler","Darius","Kofi","Theo",
  "Elliot","Callum","Aaron","Kieran","Jamie","Robbie","Danny","Lee",
];
const LAST_NAMES = [
  "Smith","Jones","Williams","Taylor","Brown","Davies","Evans","Wilson",
  "Thomas","Roberts","Johnson","Lewis","Walker","Robinson","Wood","Hall",
  "Clarke","White","Hughes","Martin","Thompson","Moore","Hill","Atkins",
  "Barlow","Carver","Doyle","Flynn","Garner","Holt","Irons","Keane",
  "Lawson","Marsh","Nolan","Okafor","Pearce","Rowe","Sutton","Vance",
];

const SQUAD_SLOTS = [
  { pos: "GK", weight: "defense" },
  { pos: "GK", weight: "defense" },
  { pos: "CB", weight: "defense" },
  { pos: "CB", weight: "defense" },
  { pos: "CB", weight: "defense" },
  { pos: "LB", weight: "defense" },
  { pos: "RB", weight: "defense" },
  { pos: "CM", weight: "midfield" },
  { pos: "CM", weight: "midfield" },
  { pos: "CM", weight: "midfield" },
  { pos: "DM", weight: "midfield" },
  { pos: "CAM", weight: "midfield" },
  { pos: "LW", weight: "attack" },
  { pos: "RW", weight: "attack" },
  { pos: "ST", weight: "attack" },
  { pos: "ST", weight: "attack" },
  { pos: "LW", weight: "pace" },
  { pos: "CB", weight: "defense" },
  { pos: "CM", weight: "midfield" },
  { pos: "ST", weight: "attack" },
];

function seededRng(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return ((s >>> 0) / 0xffffffff);
  };
}

function generatePlayer(id, teamId, slot, seed) {
  const rng = seededRng(seed + id * 31 + teamId * 97);
  const team = TEAMS.find(t => t.id === teamId);
  const firstName = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];

  // Base rating weighted toward team's identity stat
  const identityStat = team.stats[slot.weight] || 75;
  const baseRating = Math.floor(identityStat * 0.85 + rng() * (identityStat * 0.3));
  const rating = Math.min(93, Math.max(55, baseRating));
  const age = Math.floor(17 + rng() * 20);

  // Value in £
  const value = Math.floor((rating - 55) * 1200 + rng() * 5000);

  return {
    id, teamId,
    name: `${firstName} ${lastName}`,
    firstName, lastName,
    position: slot.pos,
    age, rating, value,
    // Individual stat pillars
    stats: {
      attack: Math.floor(rating * (slot.weight === "attack" ? 1.0 : 0.75) + rng() * 10),
      defense: Math.floor(rating * (slot.weight === "defense" ? 1.0 : 0.75) + rng() * 10),
      midfield: Math.floor(rating * (slot.weight === "midfield" ? 1.0 : 0.75) + rng() * 10),
      pace: Math.floor(rating * (slot.weight === "pace" ? 1.0 : 0.80) + rng() * 10),
      stamina: Math.floor(60 + rng() * 35),
    },
    fatigue: 0,
    seasonGoals: 0, seasonAssists: 0,
    seasonYellows: 0, seasonReds: 0,
    seasonApps: 0,
    transferListed: false,
    isOnLoan: false,
  };
}

function generateSquads() {
  const squads = {};
  let pid = 1;
  TEAMS.forEach(team => {
    squads[team.id] = SQUAD_SLOTS.map((slot, idx) =>
      generatePlayer(pid++, team.id, slot, idx * 53 + team.id * 127)
    );
  });
  return squads;
}

// ============================================================
// FIXTURE GENERATION — 18 matchdays (9 home, 9 away per team)
// ============================================================
function generateFixtures() {
  const ids = TEAMS.map(t => t.id);
  const n = ids.length;
  const fixtures = [];

  // Round-robin algorithm
  const rounds = [];
  const list = [...ids];
  for (let round = 0; round < n - 1; round++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      pairs.push({ home: list[i], away: list[n - 1 - i] });
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop());
  }

  // First half of season
  rounds.forEach((round, i) => {
    round.forEach(({ home, away }) => {
      fixtures.push({ matchday: i + 1, homeTeamId: home, awayTeamId: away });
    });
  });

  // Second half — reversed home/away
  rounds.forEach((round, i) => {
    round.forEach(({ home, away }) => {
      fixtures.push({ matchday: n + i, homeTeamId: away, awayTeamId: home });
    });
  });

  return fixtures;
}

// ============================================================
// FORMATIONS
// ============================================================
const FORMATIONS = {
  "4-4-2": { name: "4-4-2", attackMod: 0, defenseMod: 0, midfieldMod: 0 },
  "4-3-3": { name: "4-3-3", attackMod: 8, defenseMod: -5, midfieldMod: 2 },
  "3-5-2": { name: "3-5-2", attackMod: 2, defenseMod: -3, midfieldMod: 8 },
  "4-5-1": { name: "4-5-1", attackMod: -5, defenseMod: 5, midfieldMod: 6 },
  "5-3-2": { name: "5-3-2", attackMod: -3, defenseMod: 10, midfieldMod: 0 },
  "4-2-3-1": { name: "4-2-3-1", attackMod: 4, defenseMod: 2, midfieldMod: 4 },
};

const MENTALITIES = {
  Defensive:     { attackMod: -8, defenseMod: 10, paceMod: -3 },
  Cautious:      { attackMod: -4, defenseMod: 6,  paceMod: -1 },
  Balanced:      { attackMod: 0,  defenseMod: 0,  paceMod: 0  },
  Attacking:     { attackMod: 6,  defenseMod: -5, paceMod: 2  },
  Gegenpressing: { attackMod: 4,  defenseMod: -3, paceMod: 5  },
};

// ============================================================
// DAILY EVENTS — Mon–Thu
// ============================================================
const DAILY_EVENTS = {
  1: { // Monday
    day: "Monday",
    title: "Press Conference",
    icon: "📰",
    description: "Media day. The press want answers.",
    buffStat: "defense",
    buffAmount: 5,
    scenarios: [
      {
        id: "pc_1",
        setup: "A journalist opens with a pointed question about your defensive record — you've conceded in each of your last three matches. The room falls quiet waiting for your response.",
        optionA: { text: "\"We're working on it. The players are giving everything.\"", outcomes: ["full","full","partial","none"] },
        optionB: { text: "\"Our defensive stats don't tell the full story. We dominated those games.\"", outcomes: ["partial","full","none","negative"] },
      },
      {
        id: "pc_2",
        setup: "A reporter asks whether a particular player in your squad has a future at the club amid transfer rumours from a rival team.",
        optionA: { text: "\"He's going nowhere. Fully committed.\"", outcomes: ["full","full","partial","partial"] },
        optionB: { text: "\"All options are discussed internally. No comment.\"", outcomes: ["none","partial","partial","full"] },
      },
      {
        id: "pc_3",
        setup: "A tabloid journalist asks about dressing room tension after a leaked training ground argument between two of your players.",
        optionA: { text: "Laugh it off. \"That's football — passion. Nothing to see here.\"", outcomes: ["full","partial","partial","none"] },
        optionB: { text: "Address it seriously. \"We've had a team meeting. It's resolved.\"", outcomes: ["partial","full","full","none"] },
      },
      {
        id: "pc_4",
        setup: "You're asked directly whether you think the referee cost you points last week.",
        optionA: { text: "\"Referees have a hard job. We move on.\"", outcomes: ["full","full","partial","partial"] },
        optionB: { text: "\"The decision was wrong and I've made that clear to the authorities.\"", outcomes: ["none","partial","full","negative"] },
      },
    ],
  },
  2: { // Tuesday
    day: "Tuesday",
    title: "Fitness Session",
    icon: "🏋️",
    description: "Training ground. Push the squad or protect them.",
    buffStat: "pace",
    buffAmount: 5,
    scenarios: [
      {
        id: "fit_1",
        setup: "Your sports scientist recommends a light recovery session after the intensity of last week. But your striker has looked sluggish in training and needs sharpening up.",
        optionA: { text: "Follow the recovery plan. Keep spirits high.", outcomes: ["partial","full","partial","none"] },
        optionB: { text: "Push the striker hard in extra drills. He needs it.", outcomes: ["full","none","full","negative"] },
      },
      {
        id: "fit_2",
        setup: "A new conditioning drill from your analyst could improve press intensity — but it's punishing and risks minor strains if not managed carefully.",
        optionA: { text: "Run the drill. The gains are worth the risk.", outcomes: ["full","full","none","negative"] },
        optionB: { text: "Modified version. Half the intensity.", outcomes: ["partial","partial","full","partial"] },
      },
      {
        id: "fit_3",
        setup: "Two of your fastest players are showing minor fatigue indicators. Friday's match is three days away.",
        optionA: { text: "Rest them today, integrate them Thursday.", outcomes: ["full","full","partial","partial"] },
        optionB: { text: "Light involvement — we need cohesion in drills.", outcomes: ["partial","none","full","negative"] },
      },
    ],
  },
  3: { // Wednesday
    day: "Wednesday",
    title: "Tactical Workshop",
    icon: "🎯",
    description: "Review opposition footage. Exploit their weaknesses.",
    buffStat: "midfield",
    buffAmount: 5,
    scenarios: [
      {
        id: "tac_1",
        setup: "Analysis shows Friday's opponents are vulnerable on transitions — they commit numbers forward and leave space in behind. But they're also strong in the air from set pieces.",
        optionA: { text: "Target the space behind their defence. Pace-first approach.", outcomes: ["full","full","partial","none"] },
        optionB: { text: "Focus on defending their set pieces and nicking a goal.", outcomes: ["partial","full","none","partial"] },
      },
      {
        id: "tac_2",
        setup: "Your assistant flags that the opposition's key playmaker has been carrying a knock — he might not start, but you've built your game plan around nullifying him.",
        optionA: { text: "Stick to the plan. He'll likely play through it.", outcomes: ["full","partial","none","full"] },
        optionB: { text: "Pivot the plan entirely. Target their weaker left side.", outcomes: ["none","full","full","partial"] },
      },
      {
        id: "tac_3",
        setup: "You're studying corners — the opponent conceded 3 from set pieces last month. Your own set pieces have been underwhelming.",
        optionA: { text: "Dedicate the session entirely to corner routines.", outcomes: ["full","full","partial","none"] },
        optionB: { text: "General tactical overview — don't over-specialise.", outcomes: ["partial","partial","full","partial"] },
      },
    ],
  },
  4: { // Thursday
    day: "Thursday",
    title: "Fan Engagement Day",
    icon: "🏟️",
    description: "The supporters are watching. Build the bond or risk the backlash.",
    buffStat: "fans",
    buffAmount: 5,
    fanChange: 300, // base fan change on full outcome
    scenarios: [
      {
        id: "fan_1",
        setup: "The supporters' trust has requested an open training session. Turnout is expected to be strong but it'll disrupt your final tactical prep before Friday.",
        optionA: { text: "Open the gates. Give the fans a show.", outcomes: ["full","full","partial","none"] },
        optionB: { text: "Politely decline. Prepare properly for the match.", outcomes: ["none","negative","partial","partial"] },
      },
      {
        id: "fan_2",
        setup: "A local youth team wants a signed shirt from your squad captain. He's been in a foul mood this week and you're not sure he'll respond well to the request.",
        optionA: { text: "Ask him directly. It's good for the community.", outcomes: ["full","full","none","negative"] },
        optionB: { text: "Arrange it without telling him. Sort it after training.", outcomes: ["partial","none","full","partial"] },
      },
      {
        id: "fan_3",
        setup: "Sections of your own fanbase have been booing during recent home performances. A supporter group leader wants a meeting before Friday's match.",
        optionA: { text: "Meet them. Listen, explain your vision openly.", outcomes: ["full","full","partial","none"] },
        optionB: { text: "Send your assistant. You don't negotiate under pressure.", outcomes: ["none","negative","partial","partial"] },
      },
      {
        id: "fan_4",
        setup: "A local radio station wants you to phone in for a live fan Q&A this evening — unscripted, anything goes.",
        optionA: { text: "Do it. Transparency builds trust.", outcomes: ["full","partial","full","negative"] },
        optionB: { text: "Decline gracefully — match prep comes first.", outcomes: ["partial","none","none","partial"] },
      },
    ],
  },
};

// Outcome resolution
const OUTCOME_RESULTS = {
  full:     { label: "✅ Full effect",     buffMultiplier: 1.0,  fanMod: 1.0  },
  partial:  { label: "⚡ Partial effect",  buffMultiplier: 0.5,  fanMod: 0.3  },
  none:     { label: "❌ No effect",       buffMultiplier: 0.0,  fanMod: 0.0  },
  negative: { label: "💥 Backfired!",      buffMultiplier: -0.5, fanMod: -0.5 },
};

// ============================================================
// TRANSFER MARKET — fictional foreign clubs
// ============================================================
const FOREIGN_CLUBS = [
  "Velthorpe SC",    // fictional Dutch-inspired
  "FC Brannburg",    // fictional German-inspired
  "Atlético Mironda",// fictional Spanish-inspired
  "Stade Valdois",   // fictional French-inspired
  "Regio Calcio",    // fictional Italian-inspired
];

module.exports = {
  LEAGUE_NAME,
  TEAMS,
  STARTING_FANS,
  FAN_INCOME_RATE,
  STARTING_BUDGET,
  FORMATIONS,
  MENTALITIES,
  DAILY_EVENTS,
  OUTCOME_RESULTS,
  FOREIGN_CLUBS,
  generateSquads,
  generateFixtures,
};
