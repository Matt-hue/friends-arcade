# Friends Arcade

A small browser arcade for friends. ASP.NET Core (.NET 8) backend + React (Vite) frontend.
The root Dockerfile builds the frontend and backend together and serves the frontend from the API.

```
client/                React + Vite frontend
  src/games/           one folder per game, registered in src/games/index.js
  src/components/      shared UI (e.g. Leaderboard)
server/Arcade.Api/     ASP.NET Core minimal API (health + leaderboard)
Dockerfile             builds both and runs the app
src/Arcade/            separate PostgreSQL-backed arcade implementation
```

## Local development

Requirements: .NET 8 SDK, Node.js.

```bash
# terminal 1: API on http://localhost:5000
cd server/Arcade.Api && dotnet run

# terminal 2: frontend with hot reload on http://localhost:5173 (proxies /api to :5000)
cd client && npm install && npm run dev
```

Production-like run: `cd client && npm run build`, copy `client/dist/*` into `server/Arcade.Api/wwwroot/`, then run the API and open http://localhost:5000.

## API

- `GET /api/health`
- `GET /api/scores/{game}` – top 10 scores
- `POST /api/scores` – `{ "game": "click-rush", "player": "Ann", "score": 12 }`

Scores are stored in memory and reset on restart. This in-memory leaderboard works with a single instance only.

## Adding a game

1. Create `client/src/games/<your-game>/YourGame.jsx` (a component; it may call `submitScore` from `src/api.js`).
2. Register it in `client/src/games/index.js`.
3. Open a pull request.

## Deploying to Clever Cloud

1. Create an application, choose **Docker** as the runtime, and connect this GitHub repo (or `git push` to the Clever Cloud remote).
2. The `Dockerfile` listens on port 8080, which Clever Cloud expects.
3. Deploy. A small scaler is enough to start.

## PostgreSQL-backed implementation

`src/Arcade/` contains a separate ASP.NET Core implementation with a plain HTML/JS frontend, PostgreSQL-backed scores, and feature ideas. It is not the app built by the root Dockerfile.

To run it, start PostgreSQL (for example, `docker run -e POSTGRES_PASSWORD=pw -p 5432:5432 postgres:16`), then:

```bash
cd src/Arcade
ConnectionStrings__Default="Host=localhost;Database=postgres;Username=postgres;******" dotnet run
```

It provides `GET /api/scores/{game}`, `POST /api/scores`, `GET /api/ideas`, `POST /api/ideas`, and `GET /api/health`. Database connection settings are read from `POSTGRESQL_ADDON_URI`, the `POSTGRESQL_ADDON_*` variables, or `ConnectionStrings__Default`; tables are created on startup.

The earlier standalone starter remains in `src/FriendsArcade`; it is another separate .NET 8 app.
