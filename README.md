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

Requirements: .NET 8 SDK, Node.js `^20.19.0` or `>=22.12.0` (Vite 8 requirement).

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

## Play together on phones

In Click Rush, start a game and choose **Play with friends on phones**. Share the room code with friends; on each phone, open the arcade, choose **Phone controller**, enter the code and a player name, then tap **HIT!** to play together. The host screen shows the shared score and each player's hits.

Multiplayer rooms are stored in memory, expire after 30 minutes, and work with a single server instance.

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

---

# Server infrastructure (Docker Compose + Caddy)

This repo also defines what runs on a single self-hosted Ubuntu VPS for `tengudance.com`: Caddy (automatic HTTPS), PostgreSQL, nightly backups and ASP.NET Core apps. App images are built in separate repos and pushed to `ghcr.io/matt-hue/APP_NAME`.

## Architecture

```
Internet ──80/443──> caddy ──(edge network)──> app, other apps
                                                  │
                                         (data network)
                                                  v
                                 postgres <── backup (pg_dump nightly)
```

- `compose.yaml` – services `caddy`, `postgres`, `backup`, placeholder `app`; networks `edge` and `data`. Only Caddy publishes ports; postgres is on `data` only.
- `caddy/Caddyfile` – `app.tengudance.com` -> placeholder app, `tengudance.com` static placeholder, `www` redirect. Per-site HTTP-challenge certificates (no wildcard).
- `scripts/` – `bootstrap.sh`, `deploy.sh`, `backup.sh`, `restore.sh`.
- `.github/workflows/` – `deploy.yml` (rsync + deploy on push to `main`), `lint.yml` (PRs).

Assumptions: the placeholder app listens on 8080 and its healthcheck uses bash `/dev/tcp` (the image has no curl); the backup container installs `curl` on first S3 upload; `deploy` gets passwordless sudo because it has no password; backups run at 02:00 UTC.

## First-time setup

1. **Bootstrap** (as root on the fresh server; pass the deploy public key):
   `scp scripts/bootstrap.sh root@SERVER:/root/ && ssh root@SERVER 'bash bootstrap.sh "ssh-ed25519 AAAA... deploy-key"'`
   Open a new SSH session as `deploy` to confirm it works before closing the root one. The script fails with a clear message if Docker has no apt repo for the Ubuntu release.
2. **Deploy key** (on your machine): `ssh-keygen -t ed25519 -f deploy_key -N ""`. Use `deploy_key.pub` for bootstrap and `deploy_key` as the `SSH_PRIVATE_KEY` secret.
3. **known_hosts**: `ssh-keyscan -t ed25519 SERVER_IP` -> value of `SSH_KNOWN_HOSTS` (verify the fingerprint against the provider console).
4. **GitHub secrets**: `SSH_HOST`, `SSH_USER` (`deploy`), `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`.
5. **`.env`**: on the server, `cp /opt/stack/.env.example /opt/stack/.env`, then set real values (e.g. `openssl rand -base64 24` for `POSTGRES_PASSWORD`). The deploy workflow never overwrites or deletes this file.
6. **ghcr.io login** (private app images): create a GitHub token with only `read:packages`, then on the server `echo TOKEN | docker login ghcr.io -u matt-hue --password-stdin`.
7. Push to `main` (or run the Deploy workflow). Visit `https://app.tengudance.com`.

## Add a new app

1. Copy the template block in `compose.yaml`, set image `ghcr.io/matt-hue/APP_NAME:TAG`, networks `edge` and `data`, memory limit 256m.
2. Create its database and role in postgres, e.g. `docker compose exec postgres psql -U postgres -c "CREATE DATABASE myapp"`; put its password in `.env` (and a dummy in `.env.example`).
3. Add a site block to `caddy/Caddyfile` (see the commented example). No DNS change is needed.
4. Merge to `main`, or run the Deploy workflow with `service` set to the new service.

## Deploy and roll back

Deploys happen automatically on push to `main`, or manually: `scripts/deploy.sh [service]` on the server. It validates the compose file, pulls, runs `up -d --remove-orphans`, waits for healthy containers (non-zero exit on timeout), prunes unused images and warns above 80% disk use.

Roll back by setting the previous image tag in `compose.yaml` (or the `.env` variable) and deploying that service again, e.g. revert the commit and push, or `scripts/deploy.sh myapp`.

## Backup and restore

The `backup` service dumps every database nightly (`pg_dump -Fc`, compressed, timestamped) into the `backups` volume: `daily/` keeps 3, `weekly/` keeps 2. Set the `S3_*` variables in `.env` to also upload to S3-compatible storage; leave `S3_BUCKET` empty to skip.

- Run now: `docker compose exec backup sh /usr/local/bin/backup.sh`
- List dumps: `scripts/restore.sh`
- Restore: `scripts/restore.sh daily/myapp_20250101T020000Z.dump myapp` (asks you to type the database name to confirm).

## Rebuild from scratch

1. Provision Ubuntu, point DNS at it, run `bootstrap.sh`.
2. Create `/opt/stack/.env` and log in to ghcr.io (see setup).
3. Update the `SSH_HOST`/`SSH_KNOWN_HOSTS` secrets and run the Deploy workflow.
4. Copy a dump from S3 into the backup volume (e.g. `docker compose cp dump.dump backup:/backups/daily/`) and run `scripts/restore.sh`.
