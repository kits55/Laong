import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const onVercel = process.env.VERCEL === "1";
const legacyHtml = readFileSync(resolve(process.cwd(), "public/laong-assets/index.html"), "utf8");
const legacyBody = legacyHtml.match(/<body>([\s\S]*?)<\/body>/)?.[1];
if (!legacyBody) throw new Error("Laong workspace template is missing its body");

const config: NextConfig = {
  // Vercel builds from Laong/, while its artifact paths start at the checkout root.
  outputFileTracingRoot: onVercel ? resolve(process.cwd(), "..") : process.cwd(),
  distDir: onVercel ? ".next" : ".laong-build",
  // Bundle this public markup so the server function never needs to read a static asset.
  env: { LAONG_WORKSPACE_BODY: legacyBody.replaceAll('src="icons/', 'src="/laong-assets/icons/') },
};
export default config;
