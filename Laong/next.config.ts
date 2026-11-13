import type { NextConfig } from "next";

const config: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  distDir: process.env.VERCEL === "1" ? ".next" : ".laong-build",
};
export default config;
