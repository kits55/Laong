import type { NextConfig } from "next";
import { resolve } from "node:path";

const onVercel = process.env.VERCEL === "1";
const config: NextConfig = {
  // Vercel builds from Laong/, while its artifact paths start at the checkout root.
  outputFileTracingRoot: onVercel ? resolve(process.cwd(), "..") : process.cwd(),
  distDir: onVercel ? ".next" : ".laong-build",
};
export default config;
