# Rehletak

pnpm workspace + Turborepo.

```
backend/        Hono API + BullMQ worker + Prisma (Railway)
dashboard/      Next.js: staff (dashboard.rehletak.app) and admin (admin.rehletak.app) (Vercel)
storefronts/*   One Next.js app per company (Vercel)
```

## Local development

```sh
pnpm install
docker compose up -d                 # redis-cache on :6379, redis-queue on :6380
cp backend/.env.example backend/.env # then fill in DATABASE_URL from a Neon dev branch
cp dashboard/.env.example dashboard/.env.local

pnpm dev                             # backend server + dashboard
pnpm --filter @rehletak/backend dev:worker
```

Open `localhost:3000` for staff and `admin.localhost:3000` for admin.

## Railway services

All four live in one Railway project. Both backend services build from the repo root so pnpm can see the lockfile.

| Service      | Source        | Build                                                     | Start                                                   |
| ------------ | ------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| server       | this repo     | `pnpm install --frozen-lockfile && pnpm turbo build --filter=@rehletak/backend` | `pnpm --filter @rehletak/backend db:deploy && pnpm --filter @rehletak/backend start` |
| worker       | this repo     | same as server                                            | `pnpm --filter @rehletak/backend start:worker`          |
| redis-cache  | Redis plugin  | set `maxmemory-policy allkeys-lru`                        |                                                         |
| redis-queue  | Redis plugin  | set `maxmemory-policy noeviction`                         |                                                         |

Set `CACHE_URL` and `QUEUE_URL` on both server and worker as references to each Redis service's private `REDIS_URL`. Only the server runs migrations, so the two never race on deploy.
