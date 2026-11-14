import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Workspace } from "./workspace";
import "./shell.css";

const surface = process.env.LAONG_WORKSPACE_BODY!;

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
