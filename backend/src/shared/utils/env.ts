import { config } from "dotenv";

// backend/.env holds local service settings; the repo-root .env.local is written by `neon checkout` / `neon env pull`
// for whichever Neon branch is checked out. Earlier files win. On Railway neither file exists and env is injected.
config({ path: [".env", "../.env.local"] });
