# friends-arcade
A tiny browser arcade built by friends. Add a game, send a PR.

ASP.NET Core (.NET 8) backend + plain HTML/JS frontend served from `wwwroot`. Scores and feature ideas are persisted in PostgreSQL.

## Structure
- `src/Arcade/Program.cs` – app startup, schema init, routes
- `src/Arcade/Db.cs` – connection config + schema (`CREATE TABLE IF NOT EXISTS`, run at startup)
- `src/Arcade/Features.cs` – API endpoints (scores, ideas)
- `src/Arcade/wwwroot/` – frontend; each game lives in `wwwroot/games/<id>/`

## Adding a game
1. Create `src/Arcade/wwwroot/games/<id>/index.html`.
2. Register it in `src/Arcade/wwwroot/games.json`.
3. Save scores with `POST /api/scores` (`{ "game": "<id>", "player": "...", "score": 123 }`) and read with `GET /api/scores/<id>`.

## API
- `GET /api/scores/{game}` – top 10 · `POST /api/scores`
- `GET /api/ideas` · `POST /api/ideas` (`{ "author", "text" }`)
- `GET /api/health`

## Run locally
Start a PostgreSQL (e.g. `docker run -e POSTGRES_PASSWORD=pw -p 5432:5432 postgres:16`), then:

```
cd src/Arcade
ConnectionStrings__Default="Host=localhost;Database=postgres;Username=postgres;******" dotnet run
```

## Database configuration
The app reads, in order: `POSTGRESQL_ADDON_URI`, the `POSTGRESQL_ADDON_HOST/PORT/DB/USER/PASSWORD` variables, then `ConnectionStrings__Default`. Clever Cloud sets the `POSTGRESQL_ADDON_*` variables automatically when you link the add-on. Tables are created on startup.

## Deploy on Clever Cloud (EU)
Local disk on Clever Cloud is ephemeral, so data lives in a managed PostgreSQL add-on.
1. Create a **PostgreSQL** add-on (the smallest/free "DEV" plan is fine to start), region Paris.
2. Create an application of type **Docker** from this GitHub repo, branch `main`. The root `Dockerfile` builds the app; it listens on port 8080 (Clever Cloud's default).
3. In the application's **Service dependencies**, link the PostgreSQL add-on. This injects the `POSTGRESQL_ADDON_*` variables.
4. Deploy. Check `/api/health`.

## Earlier standalone starter

The earlier Whack-a-Dot starter remains in `src/FriendsArcade`. It is a separate .NET 8 app; to run it, use `cd src/FriendsArcade && dotnet run`. The root `Dockerfile` deploys the PostgreSQL-backed arcade in `src/Arcade`.
