// ============================================================
// TRANSFER MARKET — weekly refresh, cross-league players
// ============================================================
const { FOREIGN_CLUBS } = require("./gameData");

const FIRST_NAMES = [
  "Jack","Tom","Harry","James","Oliver","George","Liam","Ethan","Mason",
  "Ryan","Dylan","Nathan","Ben","Luke","Adam","Jake","Connor","Finn",
  "Rhys","Owen","Declan","Sean","Marcus","Jordan","Darius","Kofi","Theo",
  "Callum","Aaron","Kieran","Jamie","Robbie","Danny","Lee","Kyle","Matty",
  "Patrice","Adebayo","Laurent","Silvio","Tomasz","Vasile","Andrei","Mikel",
];
const LAST_NAMES = [
  "Smith","Jones","Williams","Taylor","Brown","Davies","Evans","Wilson",
  "Thomas","Roberts","Lewis","Walker","Robinson","Wood","Hall","Clarke",
  "White","Hughes","Martin","Thompson","Moore","Hill","Atkins","Barlow",
  "Carver","Doyle","Flynn","Garner","Holt","Lawson","Marsh","Nolan",
  "Okafor","Pearce","Rowe","Sutton","Vance","Mbeki","Fontaine","Richter",
  "Vasquez","Kowalski","Popescu","Arrizabalaga","De Vries","Lindqvist",
];

const POSITIONS = ["GK","CB","LB","RB","CM","DM","CAM","LW","RW","ST"];
const POS_WEIGHTS = [1, 2, 1, 1, 2, 1, 1, 1, 1, 2]; // ST/CB/CM more common

function seededRng(seed) {
  let s = (seed ^ 0xbeefdead) >>> 0;
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0xffffffff; };
}

function pickWeighted(items, weights, rng) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

function generateMarketPlayer(id, weekSeed, leagueTeams = []) {
  const rng = seededRng(weekSeed + id * 173);
  const firstName = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  const position = pickWeighted(POSITIONS, POS_WEIGHTS, rng);

  // Mix of league and foreign players
  const isForeign = rng() > 0.65;
  let club, teamId;
  if (isForeign || !leagueTeams.length) {
    club = FOREIGN_CLUBS[Math.floor(rng() * FOREIGN_CLUBS.length)];
    teamId = null;
  } else {
    const t = leagueTeams[Math.floor(rng() * leagueTeams.length)];
    club = t.name;
    teamId = t.id;
  }

  // Rating skewed to mid-range for market interest
  const rating = Math.floor(58 + rng() * 28);
  const age = Math.floor(18 + rng() * 17);

  // Price: rating-based with age modifier
  const agePenalty = age > 30 ? (age - 30) * 0.08 : 0;
  const baseValue = (rating - 55) * 1400;
  const value = Math.max(3000, Math.floor(baseValue * (1 - agePenalty) + rng() * 4000));

  return {
    id: `mkt_${weekSeed}_${id}`,
    name: `${firstName} ${lastName}`,
    firstName, lastName,
    position, age, rating, value,
    club, teamId,
    isForeign,
    stats: {
      attack: Math.floor(rating * (["ST","LW","RW","CAM"].includes(position) ? 1.0 : 0.78) + rng() * 12),
      defense: Math.floor(rating * (["CB","LB","RB","DM"].includes(position) ? 1.0 : 0.75) + rng() * 12),
      midfield: Math.floor(rating * (["CM","DM","CAM"].includes(position) ? 1.0 : 0.78) + rng() * 12),
      pace: Math.floor(55 + rng() * 40),
      stamina: Math.floor(55 + rng() * 40),
    },
    fatigue: 0,
    seasonGoals: 0, seasonAssists: 0,
    seasonYellows: 0, seasonReds: 0, seasonApps: 0,
    transferListed: false,
  };
}

function generateWeeklyMarket(weekNumber, leagueTeams = []) {
  const seed = weekNumber * 9973 + 31337;
  const count = 15;
  const players = [];
  for (let i = 0; i < count; i++) {
    players.push(generateMarketPlayer(i, seed, leagueTeams));
  }
  return players;
}

module.exports = { generateWeeklyMarket };
