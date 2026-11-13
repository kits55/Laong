import { notFound } from "next/navigation";
import { pages } from "../routes";

export default async function Page({ params }: { params: Promise<{ screen?: string[] }> }) {
  const { screen = [] } = await params;
  const [name, id] = screen;
  if (name && (name === "run" ? !id || screen.length !== 2 : !Object.hasOwn(pages, name) || screen.length !== 1)) notFound();
  return null;
}
