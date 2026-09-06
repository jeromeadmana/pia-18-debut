import { config } from "dotenv";

// `neon link` writes credentials to .env.local. Loaded here so integration tests
// can reach the database; unit tests neither need nor read it.
config({ path: ".env.local" });
