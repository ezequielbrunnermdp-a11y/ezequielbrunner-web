import { config } from "dotenv";
config({ path: process.env.ENV_FILE ?? ".env.local" });
config();
