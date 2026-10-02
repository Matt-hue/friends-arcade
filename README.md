# Friends Arcade

A small browser arcade for friends. ASP.NET Core (.NET 8) backend + React (Vite) frontend.
The backend serves the built frontend, so it deploys as a single app.

```
client/                React + Vite frontend
  src/games/           one folder per game, registered in src/games/index.js
  src/components/      shared UI (e.g. Leaderboard)
server/Arcade.Api/     ASP.NET Core minimal API (health + leaderboard stub)
Dockerfile             builds both and runs the app (used for deployment)
```

## Local development

Requirements: .NET 8 SDK, Node 20+.

```bash
# terminal 1: API on http://localhost:5000
cd server/Arcade.Api && dotnet run

# terminal 2: frontend with hot reload on http://localhost:5173 (proxies /api to :5000)
cd client && npm install && npm run dev
```

Production-like run: `cd client && npm run build`, copy `client/dist/*` into `server/Arcade.Api/wwwroot/`, then `dotnet run` and open http://localhost:5000.

## API

- `GET /api/health`
- `GET /api/scores/{game}` – top 10 scores
- `POST /api/scores` – `{ "game": "click-rush", "player": "Ann", "score": 12 }`

Scores are stored in memory and reset on restart. Swap in a database (e.g. Clever Cloud PostgreSQL) when persistence is needed.

## Adding a game

1. Create `client/src/games/<your-game>/YourGame.jsx` (a component; it may call `submitScore` from `src/api.js`).
2. Register it in `client/src/games/index.js`.
3. Open a pull request.

## Deploying to Clever Cloud (EU)

1. Create an application, choose **Docker** as the runtime, and connect this GitHub repo (or `git push` to the Clever Cloud remote).
2. The `Dockerfile` listens on port 8080, which Clever Cloud expects.
3. Deploy. A small scaler is enough to start.

Note: the in-memory leaderboard works with a single instance only; don't enable horizontal scaling until scores move to a database.
