import { database, defineRailway, github, preserve, project, service, volume } from "railway/iac";

// Railway Infrastructure as Code. Preview with `railway config plan`, apply with `railway config apply`.
// The same file describes every environment: staging deploys the staging branch, production deploys main.

const repo = "ammarsarhan/rehletak";
const region = "europe-west4-drams3a"; // EU West, closest to Neon (aws-eu-central-1)

// Anything that can change the backend build triggers a deploy; dashboard and storefront changes don't.
const backendWatch = [
  "/backend/**",
  "/package.json",
  "/pnpm-lock.yaml",
  "/pnpm-workspace.yaml",
  "/turbo.json",
];

// Railway Redis template command, plus our flags.
const redisStart = (flags: string) =>
  `/bin/sh -c "rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH ${flags}"`;

// Declares everything Railway's Redis template sets up, so every environment gets the same Redis instead of
// depending on how Railway first created it: the official image, a volume, the password variables and REDIS_URL.
// The private endpoint matches the docker-compose service name.
const redisService = (name: string, flags: string) => {
  const node = database(name, "redis", { image: "redis:8.2", output: "REDIS_URL", defaultMountPath: "/data", region: region });
  const data = volume(`${name}-volume`, { region: region, sizeMB: 500 });

  // Spread, don't replace: database() puts the region in deploy.
  node.deploy = { ...node.deploy, startCommand: redisStart(flags) };
  node.networking = { privateNetworkEndpoint: name };
  node.variables = {
    // Never set from here: an apply doesn't run Railway's secret generator, so it would write an empty password.
    // A new environment needs it set once by hand (32 random letters), after which it's kept as is.
    REDIS_PASSWORD: preserve(),
    REDISUSER: { type: "literal", value: "default" },
    REDISHOST: { type: "literal", value: "${{RAILWAY_PRIVATE_DOMAIN}}" },
    REDISPORT: { type: "literal", value: "6379" },
    REDISPASSWORD: { type: "literal", value: "${{REDIS_PASSWORD}}" },
    REDIS_URL: { type: "literal", value: "redis://${{REDISUSER}}:${{REDIS_PASSWORD}}@${{REDISHOST}}:${{REDISPORT}}" },
  };

  return [node, data] as const;
};

export default defineRailway((ctx) => {
  const production = ctx.environment === "production";

  // BullMQ needs keys to never be evicted.
  const [queue, queueVolume] = redisService("queue", "--maxmemory-policy noeviction --appendonly yes");

  // Cache only: evicts least-recently-used keys when full.
  const [cache, cacheVolume] = redisService("cache", "--maxmemory 256mb --maxmemory-policy allkeys-lru");

  // Built from the repo root so pnpm can resolve the workspace. Neon URLs are shared variables set per
  // environment, never stored here.
  const backend = (name: string, deploy: { start: string; preDeploy?: string; healthcheck?: string }) =>
    service(name, {
      source: github(repo, { branch: production ? "main" : "staging", checkSuites: true }),
      build: {
        builder: "RAILPACK",
        buildCommand: "pnpm turbo run build --filter=@rehletak/backend",
        watchPatterns: backendWatch,
      },
      ...deploy,
      healthcheckTimeout: deploy.healthcheck ? 60 : undefined,
      replicas: { [region]: 1 },
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
              // Where admin invitation links point.
              ADMIN_URL: production ? "https://admin.rehletak.app" : "https://admin.staging.rehletak.app",
              RESEND_EMAIL: "Rehletak <no-reply@rehletak.app>",
              // Secrets: never set from here, since an apply would write them empty. Each environment needs them set
              // once by hand (its own values), after which they're kept as is. Changing TOTP_ENCRYPTION_KEY breaks
              // every admin's authenticator setup; changing ADMIN_SECRET signs every admin out.
              ADMIN_SECRET: preserve(),
              TOTP_ENCRYPTION_KEY: preserve(),
              RESEND_KEY: preserve(),
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
