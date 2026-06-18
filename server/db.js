// ============================================================
// DATABASE — sql.js with persistence (drop-in better-sqlite3 compat)
// ============================================================
const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../data/game.db");
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let _db = null;

// Persist db to disk periodically
function saveToDisk() {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Save every 10 seconds
setInterval(saveToDisk, 10000);
process.on("exit", saveToDisk);
process.on("SIGINT", () => { saveToDisk(); process.exit(0); });

// Build a prepared-statement-like wrapper around sql.js
function makePrepared(db, sql) {
  return {
    run(...args) {
      db.run(sql, args);
      saveToDisk();
    },
    get(...args) {
      const stmt = db.prepare(sql);
      stmt.bind(args);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    },
    all(...args) {
      const stmt = db.prepare(sql);
      stmt.bind(args);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
  };
}

// Synchronous init wrapper — sql.js is async but we can init synchronously
// by loading wasm before the server starts
let dbReady = false;
let readyCallbacks = [];

async function initDb() {
  const SQL = await initSqlJs();
  let fileBuffer = null;
  if (fs.existsSync(DB_PATH)) {
    fileBuffer = fs.readFileSync(DB_PATH);
  }
  _db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();

  // Wrap db with prepared statement factory
  _db.prepare2 = (sql) => makePrepared(_db, sql);

  // Run schema
  _db.run(`PRAGMA journal_mode = WAL;`);

  _db.run(`
    CREATE TABLE IF NOT EXISTS leagues (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'waiting',
      current_matchday INTEGER DEFAULT 0,
      current_week INTEGER DEFAULT 1,
      match_in_progress INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS league_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      team_id INTEGER NOT NULL,
      is_human INTEGER DEFAULT 1,
      budget INTEGER DEFAULT 100000,
      fans INTEGER DEFAULT 10000,
      tactics TEXT DEFAULT '{"formation":"4-4-2","mentality":"Balanced"}',
      buffs TEXT DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS squad_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id TEXT NOT NULL,
      team_id INTEGER NOT NULL,
      player_data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS fixtures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id TEXT NOT NULL,
      matchday INTEGER NOT NULL,
      home_team_id INTEGER NOT NULL,
      away_team_id INTEGER NOT NULL,
      home_goals INTEGER,
      away_goals INTEGER,
      events TEXT,
      stats TEXT,
      played INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS daily_event_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      week INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      event_id TEXT NOT NULL,
      choice TEXT NOT NULL,
      outcome TEXT NOT NULL,
      buff_gained REAL DEFAULT 0,
      fan_change INTEGER DEFAULT 0,
      completed_at INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS matchday_tactics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id TEXT NOT NULL,
      matchday INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      tactics TEXT NOT NULL,
      ready INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS transfer_market (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id TEXT NOT NULL,
      week INTEGER NOT NULL,
      players TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transfer_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id TEXT NOT NULL,
      week INTEGER NOT NULL,
      buyer_team_id INTEGER NOT NULL,
      seller_team_id INTEGER,
      player_data TEXT NOT NULL,
      fee INTEGER NOT NULL,
      completed_at INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS match_pause_state (
      league_id TEXT PRIMARY KEY,
      matchday INTEGER,
      paused INTEGER DEFAULT 0,
      paused_by TEXT,
      pause_count_home INTEGER DEFAULT 0,
      pause_count_away INTEGER DEFAULT 0,
      subs_used_home INTEGER DEFAULT 0,
      subs_used_away INTEGER DEFAULT 0,
      updated_at INTEGER DEFAULT (strftime('%s','now'))
    );
  `);

  dbReady = true;
  readyCallbacks.forEach(fn => fn());
  console.log("[DB] Initialized");
}

function waitReady() {
  return new Promise(resolve => {
    if (dbReady) resolve();
    else readyCallbacks.push(resolve);
  });
}

// Expose raw db for ad-hoc queries
const dbProxy = {
  get db() { return _db; },
  waitReady,
  prepare: (sql) => makePrepared(_db, sql),
  init: initDb,

  // Unique-constraint safe upserts via raw run
  upsertLeaguePlayer(leagueId, userId, userName, teamId, isHuman) {
    _db.run(
      `INSERT OR IGNORE INTO league_players (league_id,user_id,user_name,team_id,is_human) VALUES (?,?,?,?,?)`,
      [leagueId, userId, userName, teamId, isHuman]
    );
    saveToDisk();
  },
  upsertSquad(leagueId, teamId, playerData) {
    const existing = makePrepared(_db,
      `SELECT id FROM squad_players WHERE league_id=? AND team_id=?`).get(leagueId, teamId);
    if (existing) {
      _db.run(`UPDATE squad_players SET player_data=? WHERE league_id=? AND team_id=?`,
        [playerData, leagueId, teamId]);
    } else {
      _db.run(`INSERT INTO squad_players (league_id,team_id,player_data) VALUES (?,?,?)`,
        [leagueId, teamId, playerData]);
    }
    saveToDisk();
  },
  upsertMarket(leagueId, week, players) {
    const existing = makePrepared(_db,
      `SELECT id FROM transfer_market WHERE league_id=? AND week=?`).get(leagueId, week);
    if (existing) {
      _db.run(`UPDATE transfer_market SET players=? WHERE league_id=? AND week=?`,
        [players, leagueId, week]);
    } else {
      _db.run(`INSERT INTO transfer_market (league_id,week,players) VALUES (?,?,?)`,
        [leagueId, week, players]);
    }
    saveToDisk();
  },
  upsertMatchdayTactics(leagueId, matchday, userId, tactics) {
    const existing = makePrepared(_db,
      `SELECT id FROM matchday_tactics WHERE league_id=? AND matchday=? AND user_id=?`).get(leagueId, matchday, userId);
    if (existing) {
      _db.run(`UPDATE matchday_tactics SET tactics=?,ready=1 WHERE league_id=? AND matchday=? AND user_id=?`,
        [tactics, leagueId, matchday, userId]);
    } else {
      _db.run(`INSERT INTO matchday_tactics (league_id,matchday,user_id,tactics,ready) VALUES (?,?,?,?,1)`,
        [leagueId, matchday, userId, tactics]);
    }
    saveToDisk();
  },
  upsertPauseState(leagueId, matchday, paused, pausedBy, phome, paway, shome, saway) {
    const existing = makePrepared(_db, `SELECT league_id FROM match_pause_state WHERE league_id=?`).get(leagueId);
    if (existing) {
      _db.run(`UPDATE match_pause_state SET matchday=?,paused=?,paused_by=?,pause_count_home=?,pause_count_away=?,subs_used_home=?,subs_used_away=?,updated_at=strftime('%s','now') WHERE league_id=?`,
        [matchday, paused, pausedBy, phome, paway, shome, saway, leagueId]);
    } else {
      _db.run(`INSERT INTO match_pause_state (league_id,matchday,paused,paused_by,pause_count_home,pause_count_away,subs_used_home,subs_used_away) VALUES (?,?,?,?,?,?,?,?)`,
        [leagueId, matchday, paused, pausedBy, phome, paway, shome, saway]);
    }
    saveToDisk();
  },
};

// Statements (all lazy — only used after initDb resolves)
const stmts = () => ({
  createLeague: dbProxy.prepare(`INSERT INTO leagues (id,code) VALUES (?,?)`),
  getLeagueByCode: dbProxy.prepare(`SELECT * FROM leagues WHERE code=?`),
  getLeagueById: dbProxy.prepare(`SELECT * FROM leagues WHERE id=?`),
  updateLeagueStatus: dbProxy.prepare(`UPDATE leagues SET status=? WHERE id=?`),
  setMatchInProgress: dbProxy.prepare(`UPDATE leagues SET match_in_progress=? WHERE id=?`),
  advanceMatchday: dbProxy.prepare(`UPDATE leagues SET current_matchday=?,current_week=current_week+1 WHERE id=?`),

  addLeaguePlayer: { run: (l,u,n,t,h) => dbProxy.upsertLeaguePlayer(l,u,n,t,h) },
  getLeaguePlayers: dbProxy.prepare(`SELECT * FROM league_players WHERE league_id=?`),
  getLeaguePlayer: dbProxy.prepare(`SELECT * FROM league_players WHERE league_id=? AND user_id=?`),
  updatePlayerBudget: dbProxy.prepare(`UPDATE league_players SET budget=? WHERE league_id=? AND user_id=?`),
  updatePlayerFans: dbProxy.prepare(`UPDATE league_players SET fans=? WHERE league_id=? AND user_id=?`),
  updatePlayerTactics: dbProxy.prepare(`UPDATE league_players SET tactics=? WHERE league_id=? AND user_id=?`),
  updatePlayerBuffs: dbProxy.prepare(`UPDATE league_players SET buffs=? WHERE league_id=? AND user_id=?`),
  updateBudgetAndFans: dbProxy.prepare(`UPDATE league_players SET budget=?,fans=? WHERE league_id=? AND user_id=?`),

  upsertSquad: { run: (l,t,d) => dbProxy.upsertSquad(l,t,d) },
  getSquad: dbProxy.prepare(`SELECT player_data FROM squad_players WHERE league_id=? AND team_id=?`),

  insertFixture: dbProxy.prepare(`INSERT INTO fixtures (league_id,matchday,home_team_id,away_team_id) VALUES (?,?,?,?)`),
  getFixturesByMatchday: dbProxy.prepare(`SELECT * FROM fixtures WHERE league_id=? AND matchday=?`),
  getAllFixtures: dbProxy.prepare(`SELECT * FROM fixtures WHERE league_id=?`),
  getPlayedResults: dbProxy.prepare(`SELECT * FROM fixtures WHERE league_id=? AND played=1`),
  updateFixtureResult: dbProxy.prepare(`UPDATE fixtures SET home_goals=?,away_goals=?,events=?,stats=?,played=1 WHERE id=?`),

  logDailyEvent: dbProxy.prepare(`
    INSERT OR IGNORE INTO daily_event_log (league_id,user_id,week,day_of_week,event_id,choice,outcome,buff_gained,fan_change)
    VALUES (?,?,?,?,?,?,?,?,?)`),
  getDailyEventLog: dbProxy.prepare(`SELECT * FROM daily_event_log WHERE league_id=? AND user_id=? AND week=?`),
  hasCompletedDayEvent: dbProxy.prepare(`SELECT id FROM daily_event_log WHERE league_id=? AND user_id=? AND week=? AND day_of_week=?`),

  upsertMatchdayTactics: { run: (l,m,u,t) => dbProxy.upsertMatchdayTactics(l,m,u,t) },
  getMatchdayTactics: dbProxy.prepare(`SELECT * FROM matchday_tactics WHERE league_id=? AND matchday=?`),

  upsertMarket: { run: (l,w,p) => dbProxy.upsertMarket(l,w,p) },
  getMarket: dbProxy.prepare(`SELECT * FROM transfer_market WHERE league_id=? AND week=?`),
  logTransfer: dbProxy.prepare(`INSERT INTO transfer_history (league_id,week,buyer_team_id,seller_team_id,player_data,fee) VALUES (?,?,?,?,?,?)`),
  getTransferHistory: dbProxy.prepare(`SELECT * FROM transfer_history WHERE league_id=? ORDER BY completed_at DESC`),

  upsertPauseState: { run: (...a) => dbProxy.upsertPauseState(...a) },
  getPauseState: dbProxy.prepare(`SELECT * FROM match_pause_state WHERE league_id=?`),
});

// Lazy proxy — resolves statements after init
const handler = {
  get(target, prop) {
    if (prop === "init") return initDb;
    if (prop === "waitReady") return waitReady;
    if (prop === "db") return _db;
    if (prop === "prepare") return (sql) => makePrepared(_db, sql);
    // Lazily resolve named statements
    const s = stmts();
    if (s[prop]) return s[prop];
    return undefined;
  }
};

module.exports = new Proxy({}, handler);
