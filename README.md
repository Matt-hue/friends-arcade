# friends-arcade
A tiny browser arcade built by friends. Add a game, send a PR.

Stack: ASP.NET Core (.NET 8) minimal API + plain HTML/JS frontend served from `src/FriendsArcade/wwwroot`.
Includes a starter game (Whack-a-Dot) with a leaderboard.

## Run locally
Requires the [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0).

```bash
cd src/FriendsArcade
dotnet run
```

Open the URL printed in the console. Without a database configured, scores are kept in memory and reset on restart.

To use PostgreSQL locally, set `POSTGRESQL_ADDON_URI` (e.g. `******localhost:5432/arcade`) or `ConnectionStrings__Default`. The `scores` table is created automatically.

## API
- `GET /api/scores` – top 10 scores
- `POST /api/scores` – body `{ "name": "...", "points": 12 }`

## Deploy to Clever Cloud
1. Create an application of type **Docker** and link this repo, branch `main`. The root `Dockerfile` builds and starts the app on port 8080.
2. Create a **PostgreSQL** addon and link it to the application. Clever Cloud injects `POSTGRESQL_ADDON_URI`, which the app uses automatically (the table is created on startup). Without the addon the app still runs, using in-memory scores.
3. Deploy (push to the branch).

## Adding a game
Add files under `src/FriendsArcade/wwwroot` and open a PR.
