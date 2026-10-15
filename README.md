# Rehletak

pnpm workspace + Turborepo.

```
backend/        Hono API + BullMQ worker + Prisma (Railway)
dashboard/      Next.js: staff (dashboard.rehletak.app) and admin (admin.rehletak.app) (Vercel)
storefronts/*   One Next.js app per company (Vercel)
```

## Local development

Locally everything runs over https on subdomains of `local.rehletak.app`, mirroring production:

| Local                                       | Production                     |
| ------------------------------------------- | ------------------------------ |
| `https://dashboard.local.rehletak.app:3000` | `https://dashboard.rehletak.app` |
| `https://admin.local.rehletak.app:3000`     | `https://admin.rehletak.app`     |
| `https://api.local.rehletak.app:8080`       | `https://api.rehletak.app`       |

Plain `localhost` doesn't work: browsers treat `admin.localhost` and `localhost` as different sites, so they drop the
API's `SameSite=Lax` auth cookies. The dashboards and the API have to share a registrable domain, as they do in
production. `.app` forces https in every browser, hence the local certificates.

### One-time setup

**1. Point the local hostnames at your machine** by adding these lines to your hosts file:

```
127.0.0.1 dashboard.local.rehletak.app
127.0.0.1 admin.local.rehletak.app
127.0.0.1 api.local.rehletak.app
```

macOS / Linux, the file is `/etc/hosts`:

```sh
printf '127.0.0.1 %s\n' dashboard.local.rehletak.app admin.local.rehletak.app api.local.rehletak.app | sudo tee -a /etc/hosts
```

Windows, the file is `C:\Windows\System32\drivers\etc\hosts`. In PowerShell run as Administrator:

```powershell
"dashboard", "admin", "api" | ForEach-Object { Add-Content -Path "$env:SystemRoot\System32\drivers\etc\hosts" -Value "127.0.0.1 $_.local.rehletak.app" }
```

**2. Create trusted certificates with [mkcert](https://github.com/FiloSottile/mkcert).** `mkcert -install` adds a local
certificate authority to your system's trust store, so browsers trust certificates it creates. Run it once per machine.

macOS / Linux:

```sh
brew install mkcert              # Linux without Homebrew: see the mkcert README
mkcert -install
mkdir -p .certs && mkcert -cert-file .certs/local.pem -key-file .certs/local-key.pem "*.local.rehletak.app"
```

Windows (PowerShell, from the repo root):

```powershell
choco install mkcert             # or: scoop bucket add extras; scoop install mkcert
mkcert -install
New-Item -ItemType Directory -Force .certs | Out-Null; mkcert -cert-file .certs/local.pem -key-file .certs/local-key.pem "*.local.rehletak.app"
```

`.certs/` is git-ignored. Firefox keeps its own trust store: on macOS / Linux install `nss` (`brew install nss`) before
`mkcert -install`.

### Running

```sh
pnpm install
docker compose up -d                 # Postgres on :5432, cache Redis on :6379, queue Redis on :6380
cp backend/.env.example backend/.env # then set ADMIN_SECRET and TOTP_ENCRYPTION_KEY: openssl rand -base64 32
cp dashboard/.env.example dashboard/.env.local
pnpm --filter @rehletak/backend db:deploy

pnpm dev                             # backend server + dashboard
pnpm --filter @rehletak/backend dev:worker
```

Open `https://dashboard.local.rehletak.app:3000` for staff and `https://admin.local.rehletak.app:3000` for admin.

### The first admin

Set `ADMIN_EMAIL` in `backend/.env` and run `pnpm --filter @rehletak/backend db:seed`. With `RESEND_KEY` empty the
invitation email, link included, is printed to the console. The seed only works while no admin exists; every admin after
the first is invited by an admin.

## Railway services

All four live in one Railway project. Both backend services build from the repo root so pnpm can see the lockfile.

| Service      | Source        | Build                                                     | Start                                                   |
| ------------ | ------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| server       | this repo     | `pnpm install --frozen-lockfile && pnpm turbo build --filter=@rehletak/backend` | `pnpm --filter @rehletak/backend db:deploy && pnpm --filter @rehletak/backend start` |
| worker       | this repo     | same as server                                            | `pnpm --filter @rehletak/backend start:worker`          |
| redis-cache  | Redis plugin  | set `maxmemory-policy allkeys-lru`                        |                                                         |
| redis-queue  | Redis plugin  | set `maxmemory-policy noeviction`                         |                                                         |

Set `CACHE_URL` and `QUEUE_URL` on both server and worker as references to each Redis service's private `REDIS_URL`. Only the server runs migrations, so the two never race on deploy.
