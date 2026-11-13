import type { Metadata } from "next";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Workspace } from "./workspace";
import "./shell.css";

const source = readFileSync(join(process.cwd(), "public/laong-assets/index.html"), "utf8");
const surface = source.split("<body>")[1].split("</body>")[0].replaceAll('src="icons/', 'src="/laong-assets/icons/');

export const metadata: Metadata = {
  title: "Laong · สมุดบันทึกการทดลอง",
  icons: "/laong-assets/icons/laong.svg",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="th"><head>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" />
    {["tokens", "styles", "monitor", "admin"].map(name => <link key={name} rel="stylesheet" href={`/laong-assets/${name}.css`} />)}
  </head><body>{children}<Workspace body={surface} /></body></html>;
}
