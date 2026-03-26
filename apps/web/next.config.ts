import path from "node:path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: path.resolve(__dirname, "../../.env") });

import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@pip/api", "@pip/db", "@pip/ui", "@pip/auth"],
};

export default config;
