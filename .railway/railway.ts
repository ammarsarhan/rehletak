import { defineRailway, github, project, redis, service, volume } from "railway/iac";

// Railway Infrastructure as Code. Preview with `railway config plan`, apply with `railway config apply`.
// The same file describes every environment: staging deploys the staging branch, production deploys main.

const REPO = "ammarsarhan/rehletak";
const REGION = "europe-west4-drams3a"; // EU West, closest to Neon (aws-eu-central-1)

// Anything that can change the backend build triggers a deploy; dashboard and storefront changes don't.
const BACKEND_WATCH = [
  "/backend/**",
  "/package.json",
  "/pnpm-lock.yaml",
  "/pnpm-workspace.yaml",
  "/turbo.json",
];

// Railway Redis template command, plus our flags.
const redisStart = (flags: string) =>
  `/bin/sh -c "rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH ${flags}"`;

export default defineRailway((ctx) => {
  const production = ctx.environment === "production";

  // BullMQ needs keys to never be evicted.
  const queue = redis("queue", { region: REGION });
  queue.deploy = { startCommand: redisStart("--maxmemory-policy noeviction --appendonly yes") };
  queue.networking = { privateNetworkEndpoint: "queue" };

  // Cache only: evicts least-recently-used keys when full.
  const cache = redis("cache", { region: REGION });
  cache.deploy = { startCommand: redisStart("--maxmemory 256mb --maxmemory-policy allkeys-lru") };
  cache.networking = { privateNetworkEndpoint: "cache" };

  const queueVolume = volume("queue-volume", { region: REGION, sizeMB: 500 });
  const cacheVolume = volume("cache-volume", { region: REGION, sizeMB: 500 });

  // Built from the repo root so pnpm can resolve the workspace. Neon URLs are shared variables set per
  // environment, never stored here.
  const backend = (name: string, deploy: { start: string; preDeploy?: string; healthcheck?: string }) =>
    service(name, {
      source: github(REPO, { branch: production ? "main" : "staging", checkSuites: true }),
      build: {
        builder: "RAILPACK",
        buildCommand: "pnpm turbo run build --filter=@rehletak/backend",
        watchPatterns: BACKEND_WATCH,
      },
      ...deploy,
      healthcheckTimeout: deploy.healthcheck ? 60 : undefined,
      replicas: { [REGION]: 1 },
      env: {
        NODE_ENV: "production",
        DATABASE_URL: ctx.shared.DATABASE_URL,
        ...(deploy.preDeploy ? { DATABASE_URL_UNPOOLED: ctx.shared.DATABASE_URL_UNPOOLED } : {}),
        QUEUE_URL: queue.env.REDIS_URL,
        CACHE_URL: cache.env.REDIS_URL,
        ...(deploy.healthcheck
          ? {
              CORS_ORIGINS: production
                ? "https://dashboard.rehletak.app,https://admin.rehletak.app"
                : "https://dashboard.staging.rehletak.app,https://admin.staging.rehletak.app",
            }
          : {}),
      },
    });

  const server = backend("server", {
    start: "pnpm --filter @rehletak/backend start",
    preDeploy: "pnpm --filter @rehletak/backend db:deploy",
    healthcheck: "/health",
  });

  const worker = backend("worker", { start: "pnpm --filter @rehletak/backend start:worker" });

  return project("rehletak", {
    resources: [server, worker, queue, cache, queueVolume, cacheVolume],
  });
});
