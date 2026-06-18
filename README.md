# ⚽ The Northgate Premier League

Real-time multiplayer text-based football manager. Two human managers vs 8 AI teams across an 18-matchday season. Live 30-minute matches every Friday night.

## Quick Start

```bash
npm run install:all   # install server + client deps
npm run dev           # server :3001 + client :5173
```

Open http://localhost:5173 — create a league, share the code with your opponent, start the season.

## Deploy to Render

1. Push to GitHub
2. Render → New → Blueprint → connect repo
3. `render.yaml` handles everything automatically

## Schedule (EST)

| Day | Event | Buff |
|-----|-------|------|
| Monday | 📰 Press Conference | +5% Defense |
| Tuesday | 🏋️ Fitness Session | +5% Pace |
| Wednesday | 🎯 Tactical Workshop | +5% Midfield |
| Thursday | 🏟️ Fan Engagement | +Fans & +5% Attack |
| Friday 9PM | ⚽ Match Night | All buffs fire |

## Fan Economy

- Start: 10,000 fans each
- Win: +200–500 fans · Draw: ±100 · Loss: -200–500
- Weekly income = fans × £0.01
- Thursday event modifies fans directly

## Dev

Trigger match immediately: click **Trigger Match** in the bottom dev bar (only visible in dev mode).
